import * as React from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { Seo } from '@/components/shared/seo'
import { finishInstagramConnect, saveConnectResult } from '@/lib/instagram-connect'

/**
 * Where Instagram sends a creator back after "Connect Instagram". Checks the
 * state, has the server exchange the code, leaves the outcome for the sign-up
 * form, and returns there — straight to the Instagram page.
 *
 * Its URL is the OAuth redirect URI registered in the Meta App Dashboard.
 */
export default function InstagramCallback() {
  const location = useLocation()
  const navigate = useNavigate()
  const started = React.useRef(false)

  React.useEffect(() => {
    // The code is single-use: StrictMode's second run must not spend it again.
    if (started.current) return
    started.current = true
    void finishInstagramConnect(new URLSearchParams(location.search)).then(({ result, returnTo }) => {
      saveConnectResult(result)
      const target = new URL(returnTo, window.location.origin)
      target.searchParams.set('instagram', '1')
      navigate(`${target.pathname}${target.search}`, { replace: true })
    })
  }, [location.search, navigate])

  return (
    <>
      <Seo title="Connecting Instagram" noindex />
      <div className="container-page flex min-h-[50vh] flex-col items-center justify-center gap-3 py-16 text-center" role="status">
        <Loader2 className="size-6 animate-spin text-muted" aria-hidden />
        <p className="text-sm text-muted">Connecting your Instagram…</p>
      </div>
    </>
  )
}
