import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { destinationAfterLogin } from '@/lib/auth-destination'
import { setInitialRole } from '@/services/auth.service'
import { recordAuthEvent } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import { PageLoader } from '@/components/ui/spinner'
import { Seo } from '@/components/shared/seo'

/**
 * OAuth + email-confirmation landing. supabase-js exchanges the PKCE code
 * automatically; we then apply the role picked at signup (OAuth only) and
 * route the user to onboarding or their workspace.
 */
export default function AuthCallback() {
  const { initializing, session, profile, profileLoading, refresh } = useAuth()
  const navigate = useNavigate()
  const params = React.useMemo(() => new URLSearchParams(window.location.search), [])
  const hashParams = React.useMemo(() => new URLSearchParams(window.location.hash.replace(/^#/, '')), [])
  const errorDescription = params.get('error_description') ?? hashParams.get('error_description')
  const [timedOut, setTimedOut] = React.useState(false)
  const handled = React.useRef(false)

  React.useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 8000)
    return () => window.clearTimeout(t)
  }, [])

  React.useEffect(() => {
    if (handled.current || initializing || !session || profileLoading || !profile) return
    handled.current = true
    void (async () => {
      const requested = params.get('role')
      if (!profile.role && (requested === 'brand' || requested === 'creator')) {
        try {
          await setInitialRole(requested)
          await refresh()
        } catch {
          // role may already be set; onboarding will ask otherwise
        }
      }
      void recordAuthEvent('login')
      const role = profile.role ?? (requested === 'brand' || requested === 'creator' ? requested : null)
      // `?redirect` wins over the account's own home, whether or not onboarding
      // is finished. It used to be gated on `onboarding_completed`, which
      // quietly dropped the destination for anyone mid-setup and dumped them in
      // the onboarding form — so Collabs / Creators → Google never reached its
      // coming-soon page.
      navigate(
        destinationAfterLogin({ redirect: params.get('redirect'), role, onboarded: profile.onboarding_completed }),
        { replace: true },
      )
    })()
  }, [initializing, session, profile, profileLoading, params, navigate, refresh])

  if (errorDescription || (timedOut && !session)) {
    return (
      <div className="text-center">
        <Seo title="Sign-in problem" noindex />
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-display-md font-semibold">We couldn’t sign you in</h1>
        <p className="mt-2 text-muted">{errorDescription ?? 'The link may have expired or was opened in a different browser. Please try again.'}</p>
        <Button asChild className="mt-6">
          <Link to="/login">Back to log in</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <Seo title="Signing you in" noindex />
      <PageLoader label="Signing you in" />
    </>
  )
}
