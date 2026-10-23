import * as React from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Building2, LogOut, Sparkles } from 'lucide-react'
import { homeFor, useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/shared/logo'
import { Button } from '@/components/ui/button'
import { RadioCard, RadioGroup } from '@/components/ui/radio-group'
import { FullPageLoader, PageLoader } from '@/components/ui/spinner'
import { Seo } from '@/components/shared/seo'

const CreatorOnboarding = React.lazy(() => import('./onboarding/CreatorOnboarding'))
const BrandOnboarding = React.lazy(() => import('./onboarding/BrandOnboarding'))

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
  const navigate = useNavigate()
  const [role, setRole] = React.useState<'brand' | 'creator' | ''>('')
  return (
    <div className="w-full max-w-lg">
      <p className="eyebrow text-muted">Welcome to House of Collabs</p>
      <h1 className="mt-2 font-display text-display-md font-semibold">Brands or Collabs?</h1>
      <p className="mt-2 text-muted">Pick how you want to use House of Collabs. This sets up the right workspace for you.</p>
      <RadioGroup value={role} onValueChange={(v) => setRole(v as 'brand' | 'creator')} className="mt-8" aria-label="Account type">
        <RadioCard value="brand" title="Brands" description="Discover creators, send briefs and order content." icon={<Building2 />} />
        <RadioCard value="creator" title="Collabs" description="Build a storefront, sell content services and get paid." icon={<Sparkles />} />
      </RadioGroup>
      <Button
        className="mt-6"
        size="lg"
        block
        disabled={!role}
        onClick={() => {
          if (!role) return
          // Brands go to self-serve onboarding, creators go to application form
          if (role === 'brand') {
            navigate('/onboarding?role=brand', { replace: true })
          } else {
            navigate(`/get-started?role=${role}`, { replace: true })
          }
        }}
      >
        Continue
      </Button>
    </div>
  )
}

export default function Onboarding() {
  const { profile, profileLoading, session } = useAuth()
  const [params] = useSearchParams()
  const requestedRole = params.get('role')

  if (profileLoading) return <FullPageLoader />

  // Self-serve brand signup - no auth required
  if (!session && requestedRole === 'brand') {
    return (
      <>
        <Seo title="Create your brand account" noindex />
        <div className="min-h-dvh bg-canvas">
          <header className="border-b border-line bg-canvas/85 backdrop-blur-md">
            <div className="container-page flex h-(--header-height) items-center justify-between">
              <Logo />
            </div>
          </header>
          <main id="main" className="container-page flex justify-center py-10 sm:py-16">
            <BrandOnboarding />
          </main>
        </div>
      </>
    )
  }

  // If user has no profile but is logged in, show role selection
  if (session && !profile) {
    return (
      <>
        <Seo title="Set up your account" noindex />
        <Frame>
          <RoleSelect />
        </Frame>
      </>
    )
  }

  // User has profile - handle onboarding based on role and completion status
  if (profile) {
    if (profile.status !== 'active') return <Navigate to="/" replace />
    if (profile.role === 'admin') return <Navigate to="/admin" replace />
    if (profile.role && profile.onboarding_completed) return <Navigate to={homeFor(profile.role)} replace />
    // User has role but hasn't completed onboarding - show appropriate onboarding form
    return (
      <>
        <Seo title="Set up your account" noindex />
        {!profile.role ? (
          <Frame>
            <RoleSelect />
          </Frame>
        ) : profile.role === 'brand' ? (
          <Frame>
            <React.Suspense fallback={<PageLoader />}>
              <BrandOnboarding />
            </React.Suspense>
          </Frame>
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

  // Fallback - redirect to home
  return <Navigate to="/" replace />
}
