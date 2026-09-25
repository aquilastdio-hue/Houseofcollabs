import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/logo'

/** Global route error boundary: 404s, failed lazy chunks and render errors. */
export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const chunkFailed = error instanceof Error && /dynamically imported module|Loading chunk|Failed to fetch/i.test(error.message)
  if (import.meta.env.DEV) console.error(error)

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="container-page flex h-(--header-height) items-center">
        <Link to="/" aria-label="Home">
          <Logo />
        </Link>
      </header>
      <main id="main" className="container-page flex flex-1 items-center justify-center py-16">
        <div className="max-w-md text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand text-white">
            <AlertTriangle className="size-6" />
          </span>
          <h1 className="mt-5 font-display text-display-md font-semibold">
            {notFound ? 'Page not found' : chunkFailed ? 'A new version is available' : 'Something went wrong'}
          </h1>
          <p className="mt-2 text-muted">
            {notFound
              ? 'The page you’re looking for doesn’t exist or has moved.'
              : chunkFailed
                ? 'We updated House of Collabs while you were browsing. Reload to get the latest version.'
                : 'An unexpected error occurred. Please try again — if it keeps happening, contact support.'}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              <RefreshCw /> Reload
            </Button>
            <Button asChild>
              <Link to="/">Go home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
