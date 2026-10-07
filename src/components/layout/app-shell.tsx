import * as React from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Menu, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useRealtimeStreams, useUnreadCounts } from '@/hooks/use-notifications'
import { Logo } from '@/components/shared/logo'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { PageLoader } from '@/components/ui/spinner'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { AccountMenu } from './account-menu'

export type NavChild = { label: string; href: string }

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  end?: boolean
  counter?: 'notifications'
  /** Nested links shown when this item (or a child) is active. */
  children?: NavChild[]
}

export type NavSection = { title?: string; items: NavItem[] }

function Counter({ value }: { value?: number }) {
  if (!value) return null
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-pill bg-ink px-1.5 text-[0.6875rem] font-semibold text-brand group-data-[active=true]:bg-brand group-data-[active=true]:text-white">
      {value > 99 ? '99+' : value}
    </span>
  )
}

function SideNav({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const counts = useUnreadCounts()
  const { pathname } = useLocation()
  return (
    <nav aria-label="Primary" className="flex flex-col gap-6">
      {sections.map((section, si) => (
        <div key={si}>
          {section.title && <p className="eyebrow mb-2 px-3 text-faint">{section.title}</p>}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const childOpen =
                !!item.children?.length &&
                (pathname === item.href || pathname.startsWith(`${item.href}/`) || item.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`)))
              return (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group focus-ring flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive || childOpen ? 'bg-ink text-white' : 'text-ink-soft hover:bg-subtle hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <span data-active={isActive || childOpen} className="group flex w-full items-center gap-3">
                        <item.icon className={cn('size-[1.125rem] shrink-0', isActive || childOpen ? 'text-brand' : 'text-muted group-hover:text-ink')} />
                        <span className="truncate">{item.label}</span>
                        {item.counter && <Counter value={counts.data?.[item.counter]} />}
                      </span>
                    )}
                  </NavLink>
                  {childOpen && item.children && (
                    <ul className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l border-line pl-2">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <NavLink
                            to={child.href}
                            end
                            onClick={onNavigate}
                            className={({ isActive }) =>
                              cn(
                                'focus-ring block rounded-control px-3 py-2 text-sm font-medium transition-colors',
                                isActive ? 'bg-subtle text-ink' : 'text-ink-soft hover:bg-subtle/70 hover:text-ink',
                              )
                            }
                          >
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/**
 * Sidebar application shell (creator + admin). Desktop: fixed sidebar.
 * Mobile: top bar with drawer navigation.
 */
export function SidebarShell({
  sections,
  homeHref,
  settingsHref,
  profileHref,
  notificationsHref,
  banner,
  badge,
}: {
  sections: NavSection[]
  homeHref: string
  settingsHref: string
  profileHref?: string
  notificationsHref: string
  banner?: React.ReactNode
  badge?: string
}) {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const { pathname } = useLocation()
  useRealtimeStreams(user?.id)
  React.useEffect(() => setOpen(false), [pathname])

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/70 px-4 py-5 lg:flex">
        <Link to={homeHref} className="focus-ring mb-8 flex items-center gap-2 rounded-md px-2">
          <Logo />
          {badge && <span className="rounded-pill bg-brand px-2 py-0.5 text-[0.6875rem] font-semibold text-white">{badge}</span>}
        </Link>
        <div className="no-scrollbar -mx-1 flex-1 overflow-y-auto px-1">
          <SideNav sections={sections} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-(--header-height) items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <Drawer open={open} onOpenChange={setOpen}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Open navigation">
                  <Menu />
                </Button>
              </DrawerTrigger>
              {/* No `description`: the drawer renders one visibly when given, and
                  "Navigation" under the logo was label for its own sake. Left
                  out, it falls back to the title as an sr-only description,
                  which is what a screen reader needs and Radix expects. */}
              <DrawerContent side="left" title={<Logo />}>
                <SideNav sections={sections} onNavigate={() => setOpen(false)} />
              </DrawerContent>
            </Drawer>
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1.5">
            <NotificationBell allHref={notificationsHref} />
            <AccountMenu settingsHref={settingsHref} profileHref={profileHref} />
          </div>
        </header>
        {banner}
        <main id="main" className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <React.Suspense fallback={<PageLoader />}>
              <Outlet />
            </React.Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}

/** Horizontal top-nav application shell (brand). Mobile: bottom tab bar. */
export function TopNavShell({
  items,
  mobileTabs,
  homeHref,
  settingsHref,
  profileHref,
  notificationsHref,
  footer,
  banner,
}: {
  items: NavItem[]
  mobileTabs: NavItem[]
  homeHref: string
  settingsHref: string
  profileHref?: string
  notificationsHref: string
  footer?: React.ReactNode
  banner?: React.ReactNode
}) {
  const { user } = useAuth()
  const counts = useUnreadCounts()
  useRealtimeStreams(user?.id)

  return (
    <div className="min-h-dvh bg-canvas pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        {/* Three flex children, with the two sides growing from a zero basis:
            while there is room they settle at equal widths, which puts the nav
            on the page's centre line instead of letting it drift with the logo
            or the account name. When room runs out they shrink back to their
            own content — the nav slides off-centre rather than the header
            overflowing, which is what equal-width grid tracks would have done.
            Below `md` the nav is hidden and the two sides fall to the edges. */}
        <div className="container-page flex h-(--header-height) items-center gap-4">
          <div className="flex flex-1 items-center">
            <Link to={homeHref} className="focus-ring shrink-0 rounded-md" aria-label="Dashboard">
              <Logo />
            </Link>
          </div>
          <nav aria-label="Primary" className="hidden shrink-0 md:block">
            <ul className="flex items-center gap-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'focus-ring relative flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-subtle hover:text-ink',
                      )
                    }
                  >
                    {item.label}
                    {item.counter && !!counts.data?.[item.counter] && (
                      <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-pill bg-brand px-1 text-[0.625rem] font-bold text-white">
                        {counts.data[item.counter]}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-1 items-center justify-end gap-1.5">
            <NotificationBell allHref={notificationsHref} />
            <AccountMenu settingsHref={settingsHref} profileHref={profileHref} />
          </div>
        </div>
      </header>
      {banner}
      <main id="main" className="container-page py-6 sm:py-8">
        <React.Suspense fallback={<PageLoader />}>
          <Outlet />
        </React.Suspense>
      </main>
      {footer}
      <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-5">
          {mobileTabs.map((item) => (
            <li key={item.href}>
              <NavLink
                to={item.href}
                end={item.end}
                className={({ isActive }) =>
                  cn('flex flex-col items-center gap-0.5 py-2.5 text-[0.6875rem] font-medium', isActive ? 'text-ink' : 'text-faint')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('relative flex h-7 w-12 items-center justify-center rounded-pill transition-colors', isActive && 'bg-brand')}>
                      <item.icon className="size-5" />
                      {item.counter && !!counts.data?.[item.counter] && <span className="absolute top-0.5 right-2 size-2 rounded-full bg-danger" />}
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
