import * as React from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowRight, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publicNav } from '@/config/site'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Logo } from '@/components/shared/logo'

/**
 * Extra sections each nav item owns. Category pages and individual storefronts
 * are both part of browsing creators, so "Creators" stays lit across
 * /categories/:slug and /creators/:slug as well as /discover itself.
 */
const NAV_SECTIONS: Record<string, string[]> = {
  '/discover': ['/categories', '/creators'],
}

/**
 * The query keys the nav uses to tell its own items apart.
 *
 * Three items point at /discover and differ only by filter, so comparing the
 * path alone would light "Creators" on all of them and "Collaboration" on none.
 * An item is active when the path matches *and* every one of these keys agrees
 * — including when both sides have none, which is what keeps plain /discover
 * lit only on the unfiltered listing.
 */
const NAV_QUERY_KEYS = [...new Set(publicNav.flatMap((i) => [...new URLSearchParams(i.href.split('?')[1] ?? '').keys()]))]

function isNavActive(href: string, pathname: string, search: string) {
  const [path, query = ''] = href.split('?')
  const wanted = new URLSearchParams(query)
  const current = new URLSearchParams(search)
  const queryMatches = NAV_QUERY_KEYS.every((k) => (wanted.get(k) ?? null) === (current.get(k) ?? null))
  if (pathname === path) return queryMatches
  // A section match ignores the query: a storefront or category page has none
  // of these filters, and should still light the listing it belongs to.
  return (NAV_SECTIONS[path] ?? []).some((base) => pathname === base || pathname.startsWith(`${base}/`))
}

export function Navbar() {
  const [scrolled, setScrolled] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const { pathname, search } = useLocation()

  React.useEffect(() => setOpen(false), [pathname])
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // At the very top the glass is at its clearest; once the page moves under
  // it, it frosts over so the links stay readable on any content.
  const solid = scrolled

  return (
    // The bar is a floating glass island rather than a full-width strip: the
    // header itself is transparent and lets clicks through, and only the pill
    // inside it is painted. Whatever scrolls underneath (on the homepage, the
    // opening screen's moving colour) shows through the frosted glass.
    <header className="pointer-events-none sticky top-0 z-40 flex h-(--header-height) w-full items-center px-gutter">
      <a
        href="#main"
        className="pointer-events-auto sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      {/* As wide as the page content, so the island's edges line up with the
          sections below; on wide screens it draws in a little once you scroll. */}
      <nav
        aria-label="Main"
        className={cn(
          'pointer-events-auto relative isolate mx-auto flex h-14 w-full max-w-[calc(var(--container-page)_-_2*var(--spacing-gutter))] items-center gap-4 rounded-pill pr-2 pl-2 lg:pl-5',
          'border border-white/70 bg-surface/95 supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150',
          'transition-[max-width,background-color,box-shadow] duration-500 ease-spring',
          solid
            ? 'shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_12px_40px_-16px_rgb(23_13_31/0.32)] supports-[backdrop-filter]:bg-white/72 xl:max-w-5xl'
            : 'shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_8px_30px_-18px_rgb(23_13_31/0.24)] supports-[backdrop-filter]:bg-white/50',
        )}
      >
        {/* Light catching the glass: a sheen across the top-left, and a hairline
            of the brand gradient along the bottom edge. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-pill bg-[linear-gradient(115deg,rgb(255_255_255/0.6),rgb(255_255_255/0)_38%,rgb(255_255_255/0)_70%,rgb(255_255_255/0.28))]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-10 -bottom-px h-px bg-[linear-gradient(90deg,transparent,rgb(225_48_108/0.55),rgb(131_58_180/0.5),transparent)]"
        />

        {/* The two sides grow from a zero basis, so while there is room they
            settle at equal widths and the links sit on the bar's centre line.
            When room runs short they shrink back to their own content and the
            links drift rather than the bar overflowing. Below `lg` the same
            balance centres the logo instead, between the menu button and Join. */}
        <div className="flex flex-1 items-center">
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="hover:bg-white/70 lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </DrawerTrigger>
            {/* No `description`: it renders visibly when given, and "Navigation"
                under the logo labelled the obvious. Left out, it falls back to
                the title as an sr-only description — what Radix needs and what a
                screen reader should hear. Opens from the left, the side its
                button is on. Matches the admin shell. */}
            <DrawerContent
              side="left"
              title={<Logo />}
              className="supports-[backdrop-filter]:bg-surface/80 supports-[backdrop-filter]:backdrop-blur-2xl supports-[backdrop-filter]:backdrop-saturate-150"
            >
              <ul className="flex flex-col gap-1">
                {publicNav.map((item) => {
                  const active = isNavActive(item.href, pathname, search)
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
                <Button asChild size="lg" block>
                  <Link to="/get-started">
                    Create your profile <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg" block>
                  <Link to="/login">Log in</Link>
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
          <Link to="/" className="focus-ring hidden rounded-pill lg:block" aria-label="House of Collabs home">
            {/* A touch smaller than elsewhere, so the wordmark sits inside the glass with room around it. */}
            <Logo className="[&>span]:h-10" />
          </Link>
        </div>

        {/* Phones and tablets: the logo sits on the centre line, between the
            menu button and Join. */}
        <Link to="/" className="focus-ring shrink-0 rounded-pill lg:hidden" aria-label="House of Collabs home">
          <Logo className="[&>span]:h-10" />
        </Link>

        {/* `lg`, not `md`. At 768px the logo, four nav links and the two auth
            buttons came to 775px and pushed the page into a horizontal scroll.
            A tablet gets the drawer instead; the full bar returns at 1024.
            The links share a recessed glass track; the current page is the
            chip that stands out of it. */}
        <ul className="hidden shrink-0 items-center gap-0.5 rounded-pill bg-white/35 p-1 shadow-[inset_0_1px_2px_rgb(23_13_31/0.06)] ring-1 ring-white/60 lg:flex">
          {publicNav.map((item) => {
            const active = isNavActive(item.href, pathname, search)
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'focus-ring block rounded-pill px-4 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200',
                    active
                      ? 'bg-white text-brand-ink shadow-[0_1px_2px_rgb(23_13_31/0.08),0_4px_12px_-6px_rgb(225_48_108/0.45)]'
                      : 'text-ink-soft hover:bg-white/60 hover:text-ink',
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
        <div className="flex flex-1 items-center justify-end gap-1.5">
          <Button asChild variant="ghost" size="sm" className="hidden hover:bg-white/70 lg:inline-flex">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="group">
            <Link to="/get-started">
              <span className="lg:hidden">Join</span>
              <span className="hidden lg:inline">Create your profile</span>
              <ArrowRight className="hidden transition-transform duration-300 ease-spring group-hover:translate-x-0.5 sm:block" aria-hidden />
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  )
}
