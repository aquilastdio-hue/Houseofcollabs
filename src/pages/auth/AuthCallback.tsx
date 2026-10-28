import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { destinationAfterLogin } from '@/lib/auth-destination'
import { establishSessionFromLink, readAuthLink } from '@/lib/auth-link'
import { SUSPENDED_SIGN_IN_MESSAGE } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { PageLoader } from '@/components/ui/spinner'
import { Seo } from '@/components/shared/seo'

/**
 * OAuth + email-confirmation landing.
 *
 * Exchanges the link (PKCE code, hash tokens, or OTP), waits for the profile,
 * then sends existing accounts to their dashboard and new ones to onboarding.
 */
export default function AuthCallback() {
  const { initializing, session, profile, profileLoading } = useAuth()
  const navigate = useNavigate()
  const params = React.useMemo(() => new URLSearchParams(window.location.search), [])
  const hashParams = React.useMemo(() => new URLSearchParams(window.location.hash.replace(/^#/, '')), [])
  const rawUrlError = params.get('error_description') ?? hashParams.get('error_description')
  const errorFromUrl = rawUrlError && /banned/i.test(rawUrlError) ? SUSPENDED_SIGN_IN_MESSAGE : rawUrlError
  const [linkError, setLinkError] = React.useState<string | null>(null)
  const [timedOut, setTimedOut] = React.useState(false)
  const handled = React.useRef(false)
  const linkStarted = React.useRef(false)

  React.useEffect(() => {
    if (linkStarted.current) return
    linkStarted.current = true
    const link = readAuthLink()
    if (!link) return
    void establishSessionFromLink(link).then((result) => {
      if (!result.ok) setLinkError(result.reason)
    })
  }, [])

  React.useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 10000)
    return () => window.clearTimeout(t)
  }, [])

  React.useEffect(() => {
    if (handled.current || initializing || !session || profileLoading) return
    handled.current = true
    const redirect = params.get('redirect')
    navigate(
      destinationAfterLogin({
        redirect,
        role: profile?.role,
        onboarded: profile?.onboarding_completed ?? false,
      }),
      { replace: true },
    )
  }, [initializing, session, profile, profileLoading, navigate, params])

  const errorDescription = errorFromUrl ?? linkError

  if (errorDescription || (timedOut && !session)) {
    return (
      <div className="text-center">
        <Seo title="Sign-in problem" noindex />
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-display-md font-semibold">We couldn’t sign you in</h1>
        <p className="mt-2 text-muted">
          {errorDescription ?? 'The link may have expired or was opened in a different browser. Please try again.'}
        </p>
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
