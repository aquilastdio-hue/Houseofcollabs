import { Link, ScrollRestoration } from 'react-router'
import {
  Bell,
  FileText,
  Images,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  Tags,
  TrendingUp,
  UserRound,
  Wallet,
} from 'lucide-react'
import { SidebarShell, type NavSection } from '@/components/layout/app-shell'
import { useAuth } from '@/contexts/auth-context'

const sections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/creator', icon: LayoutDashboard, end: true },
      { label: 'Orders', href: '/creator/orders', icon: Package },
      { label: 'Messages', href: '/creator/messages', icon: MessageSquare, counter: 'messages' },
      { label: 'Briefs', href: '/creator/briefs', icon: FileText },
    ],
  },
  {
    title: 'Storefront',
    items: [
      { label: 'Profile', href: '/creator/profile', icon: UserRound },
      { label: 'Portfolio', href: '/creator/portfolio', icon: Images },
      { label: 'Services', href: '/creator/services', icon: Tags },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Earnings', href: '/creator/earnings', icon: TrendingUp },
      { label: 'Payouts', href: '/creator/payouts', icon: Wallet },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Notifications', href: '/creator/notifications', icon: Bell, counter: 'notifications' },
      { label: 'Settings', href: '/creator/settings/profile', icon: Settings },
    ],
  },
]

function StatusBanner() {
  const { creator } = useAuth()
  if (!creator || creator.status === 'published') return null
  const map = {
    draft: { tone: 'bg-brand-soft text-brand-ink', text: 'Your storefront is a draft. Finish your profile and publish it to start receiving orders.', cta: 'Finish profile', href: '/onboarding' },
    pending_review: { tone: 'bg-info-soft text-info', text: 'Your profile is under review. We’ll notify you as soon as it’s live.', cta: 'Preview profile', href: '/creator/profile' },
    rejected: { tone: 'bg-warning-soft text-warning', text: `Your profile needs changes: ${creator.rejection_reason ?? 'please review your details.'}`, cta: 'Update profile', href: '/creator/profile' },
    suspended: { tone: 'bg-danger-soft text-danger', text: `Your profile is suspended${creator.rejection_reason ? `: ${creator.rejection_reason}` : '.'} Contact support for help.`, cta: 'Contact support', href: '/contact' },
  } as const
  const m = map[creator.status]
  return (
    <div className={`${m.tone} border-b border-line px-4 py-2.5 text-sm sm:px-6 lg:px-8`} role="status">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p>{m.text}</p>
        <Link to={m.href} className="font-semibold underline underline-offset-2">
          {m.cta}
        </Link>
      </div>
    </div>
  )
}

export default function CreatorLayout() {
  return (
    <>
      <SidebarShell
        sections={sections}
        homeHref="/creator"
        settingsHref="/creator/settings/profile"
        profileHref="/creator/profile"
        notificationsHref="/creator/notifications"
        banner={<StatusBanner />}
      />
      <ScrollRestoration />
    </>
  )
}
