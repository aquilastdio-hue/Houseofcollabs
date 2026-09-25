import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Banknote, CreditCard, Landmark, RotateCcw, TrendingUp, Wallet } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatINR, formatNumber, formatPercent } from '@/lib/format'
import { getRevenueSummary, getTimeseries } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader, SectionTitle } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { ChartCard, AreaTrend, Bars } from '@/components/shared/chart'
import { ErrorState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PAYMENT_STATUS_META } from '@/components/admin/admin-status'
import { useUrlState } from '@/components/admin/use-url-state'

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '12 months' },
] as const

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** A single label/value line in the breakdown cards. */
function Row({ label, value, hint, strong }: { label: string; value: React.ReactNode; hint?: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className={strong ? 'text-sm font-medium' : 'text-sm text-muted'}>{label}</p>
        {hint && <p className="text-xs text-faint">{hint}</p>}
      </div>
      <p className={`shrink-0 tabular-nums ${strong ? 'font-display text-base font-semibold' : 'text-sm'}`}>{value}</p>
    </div>
  )
}

export default function Finance() {
  const url = useUrlState()
  const rangeRaw = url.get('range')
  const range = RANGES.some((r) => r.value === rangeRaw) ? rangeRaw : '30'
  const days = Number(range)

  const revenue = useQuery({ queryKey: qk.admin.revenue, queryFn: getRevenueSummary, staleTime: 60_000 })
  const series = useQuery({ queryKey: qk.admin.timeseries(days), queryFn: () => getTimeseries(days), staleTime: 60_000 })

  const r = revenue.data
  const chart = (series.data ?? []).map((d) => ({ ...d, gmv: Number(d.gmv), platform_revenue: Number(d.platform_revenue) }))

  // Commission take-rate: what share of gross the platform keeps.
  const takeRate = r && Number(r.gross.all) > 0 ? (Number(r.platform_fee.all) / Number(r.gross.all)) * 100 : null

  if (revenue.isError) return <ErrorState error={revenue.error} title="Couldn’t load revenue" onRetry={() => void revenue.refetch()} />

  return (
    <>
      <Seo title="Revenue & finance" noindex />
      <PageHeader
        eyebrow="Money"
        title="Revenue & finance"
        description="Gross volume, platform commission, creator earnings and payouts — computed by the database from captured payments."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link to="/admin/payments">
              Transactions <ArrowRight />
            </Link>
          </Button>
        }
      />

      {/* Period totals */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Today" value={formatINR(r?.gross.today ?? 0)} icon={<TrendingUp />} loading={revenue.isPending} tone="brand" />
        <StatsCard label="This week" value={formatINR(r?.gross.week ?? 0)} loading={revenue.isPending} />
        <StatsCard label="This month" value={formatINR(r?.gross.month ?? 0)} loading={revenue.isPending} />
        <StatsCard
          label="All time"
          value={formatINR(r?.gross.all ?? 0)}
          loading={revenue.isPending}
          tone="dark"
          hint={takeRate !== null ? `${formatPercent(takeRate)} platform take rate` : undefined}
        />
      </div>

      {/* Trend */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Trend" description="Gross volume and platform commission over time." />
          <div role="group" aria-label="Date range" className="flex flex-wrap gap-1.5">
            {RANGES.map((o) => (
              <Button
                key={o.value}
                size="xs"
                variant={range === o.value ? 'accent' : 'secondary'}
                aria-pressed={range === o.value}
                onClick={() => url.update({ range: o.value === '30' ? null : o.value })}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title="Gross volume" description="Captured payments per day" loading={series.isPending}>
            <AreaTrend
              data={chart}
              xKey="day"
              series={[{ key: 'gmv', label: 'Gross volume', color: 'brand' }]}
              format={(v) => formatINR(v)}
              xFormat={shortDate}
            />
          </ChartCard>
          <ChartCard title="Platform commission" description="Fee retained on completed orders" loading={series.isPending}>
            <Bars
              data={chart}
              xKey="day"
              series={[{ key: 'platform_revenue', label: 'Commission', color: 'lilac' }]}
              format={(v) => formatINR(v)}
              xFormat={shortDate}
            />
          </ChartCard>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
              <Landmark className="size-4" />
            </span>
            <h3 className="font-display text-base font-semibold">Platform commission</h3>
          </div>
          {revenue.isPending ? (
            <Skeleton className="h-28 rounded-card" />
          ) : (
            <div className="divide-y divide-line">
              <Row label="This month" value={formatINR(r!.platform_fee.month)} />
              <Row label="This year" value={formatINR(r!.platform_fee.year)} />
              <Row label="All time" value={formatINR(r!.platform_fee.all)} strong />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-mint-soft text-mint">
              <Wallet className="size-4" />
            </span>
            <h3 className="font-display text-base font-semibold">Creator earnings</h3>
          </div>
          {revenue.isPending ? (
            <Skeleton className="h-28 rounded-card" />
          ) : (
            <div className="divide-y divide-line">
              <Row label="Pending" value={formatINR(r!.creator_earnings.pending)} hint="Held until the order matures" />
              <Row label="Available" value={formatINR(r!.creator_earnings.available)} hint="Withdrawable now" />
              <Row label="Paid out" value={formatINR(r!.creator_earnings.paid)} strong />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-sun-soft text-sun-ink">
              <Banknote className="size-4" />
            </span>
            <h3 className="font-display text-base font-semibold">Payouts</h3>
          </div>
          {revenue.isPending ? (
            <Skeleton className="h-28 rounded-card" />
          ) : (
            <div className="divide-y divide-line">
              <Row label="Awaiting processing" value={formatNumber(r!.payouts.pending_count)} hint={formatINR(r!.payouts.pending_amount)} />
              <Row label="Completed" value={formatINR(r!.payouts.paid_amount)} strong />
              <div className="pt-3">
                <Button asChild variant="secondary" size="sm" block>
                  <Link to="/admin/payouts">Process payouts</Link>
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Payment health */}
      <section className="mt-6 space-y-4">
        <SectionTitle title="Payment health" description="Every payment attempt by its final state, plus refunds." />
        {revenue.isPending ? (
          <Skeleton className="h-24 rounded-card" />
        ) : (
          <Card className="flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
            {Object.entries(r!.payments_by_status).map(([status, count]) => {
              const meta = PAYMENT_STATUS_META[status as keyof typeof PAYMENT_STATUS_META]
              return (
                <div key={status} className="min-w-28">
                  <p className="font-display text-xl font-semibold tabular-nums">{formatNumber(count)}</p>
                  <Badge tone={meta?.tone ?? 'neutral'} size="sm">
                    {meta?.label ?? status}
                  </Badge>
                </div>
              )
            })}
            <div className="min-w-28">
              <p className="font-display text-xl font-semibold tabular-nums">{formatINR(r!.refunds.amount)}</p>
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <RotateCcw className="size-3" /> {formatNumber(r!.refunds.count)} refunded
              </span>
            </div>
            <div className="ml-auto">
              <Button asChild variant="secondary" size="sm">
                <Link to="/admin/payments">
                  <CreditCard /> All transactions
                </Link>
              </Button>
            </div>
          </Card>
        )}
      </section>
    </>
  )
}
