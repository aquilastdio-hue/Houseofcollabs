import { NavLink } from 'react-router'
import { AtSign, ShieldCheck, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { label: 'Profile', href: '/creator/settings/profile', icon: UserRound },
  { label: 'Social accounts', href: '/creator/settings/social', icon: AtSign },
  { label: 'Security', href: '/creator/settings/security', icon: ShieldCheck },
] as const

/** Sub-navigation shared by the creator settings pages (Profile, Social accounts, Security). */
export function CreatorSettingsNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Settings" className={cn('mb-6 sm:mb-8', className)}>
      <ul className="no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-pill bg-subtle p-1">
        {LINKS.map((link) => (
          <li key={link.href} className="shrink-0">
            <NavLink
              to={link.href}
              end
              className={({ isActive }) =>
                cn(
                  'focus-ring flex h-9 items-center gap-2 rounded-pill px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
                )
              }
            >
              <link.icon className="size-4" aria-hidden />
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
