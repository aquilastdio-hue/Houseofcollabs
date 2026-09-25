import { Link } from 'react-router'
import { ChevronRight, CircleCheck, ClipboardCheck, CreditCard, FilePen, Star, Truck, type LucideIcon } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { BrandDashboardStats } from '@/types'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { DashboardPanel, PanelRowsSkeleton } from './dashboard-panel'
import { useBrandDashboardStats } from './use-brand-stats'

type PendingKey = keyof BrandDashboardStats['pending_actions']

const ACTIONS: { key: PendingKey; label: string; description: string; href: string; icon: LucideIcon }[] = [
  {
    key: 'payment_pending',
    label: 'Complete payment',
    description: 'Orders are waiting for your payment',
    href: '/brand/orders?group=action',
    icon: CreditCard,
  },
  {
    key: 'awaiting_shipment',
    label: 'Ship products',
    description: 'Creators are waiting for your product',
    href: '/brand/orders?group=action',
    icon: Truck,
  },
  {
    key: 'awaiting_review',
    label: 'Review deliveries',
    description: 'Approve content or request a revision',
    href: '/brand/orders?group=action',
    icon: ClipboardCheck,
  },
  {
    key: 'draft_briefs',
    label: 'Finish draft briefs',
    description: 'Send them to creators when they’re ready',
    href: '/brand/briefs?status=draft',
    icon: FilePen,
  },
  {
    key: 'reviews_due',
    label: 'Leave reviews',
    description: 'Rate creators on completed orders',
    href: '/brand/orders?group=completed',
    icon: Star,
  },
]

export function PendingActionsPanel({ className }: { className?: string }) {
  const stats = useBrandDashboardStats()
  const pending = stats.data?.pending_actions
  const rows = pending ? ACTIONS.map((a) => ({ ...a, count: Number(pending[a.key] ?? 0) })).filter((a) => a.count > 0) : []
  const total = rows.reduce((sum, r) => sum + r.count, 0)

  return (
    <DashboardPanel
      title="Pending actions"
      className={className}
      badge={
        total > 0 ? (
          <Badge tone="brand" size="sm">
            {formatNumber(total)}
          </Badge>
        ) : undefined
      }
    >
      {stats.isPending ? (
        <PanelRowsSkeleton rows={3} />
      ) : stats.isError ? (
        <ErrorState compact error={stats.error} onRetry={() => void stats.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          className="flex-1"
          icon={<CircleCheck />}
          title="You’re all caught up"
          description="Payments, shipments, reviews and drafts that need you will show up here."
        />
      ) : (
        <ul className="-mx-2 divide-y divide-line">
          {rows.map((a) => (
            <li key={a.key}>
              <Link
                to={a.href}
                className="group focus-ring flex items-center gap-3 rounded-control px-2 py-3 transition-colors hover:bg-subtle"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-ink transition-colors group-hover:bg-surface">
                  <a.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.label}</span>
                  <span className="block truncate text-xs text-muted">{a.description}</span>
                </span>
                <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-pill bg-ink px-2 text-xs font-semibold text-brand tabular-nums">
                  <span aria-hidden>{formatNumber(a.count)}</span>
                  <span className="sr-only">{`${formatNumber(a.count)} pending`}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  )
}
