import * as React from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarClock,
  ExternalLink,
  Eye,
  FileText,
  Heart,
  IndianRupee,
  Megaphone,
  Package,
  PartyPopper,
  Pencil,
  Percent,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDate, formatINR, formatNumber, formatPercent } from '@/lib/format'
import { ACTIVE_STATUSES, needsActionStatuses } from '@/lib/order-state'
import { useAuth } from '@/contexts/auth-context'
import { useOrders } from '@/hooks/use-orders'
import { getCreatorDashboardStats } from '@/services/analytics.service'
import { getEarningsSummary } from '@/services/earnings.service'
import { listBriefs, type BriefListParams } from '@/services/briefs.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { PageHeader, SectionTitle } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { StatsCard } from '@/components/shared/stats-card'
import { AreaTrend, ChartCard } from '@/components/shared/chart'
import { OrderCard } from '@/components/orders/order-card'
import { CompletionCard } from '@/components/creator-studio/completion-card'
import { NextStepsCards } from '@/components/creator-studio/next-steps'
import { CreatorSetupRequired, ListSkeleton } from '@/components/creator-studio/parts'
import type { OrderStatus } from '@/types'

const NEEDS_ACTION = needsActionStatuses('creator')
/** Active orders where the next move is the brand's (no overlap with "needs your attention"). */
const WAITING_ON_BRAND: OrderStatus[] = ACTIVE_STATUSES.filter((s) => !NEEDS_ACTION.includes(s))

function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function ViewAll({ to, label = 'View all' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="focus-ring inline-flex items-center gap-1 rounded text-sm font-medium text-ink underline-offset-2 hover:underline">
      {label} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  )
}

