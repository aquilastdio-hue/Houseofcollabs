import * as React from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { cn } from '@/lib/utils'
import { isNativeApp } from '@/lib/native'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { AppTopBar } from '@/components/layout/app-top-bar'
import { PageLoader } from '@/components/ui/spinner'

export default function PublicLayout() {
  return (
    // A taller header slot on the public site: the glass bar floats inside it with
    // room above and below. Everything that offsets by --header-height (sticky
    // sub-navs, the opening screen) follows automatically. The apps get a plain
    // top bar and no footer: they don't carry the marketing site.
    <div className={cn('flex min-h-dvh flex-col bg-canvas', !isNativeApp && '[--header-height:4.75rem]')}>
      {isNativeApp ? <AppTopBar /> : <Navbar />}
      <main id="main" className="flex-1">
        <React.Suspense fallback={<PageLoader />}>
          <Outlet />
        </React.Suspense>
      </main>
      {!isNativeApp && <Footer />}
      <ScrollRestoration />
    </div>
  )
}
