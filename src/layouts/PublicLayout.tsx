import * as React from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { PageLoader } from '@/components/ui/spinner'

export default function PublicLayout() {
  return (
    // A taller header slot on the public site: the glass bar floats inside it with
    // room above and below. Everything that offsets by --header-height (sticky
    // sub-navs, the opening screen) follows automatically.
    <div className="flex min-h-dvh flex-col bg-canvas [--header-height:4.75rem]">
      <Navbar />
      <main id="main" className="flex-1">
        <React.Suspense fallback={<PageLoader />}>
          <Outlet />
        </React.Suspense>
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  )
}
