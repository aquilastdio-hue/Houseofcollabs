import * as React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { destinationAfterLogin, homeFor } from '@/lib/auth-destination'
import { FullPageLoader } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import type { UserRole } from '@/types'

/**
 * Route guards give good UX; they are NOT the security boundary — every
 * request is authorised by Postgres RLS / SECURITY DEFINER functions.
 */
export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const { initializing, session } = useAuth()
  const location = useLocation()
  if (initializing) return <FullPageLoader />
  if (!session) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <>{children ?? <Outlet />}</>
}

function Suspended() {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="max-w-md rounded-panel border border-line bg-surface p-8 text-center shadow-card">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <ShieldAlert className="size-5" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold">Your account is suspended</h1>
        <p className="mt-2 text-muted">You can’t access your workspace right now. Contact support if you think this is a mistake.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="secondary">
            <a href="/contact">Contact support</a>
          </Button>
          <Button onClick={() => void signOut()}>Log out</Button>
        </div>
      </div>
    </div>
  )
}

/** Requires a signed-in, active, onboarded user with the given role. */
export function RequireRole({ role, children }: { role: UserRole; children?: React.ReactNode }) {
  const { initializing, session, profile, profileLoading, accountLoading } = useAuth()
  const location = useLocation()
  if (initializing || (session && (profileLoading || accountLoading))) return <FullPageLoader />
  if (!session) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (!profile) return <FullPageLoader />
  if (profile.status !== 'active') return <Suspended />
  if (!profile.role || (profile.role !== 'admin' && !profile.onboarding_completed)) return <Navigate to="/onboarding" replace />
  if (profile.role !== role) return <Navigate to={homeFor(profile.role, profile.onboarding_completed)} replace />
  return <>{children ?? <Outlet />}</>
}

/** Login / signup pages: bounce signed-in users to their workspace. */
export function GuestOnly({ children }: { children?: React.ReactNode }) {
  const { initializing, session, profile, profileLoading } = useAuth()
  const location = useLocation()
  if (initializing || (session && profileLoading)) return <FullPageLoader />
  if (session && profile) {
    const redirect = new URLSearchParams(location.search).get('redirect')
    return (
      <Navigate
        to={destinationAfterLogin({ redirect, role: profile.role, onboarded: profile.onboarding_completed })}
        replace
      />
    )
  }
  return <>{children ?? <Outlet />}</>
}
