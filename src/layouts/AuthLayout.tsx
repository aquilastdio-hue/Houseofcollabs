import * as React from 'react'
import { Link, Outlet, ScrollRestoration } from 'react-router'
import { Logo } from '@/components/shared/logo'
import { PageLoader } from '@/components/ui/spinner'

export default function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-5 py-6 sm:px-10">
      <Link to="/" className="focus-ring self-start rounded-md" aria-label="House of Collabs home">
        <Logo />
      </Link>
      <main id="main" className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">
          <React.Suspense fallback={<PageLoader />}>
            <Outlet />
          </React.Suspense>
        </div>
      </main>
      <p className="text-center text-xs text-faint">
        By continuing you agree to our{' '}
        <Link to="/terms" className="underline underline-offset-2 hover:text-ink">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-ink">
          Privacy Policy
        </Link>
        .
      </p>
      <ScrollRestoration />
    </div>
  )
}
