import * as React from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { PageLoader } from '@/components/ui/spinner'

export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
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
