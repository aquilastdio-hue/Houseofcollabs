import * as React from 'react'
import { NavLink } from 'react-router'
import { Building2, Contact, Receipt, ShieldCheck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'

export const BRAND_SETTINGS_LINKS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Profile', href: '/brand/settings/profile', icon: Building2 },
  { label: 'Contact', href: '/brand/settings/contact', icon: Contact },
  { label: 'Security', href: '/brand/settings/security', icon: ShieldCheck },
  { label: 'Billing', href: '/brand/settings/billing', icon: Receipt },
]

/**
 * Brand settings sub-navigation: scrollable pills on mobile, a vertical list
 * from `lg` up. Shared by every `/brand/settings/*` page.
 */
export function BrandSettingsNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Settings" className={cn('min-w-0', className)}>
      <ul className="no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-pill bg-subtle p-1 lg:flex lg:w-full lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-none lg:bg-transparent lg:p-0">
        {BRAND_SETTINGS_LINKS.map((link) => (
          <li key={link.href} className="shrink-0">
            <NavLink
              to={link.href}
              className={({ isActive }) =>
                cn(
                  'focus-ring flex h-9 items-center gap-2 rounded-pill px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  'lg:h-auto lg:rounded-control lg:px-3 lg:py-2.5',
                  isActive
                    ? 'bg-surface text-ink shadow-card lg:bg-ink lg:text-white lg:shadow-none'
                    : 'text-muted hover:text-ink lg:text-ink-soft lg:hover:bg-subtle',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <link.icon className={cn('size-4 shrink-0', isActive ? 'lg:text-brand' : 'text-muted')} aria-hidden />
                  {link.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Page header + settings nav + content column used by the brand settings pages. */
export function BrandSettingsLayout({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <PageHeader eyebrow="Settings" title={title} description={description} actions={actions} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        <BrandSettingsNav className="lg:sticky lg:top-[calc(var(--header-height)_+_2rem)] lg:self-start" />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </>
  )
}