function Panel({ title, action, children, className }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className={cn('rounded-card border border-line bg-surface p-5 shadow-card', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="font-display text-base font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function useDashboardStats() {
  return useQuery({ queryKey: qk.dashboard.creator, queryFn: getCreatorDashboardStats })
}

function StatsGrid() {
  const stats = useDashboardStats()
  if (stats.isError) return <ErrorState error={stats.error} title="Couldn’t load your stats" onRetry={() => void stats.refetch()} />
  const s = stats.data
  const loading = stats.isPending
  const delta = s && s.profile_views_prev_30d > 0 ? ((s.profile_views_30d - s.profile_views_prev_30d) / s.profile_views_prev_30d) * 100 : null

  return (
    <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatsCard
          label="Profile views"
          icon={<Eye />}
          loading={loading}
          value={formatNumber(s?.profile_views_30d)}
          delta={delta}
          hint={s ? (delta != null ? 'vs previous 30 days' : 'Last 30 days') : undefined}
        />
        <StatsCard label="Wishlist adds" icon={<Heart />} loading={loading} value={formatNumber(s?.wishlist_adds)} hint={s ? 'Brands that saved you' : undefined} />
        <StatsCard
          label="Active orders"
          icon={<Package />}
          loading={loading}
          value={formatNumber(s?.orders_active)}
          hint={s ? (s.orders_pending_acceptance > 0 ? `${formatNumber(s.orders_pending_acceptance)} awaiting your acceptance` : `${formatNumber(s.completed_orders)} completed`) : undefined}
        />
        <StatsCard label="Pending deliveries" icon={<Truck />} loading={loading} value={formatNumber(s?.pending_deliveries)} hint={s ? 'Orders you need to deliver' : undefined} />
        <StatsCard
          tone="dark"
          label="Earnings"
          icon={<IndianRupee />}
          loading={loading}
          value={formatINR(s?.revenue_total)}
          hint={s ? `${formatINR(s.revenue_30d)} in the last 30 days` : undefined}
        />
        <StatsCard label="Conversion rate" icon={<Percent />} loading={loading} value={formatPercent(s?.conversion_rate)} hint={s ? 'Orders per profile view' : undefined} />
        <StatsCard
          tone="brand"
          label="New opportunities"
          icon={<Megaphone />}
          loading={loading}
          value={formatNumber(s?.new_opportunities)}
          hint={s ? 'Briefs waiting for your reply' : undefined}
        />
    </section>
  )
}

function ViewsChart() {
  const stats = useDashboardStats()
  // Errors are reported once, by the stats grid.
  if (stats.isError) return null
  const s = stats.data
  const views14 = s?.views_by_day.reduce((sum, d) => sum + Number(d.views), 0) ?? 0
  return (
    <ChartCard
      title="Profile views"
      description={
        s
          ? `Last 14 days · ${formatNumber(views14)} view${views14 === 1 ? '' : 's'}${views14 === 0 ? ' — share your storefront link to get discovered' : ''}`
          : 'Last 14 days'
      }
      loading={stats.isPending}
    >
      {s ? (
        <AreaTrend
          data={s.views_by_day}
          xKey="day"
          series={[{ key: 'views', label: 'Views', color: 'lilac' }]}
          xFormat={(d) => formatDate(d, 'd MMM')}
          format={(v) => formatNumber(v)}
        />
      ) : null}
    </ChartCard>
  )
}

function OrdersSection({
  creatorId,
  title,
  description,
  statuses,
  href,
  emptyTitle,
  emptyDescription,
}: {
  creatorId: string
  title: string
  description: string
  statuses: OrderStatus[]
  href: string
  emptyTitle: string
  emptyDescription: string
}) {
  const orders = useOrders({ creatorId, statuses, pageSize: 5 })
  const id = React.useId()
  const total = orders.data?.total ?? 0
  return (
    <section aria-labelledby={id}>
      <SectionTitle
        title={
          <span id={id} className="flex items-center gap-2">
            {title}
            {total > 0 && (
              <Badge tone="dark" size="sm">
                {formatNumber(total)}
              </Badge>
            )}
          </span>
        }
        description={description}
        action={total > 0 ? <ViewAll to={href} /> : undefined}
      />
      {orders.isPending ? (
        <ListSkeleton rows={2} itemClassName="h-24" />
      ) : orders.isError ? (
        <ErrorState compact error={orders.error} title="Couldn’t load orders" onRetry={() => void orders.refetch()} />
      ) : orders.data.items.length === 0 ? (
        <EmptyState compact icon={<PartyPopper />} title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="space-y-3">
          {orders.data.items.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} perspective="creator" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function EarningsSnapshot() {
  const summary = useQuery({ queryKey: qk.earnings.summary, queryFn: getEarningsSummary })
  return (
    <Panel title="Earnings" action={<ViewAll to="/creator/earnings" label="Details" />}>
      {summary.isPending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : summary.isError ? (
        <ErrorState compact error={summary.error} title="Couldn’t load earnings" onRetry={() => void summary.refetch()} />
      ) : (
        <>
          <p className="text-sm text-muted">Available to withdraw</p>
          <p className="font-display text-3xl font-semibold tabular-nums">{formatINR(summary.data.available)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div>
              <dt className="text-xs text-faint">Pending</dt>
              <dd className="font-medium tabular-nums">{formatINR(summary.data.pending)}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Paid out</dt>
              <dd className="font-medium tabular-nums">{formatINR(summary.data.paid)}</dd>
            </div>
          </dl>
          <Button asChild block variant={summary.data.available > 0 ? 'primary' : 'secondary'} className="mt-5">
            <Link to="/creator/payouts">Request payout</Link>
          </Button>
        </>
      )}
    </Panel>
  )
}

function BriefsPanel({ creatorId }: { creatorId: string }) {
  const params: BriefListParams = { scope: 'creator', ownerId: creatorId, status: 'sent', pageSize: 4 }
  const briefs = useQuery({ queryKey: qk.briefs.list(params), queryFn: () => listBriefs(params) })
  return (
    <Panel title="New briefs" action={<ViewAll to="/creator/briefs" />}>
      {briefs.isPending ? (
        <ListSkeleton rows={2} itemClassName="h-14 rounded-control" />
      ) : briefs.isError ? (
        <ErrorState compact error={briefs.error} title="Couldn’t load briefs" onRetry={() => void briefs.refetch()} />
      ) : briefs.data.items.length === 0 ? (
        <p className="flex items-center gap-2.5 text-sm text-muted">
          <FileText className="size-4 shrink-0" aria-hidden /> No new briefs right now. Brands can send you one from your storefront.
        </p>
      ) : (
        <ul className="-mx-2 space-y-1">
          {briefs.data.items.map((b) => (
            <li key={b.id}>
              <Link to={`/creator/briefs/${b.id}`} className="focus-ring flex items-center gap-3 rounded-control p-2 transition-colors hover:bg-subtle">
                <Avatar src={b.brand.brand_logo_url} name={b.brand.brand_name} size="md" shape="rounded" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.title}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted">
                    {b.brand.brand_name}
                    {b.deadline && (
                      <>
                        {' · '}
                        <CalendarClock className="size-3 shrink-0" aria-hidden /> {formatDate(b.deadline, 'd MMM')}
                      </>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{b.budget != null ? formatINR(b.budget) : 'Open'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export default function Dashboard() {
  const { creator } = useAuth()
  const firstName = creator?.display_name.trim().split(/\s+/)[0]

  return (
    <>
      <Seo title="Dashboard" noindex />
      <PageHeader
        eyebrow={formatDate(new Date(), 'EEEE, d MMMM')}
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description="Here’s what’s happening with your storefront."
        actions={
          creator?.status === 'published' ? (
            <Button asChild variant="secondary">
              <Link to={`/creators/${creator.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> View your storefront
              </Link>
            </Button>
          ) : creator ? (
            <Button asChild variant="secondary">
              <Link to="/creator/profile">
                <Pencil /> Edit profile
              </Link>
            </Button>
          ) : undefined
        }
      />

      {!creator ? (
        <CreatorSetupRequired />
      ) : (
        <div className="space-y-8">
          <NextStepsCards />
          <CompletionCard hideWhenComplete title="Complete your storefront" />
          <StatsGrid />
          <DashboardColumns creatorId={creator.id} />
        </div>
      )}
    </>
  )
}

function DashboardColumns({ creatorId }: { creatorId: string }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
      <div className="min-w-0 space-y-8 xl:col-span-2">
        <ViewsChart />
        <OrdersSection
          creatorId={creatorId}
          title="Needs your attention"
          description="Orders waiting on you — accept, start or deliver."
          statuses={NEEDS_ACTION}
          href="/creator/orders?tab=action"
          emptyTitle="You’re all caught up"
          emptyDescription="Nothing needs your attention right now."
        />
        <OrdersSection
          creatorId={creatorId}
          title="Active orders"
          description="Delivered, shipping or in review — waiting on the brand."
          statuses={WAITING_ON_BRAND}
          href="/creator/orders?tab=active"
          emptyTitle="No other active orders"
          emptyDescription="Orders waiting on a brand’s review or shipment show up here."
        />
      </div>
      <div className="min-w-0 space-y-6">
        <EarningsSnapshot />
        <BriefsPanel creatorId={creatorId} />
      </div>
    </div>
  )
}
