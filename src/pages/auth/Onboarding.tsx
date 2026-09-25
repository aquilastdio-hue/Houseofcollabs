import * as React from 'react'
import { Navigate } from 'react-router'
import { Building2, LogOut, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { homeFor, useAuth } from '@/contexts/auth-context'
import { setInitialRole } from '@/services/auth.service'
import { toAppError } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { RadioCard, RadioGroup } from '@/components/ui/radio-group'
import { FullPageLoader, PageLoader } from '@/components/ui/spinner'
import { Logo } from '@/components/shared/logo'
import { Seo } from '@/components/shared/seo'

const CreatorOnboarding = React.lazy(() => import('./onboarding/CreatorOnboarding'))

function Frame({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="container-page flex h-(--header-height) items-center justify-between">
          <Logo />
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut /> Log out
          </Button>
        </div>
      </header>
      <main id="main" className="container-page flex justify-center py-10 sm:py-16">
        {children}
      </main>
    </div>
  )
}

function RoleSelect() {
  const { refresh } = useAuth()
  const [role, setRole] = React.useState<'brand' | 'creator' | ''>('')
  const [saving, setSaving] = React.useState(false)
  return (
    <div className="w-full max-w-lg">
      <p className="eyebrow text-muted">Welcome to House of Collabs</p>
      <h1 className="mt-2 font-display text-display-md font-semibold">How will you use House of Collabs?</h1>
      <p className="mt-2 text-muted">This sets up the right workspace for you. It can’t be changed later.</p>
      <RadioGroup value={role} onValueChange={(v) => setRole(v as 'brand' | 'creator')} className="mt-8" aria-label="Account type">
        <RadioCard value="brand" title="I’m a brand" description="Discover creators, send briefs and order content." icon={<Building2 />} />
        <RadioCard value="creator" title="I’m a creator" description="Build a storefront, sell content services and get paid." icon={<Sparkles />} />
      </RadioGroup>
      <Button
        className="mt-6"
        size="lg"
        block
        disabled={!role}
        loading={saving}
        onClick={async () => {
          if (!role) return
          setSaving(true)
          try {
            await setInitialRole(role)
            await refresh()
          } catch (e) {
            toast.error(toAppError(e).message)
          } finally {
            setSaving(false)
          }
        }}
      >
        Continue
      </Button>
    </div>
  )
}

export default function Onboarding() {
  const { profile, profileLoading } = useAuth()
  if (profileLoading || !profile) return <FullPageLoader />
  if (profile.status !== 'active') return <Navigate to="/" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />
  if (profile.role && profile.onboarding_completed) return <Navigate to={homeFor(profile.role)} replace />

  return (
    <>
      <Seo title="Set up your account" noindex />
      {!profile.role ? (
        <Frame>
          <RoleSelect />
        </Frame>
      ) : profile.role === 'brand' ? (
        // Brand registrations are paused, so a new brand goes to the
        // coming-soon screen instead of brand onboarding. Restore
        // `<Frame><BrandOnboarding /></Frame>` here to reopen them.
        <Navigate to="/collabs" replace />
      ) : (
        // No <Frame> here: CreatorOnboarding renders its own sticky header with
        // the step progress and Save & exit. Wrapping it would stack a second
        // header on top and nest two <main id="main"> elements.
        <React.Suspense fallback={<PageLoader />}>
          <CreatorOnboarding />
        </React.Suspense>
      )}
    </>
  )
}
