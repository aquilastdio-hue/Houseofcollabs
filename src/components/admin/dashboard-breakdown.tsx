import { Link } from 'react-router'
import { ChevronRight, Flag, Gavel, Package, RotateCcw, UserCheck, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatINR, formatNumber } from '@/lib/format'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { EmptyState } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/skeleton'
import type { AdminDashboardStats, OrderStatus } from '@/types'
import { ORDER_STATUSES, ordersHref } from './order-presets'

/** Horizontal bars: how many orders sit in each status right now. */
export function OrdersByStatus({ stats, loading }: { stats?: AdminDashboardStats; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    )
  }
  const byStatus = stats?.orders_by_status ?? {}
  const rows = ORDER_STATUSES.map((status: OrderStatus) => ({ status, count: Number(byStatus[status] ?? 0) })).filter((r) => r.count > 0)
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Package />}
        title="No orders yet"
        description="Once brands start checking out, you’ll see where every order stands."
        className="border-0 bg-transparent"
      />
    )
  }
  const max = Math.max(...rows.map((r) => r.count), 1)
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  return (
    <ul className="space-y-1" aria-label={`Orders by status, ${formatNumber(total)} in total`}>
      {rows.map((r) => (
        <li key={r.status}>
          {/* Phones: badge + count on one row, bar spanning a second row. The old
              `minmax(8.5rem,auto)` first column let the nowrap badge set the width,
              which pushed the whole dashboard past a 360px screen. */}
          <Link
            to={ordersHref({ statuses: [r.status] })}
            className="focus-ring grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-control px-2 py-2 transition-colors hover:bg-subtle sm:grid-cols-[10rem_1fr_3.5rem] sm:gap-y-0"
          >
            <span className="col-start-1 row-start-1 min-w-0">
              <OrderStatusBadge status={r.status} size="sm" />
            </span>
            <span
              className="col-span-2 col-start-1 row-start-2 h-2 overflow-hidden rounded-pill bg-subtle sm:col-span-1 sm:col-start-2 sm:row-start-1"
              aria-hidden
            >
              <span className="block h-full rounded-pill bg-ink" style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }} />
            </span>
            <span className="col-start-2 row-start-1 text-right text-sm font-medium tabular-nums sm:col-start-3">
              {formatNumber(r.count)}
              <span className="sr-only"> orders</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

type QuickLink = { to: string; label: string; hint: string; count: number; icon: typeof Package; urgent?: boolean }

/** Work queues that usually need an admin today. */
export function QuickLinks({ stats, loading }: { stats?: AdminDashboardStats; loading: boolean }) {
  const s = stats
  const links: QuickLink[] = [
    {
      to: '/admin/creators?status=pending_review',
      label: 'Creator reviews',
      hint: 'Profiles waiting for approval',
      count: Number(s?.creators_pending_review ?? 0),
      icon: UserCheck,
    },
    {
      to: ordersHref({ refund: true }),
      label: 'Refund queue',
      hint: 'Cancelled paid orders to refund',
      count: Number(s?.refunds_required ?? 0),
      icon: RotateCcw,
      urgent: true,
    },
    {
      to: '/admin/disputes',
      label: 'Open disputes',
      hint: 'Brand ↔ creator disagreements',
      count: Number(s?.disputes_open ?? 0),
      icon: Gavel,
      urgent: true,
    },
    {
      to: '/admin/payouts',
      label: 'Payout requests',
      hint: `${formatINR(Number(s?.pending_payouts_amount ?? 0))} waiting`,
      count: Number(s?.pending_payouts_count ?? 0),
      icon: Wallet,
    },
    {
      to: '/admin/reports',
      label: 'Reports',
      hint: 'Flagged profiles, messages and content',
      count: Number(s?.reports_open ?? 0),
      icon: Flag,
    },
  ]
  return (
    <ul className="space-y-2">
      {links.map((l) => (
        <li key={l.label}>
          <Link
            to={l.to}
            className="group focus-ring flex items-center gap-3 rounded-control border border-line bg-surface p-3 transition-colors hover:border-line-strong hover:bg-subtle/60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-ink">
              <l.icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{l.label}</span>
              <span className="block truncate text-xs text-muted">{l.hint}</span>
            </span>
            {loading ? (
              <Skeleton className="h-6 w-8 rounded-pill" />
            ) : (
              <span
                className={cn(
                  'shrink-0 rounded-pill px-2.5 py-0.5 text-sm font-semibold tabular-nums',
                  l.count > 0 ? (l.urgent ? 'bg-danger-soft text-danger' : 'bg-brand text-white') : 'bg-subtle text-muted',
                )}
              >
                {formatNumber(l.count)}
              </span>
            )}
            <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
