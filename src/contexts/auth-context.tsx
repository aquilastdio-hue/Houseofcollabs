import * as React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { qk } from '@/lib/query-keys'
import { getMyProfile } from '@/services/profile.service'
import { getMyBrand } from '@/services/brands.service'
import { getMyCreator, type CreatorProfile } from '@/services/creators.service'
import { signOut as signOutService } from '@/services/auth.service'
import type { Brand, Profile, UserRole } from '@/types'

type AuthContextValue = {
  /** True until the initial session has been resolved. */
  initializing: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  profileLoading: boolean
  role: UserRole | null
  isAdmin: boolean
  brand: Brand | null
  creator: CreatorProfile | null
  /** True while role-specific records (brand / creator) are loading. */
  accountLoading: boolean
  recoveryMode: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = React.useState<Session | null>(null)
  const [initializing, setInitializing] = React.useState(isSupabaseConfigured)
  const [recoveryMode, setRecoveryMode] = React.useState(false)

  React.useEffect(() => {
    if (!isSupabaseConfigured) return
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setInitializing(false)
    })
    // NOTE: never await Supabase calls inside this callback (it can deadlock);
    // state updates trigger the queries below instead.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setInitializing(false)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (event === 'SIGNED_OUT') {
        setRecoveryMode(false)
        queryClient.clear()
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [queryClient])

  const user = session?.user ?? null
  const userId = user?.id

  const profileQuery = useQuery({
    queryKey: qk.profile(userId),
    queryFn: () => getMyProfile(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  })
  const profile = profileQuery.data ?? null
  const role = profile?.role ?? null

  const brandQuery = useQuery({
    queryKey: qk.brand.mine,
    queryFn: () => getMyBrand(userId!),
    enabled: !!userId && role === 'brand',
    staleTime: 60_000,
  })

  const creatorQuery = useQuery({
    queryKey: qk.creators.mine,
    queryFn: () => getMyCreator(userId!),
    enabled: !!userId && role === 'creator',
    staleTime: 30_000,
  })

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.profile(userId) }),
      queryClient.invalidateQueries({ queryKey: qk.brand.mine }),
      queryClient.invalidateQueries({ queryKey: qk.creators.mine }),
    ])
  }, [queryClient, userId])

  const signOut = React.useCallback(async () => {
    await signOutService()
    queryClient.clear()
  }, [queryClient])

  const value: AuthContextValue = {
    initializing,
    session,
    user,
    profile,
    profileLoading: !!userId && profileQuery.isPending,
    role,
    isAdmin: role === 'admin',
    brand: brandQuery.data ?? null,
    creator: creatorQuery.data ?? null,
    accountLoading: (role === 'brand' && brandQuery.isPending) || (role === 'creator' && creatorQuery.isPending),
    recoveryMode,
    refresh,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

// Lives in `@/lib/auth-destination` alongside the rule that decides where a
// sign-in lands, so the two can't drift. Re-exported here because most callers
// already reach for it through the auth context.
export { homeFor } from '@/lib/auth-destination'
