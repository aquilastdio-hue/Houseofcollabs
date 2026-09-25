import * as React from 'react'
import { Link } from 'react-router'
import { Activity, Building2, CheckCircle2, Flag, Gavel, IndianRupee, Landmark, RotateCcw, ShoppingBag, Users, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatINR, formatNumber } from '@/lib/format'
import { StatsCard } from '@/components/shared/stats-card'
import { Badge } from '@/components/ui/badge'
import type { AdminDashboardStats } from '@/types'
import { ACTIVE_ORDER_STATUSES, ordersHref } from './order-presets'

/** Whole-card link wrapper for stats that drill into a list. */
function StatLink({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'group focus-ring block rounded-card transition-transform duration-300 ease-spring hover:-translate-y-0.5 [&>div]:h-full [&>div]:transition-shadow [&>div]:duration-300 hover:[&>div]:shadow-card-hover',
        className,
      )}
    >
      {children}
    </Link>
  )
}

function InlineLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="focus-ring rounded-sm font-medium text-ink underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
      {children}
    </Link>
  )
}

/** KPI grid for the admin dashboard (GMV, revenue, orders, supply, payouts, trust & safety). */
export function DashboardStats({ stats, loading }: { stats?: AdminDashboardStats; loading: boolean }) {
  const s = stats
  const n = (v: number | undefined) => formatNumber(Number(v ?? 0))
  const money = (v: number | undefined) => formatINR(Number(v ?? 0))
  const pendingReview = Number(s?.creators_pending_review ?? 0)
  const refundsRequired = Number(s?.refunds_required ?? 0)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatsCard
        className="sm:col-span-2"
        tone="dark"
        label="Gross merchandise value"
        icon={<IndianRupee />}
        loading={loading}
        value={money(s?.gmv)}
        hint={
          <span>
            Net of refunds {money(s?.net_gmv)} · {money(s?.gmv_30d)} in the last 30 days
          </span>
        }
      />
      <StatsCard
        tone="brand"
        label="Platform revenue"
        icon={<Landmark />}
        loading={loading}
        value={money(s?.platform_revenue)}
        hint={<span className="text-brand-ink">Fees on completed orders · avg order {money(s?.avg_order_value)}</span>}
      />
      <StatLink to="/admin/orders">
        <StatsCard label="Orders" icon={<ShoppingBag />} loading={loading} value={n(s?.orders_total)} hint={`${n(s?.orders_30d)} in the last 30 days`} />
      </StatLink>
      <StatsCard
        label="Published creators"
        icon={<Users />}
        loading={loading}
        value={n(s?.creators_published)}
        hint={
          pendingReview > 0 ? (
            <span>
              <InlineLink to="/admin/creators?status=pending_review">{n(pendingReview)} pending review</InlineLink> · {n(s?.creators_total)} total
            </span>
          ) : (
            `No profiles waiting · ${n(s?.creators_total)} total`
          )
        }
      />
      <StatLink to="/admin/brands">
        <StatsCard label="Brands" icon={<Building2 />} loading={loading} value={n(s?.brands_total)} hint="Registered brand accounts" />
      </StatLink>
      <StatLink to={ordersHref({ statuses: ACTIVE_ORDER_STATUSES })}>
        <StatsCard label="Active collaborations" icon={<Activity />} loading={loading} value={n(s?.active_collaborations)} hint="Paid orders in progress" />
      </StatLink>
      <StatLink to={ordersHref({ statuses: ['completed'] })}>
        <StatsCard label="Completed orders" icon={<CheckCircle2 />} loading={loading} value={n(s?.completed_orders)} hint="Approved and closed" />
      </StatLink>
      <StatLink to="/admin/payouts">
        <StatsCard
          label="Pending payouts"
          icon={<Wallet />}
          loading={loading}
          value={n(s?.pending_payouts_count)}
          hint={`${money(s?.pending_payouts_amount)} requested or processing`}
        />
      </StatLink>
      <StatsCard
        label="Refunds"
        icon={<RotateCcw />}
        loading={loading}
        value={n(s?.refunds_count)}
        hint={
          <span className="flex flex-wrap items-center gap-1.5">
            {money(s?.refunds_amount)} refunded
            {refundsRequired > 0 ? (
              <Link to={ordersHref({ refund: true })} className="focus-ring rounded-pill">
                <Badge tone="danger" size="sm" dot>
                  {n(refundsRequired)} to refund
                </Badge>
              </Link>
            ) : (
              <span>· none pending</span>
            )}
          </span>
        }
      />
      <StatLink to="/admin/disputes">
        <StatsCard label="Open disputes" icon={<Gavel />} loading={loading} value={n(s?.disputes_open)} hint="Awaiting an admin decision" />
      </StatLink>
      <StatLink to="/admin/reports">
        <StatsCard label="Open reports" icon={<Flag />} loading={loading} value={n(s?.reports_open)} hint="Open or under review" />
      </StatLink>
    </div>
  )
}
