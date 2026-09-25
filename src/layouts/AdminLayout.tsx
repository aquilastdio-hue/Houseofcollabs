import { ScrollRestoration } from 'react-router'
import {
  Bell,
  Building2,
  CreditCard,
  FileClock,
  Flag,
  FolderTree,
  Gavel,
  Image,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  Package,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  ListOrdered,
  Wallet,
} from 'lucide-react'
import { SidebarShell, type NavSection } from '@/components/layout/app-shell'

const sections: NavSection[] = [
  { items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, end: true }] },
  {
    title: 'Accounts',
    items: [
      { label: 'Applications', href: '/admin/applications', icon: Inbox },
      { label: 'People', href: '/admin/people', icon: Users },
      { label: 'Creators', href: '/admin/creators', icon: Sparkles },
      { label: 'Creator ranking', href: '/admin/creator-ranking', icon: ListOrdered },
      { label: 'Brands', href: '/admin/brands', icon: Building2 },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: Package },
      { label: 'Briefs', href: '/admin/briefs', icon: Megaphone },
      { label: 'Content', href: '/admin/content', icon: Image },
      { label: 'Categories', href: '/admin/categories', icon: FolderTree },
    ],
  },
  {
    title: 'Trust & safety',
    items: [
      { label: 'Disputes', href: '/admin/disputes', icon: Gavel },
      { label: 'Reports', href: '/admin/reports', icon: Flag },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Revenue', href: '/admin/finance', icon: TrendingUp },
      { label: 'Payments', href: '/admin/payments', icon: CreditCard },
      { label: 'Payouts', href: '/admin/payouts', icon: Wallet },
    ],
  },
  {
    title: 'Platform',
    items: [
      { label: 'Announcements', href: '/admin/notifications', icon: Bell, counter: 'notifications' },
      { label: 'Email log', href: '/admin/emails', icon: Mail },
      { label: 'Audit log', href: '/admin/audit-logs', icon: FileClock },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
]

export default function AdminLayout() {
  return (
    <>
      <SidebarShell
        sections={sections}
        homeHref="/admin"
        settingsHref="/admin/settings"
        notificationsHref="/admin/notifications"
        badge="Admin"
      />
      <ScrollRestoration />
    </>
  )
}
