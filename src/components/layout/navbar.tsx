import * as React from 'react'
import { Link, useLocation } from 'react-router'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publicNav } from '@/config/site'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Logo } from '@/components/shared/logo'

/**
 * Extra sections each nav item owns. Category pages are part of browsing, so
 * "Discover" stays lit there. Everything else matches its own path exactly —
 * a creator storefront (/creators/:slug) is not the "For Creators" page.
 */
const NAV_SECTIONS: Record<string, string[]> = {
  '/discover': ['/categories'],
}

function isNavActive(href: string, pathname: string) {
  if (pathname === href) return true
  return (NAV_SECTIONS[href] ?? []).some((base) => pathname === base || pathname.startsWith(`${base}/`))
}

export function Navbar({ variant = 'light' }: { variant?: 'light' | 'transparent' }) {
  const [scrolled, setScrolled] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const { pathname } = useLocation()

  React.useEffect(() => setOpen(false), [pathname])
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled || variant === 'light' ? 'border-b border-line/70 bg-canvas/85 backdrop-blur-md' : 'border-b border-transparent',
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      {/* Full-bleed rather than `container-page`: the page container is centred
          at its max width, so a logo inside it can only ever reach that edge —
          on a wide screen that leaves a gap the page itself creates. The header
          spans the window instead, so the logo sits hard left and the actions
          hard right at every size. */}
      <nav className="flex h-(--header-height) w-full items-center justify-between gap-6 px-gutter" aria-label="Main">
        {/* Two invisible things pad the left of this logo: the artwork's own
            ~10px side margin, and the slack `scale-x` leaves inside a box that
            keeps its width. Cancelling just those puts the first inked pixel on
            the page gutter — the same line the content below starts from — so
            it reads as deliberate rather than either indented or jammed against
            the edge. The number tracks the logo height, which steps up at `sm`. */}
        <Link
          to="/"
          className="focus-ring -ml-[18px] rounded-md sm:-ml-[19px]"
          aria-label="House of Collabs home"
        >
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {publicNav.map((item) => {
            const active = isNavActive(item.href, pathname)
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'focus-ring rounded-pill px-4 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-brand-soft text-brand-ink' : 'text-ink-soft hover:bg-subtle hover:text-ink',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* The public site looks the same to everyone. A signed-in visitor who
            taps either of these is forwarded to their dashboard by the
            `GuestOnly` guard, so no route is lost by dropping the shortcut. */}
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/get-started">Create your profile</Link>
          </Button>
        </div>

        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </DrawerTrigger>
          <DrawerContent side="right" title={<Logo />} description="Navigation">
            <ul className="flex flex-col gap-1">
              {publicNav.map((item) => {
                const active = isNavActive(item.href, pathname)
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'block rounded-control px-3 py-3 font-display text-xl font-medium transition-colors',
                        active ? 'bg-brand-soft text-brand-ink' : 'hover:bg-subtle',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="mt-8 flex flex-col gap-2">
              <Button asChild variant="accent" size="lg" block>
                <Link to="/get-started">Create your profile</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" block>
                <Link to="/login">Log in</Link>
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </nav>
    </header>
  )
}
