import * as React from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatDate, formatINR, formatNumber, formatPercent } from '@/lib/format'
import { getTimeseries } from '@/services/admin.service'
import { AreaTrend, Bars, ChartCard } from '@/components/shared/chart'
import { ErrorState } from '@/components/shared/states'
import { ToggleGroup } from './filter-bar'

export const CHART_RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
] as const

export type ChartRange = (typeof CHART_RANGES)[number]['value']

const dayLabel = (v: string) => formatDate(`${v}T00:00:00`, 'd MMM')

function ChartEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 rounded-control border border-dashed border-line-strong text-center text-sm text-muted">
      <BarChart3 className="size-5 text-faint" aria-hidden />
      {children}
    </div>
  )
}

/** Time-series charts (orders, revenue, sign-ups, conversion) with a 7/30/90-day range. */
export function DashboardCharts({ range, onRangeChange }: { range: ChartRange; onRangeChange: (range: ChartRange) => void }) {
  const days = Number(range)
  const query = useQuery({
    queryKey: qk.admin.timeseries(days),
    queryFn: () => getTimeseries(days),
    placeholderData: keepPreviousData,
  })

  const rows = React.useMemo(
    () =>
      (query.data ?? []).map((r) => ({
        day: r.day,
        orders_created: Number(r.orders_created ?? 0),
        orders_paid: Number(r.orders_paid ?? 0),
        gmv: Number(r.gmv ?? 0),
        platform_revenue: Number(r.platform_revenue ?? 0),
        new_creators: Number(r.new_creators ?? 0),
        new_brands: Number(r.new_brands ?? 0),
        conversion_rate: Number(r.conversion_rate ?? 0),
      })),
    [query.data],
  )

  const totals = React.useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          created: acc.created + r.orders_created,
          paid: acc.paid + r.orders_paid,
          gmv: acc.gmv + r.gmv,
          revenue: acc.revenue + r.platform_revenue,
          creators: acc.creators + r.new_creators,
          brands: acc.brands + r.new_brands,
        }),
        { created: 0, paid: 0, gmv: 0, revenue: 0, creators: 0, brands: 0 },
      ),
    [rows],
  )
  const conversion = totals.created > 0 ? (totals.paid / totals.created) * 100 : 0
  const loading = query.isPending

  return (
    <section aria-labelledby="admin-trends" className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="admin-trends" className="font-display text-lg font-semibold tracking-tight">
            Trends
          </h2>
          <p className="text-sm text-muted">Daily activity over the last {days} days.</p>
        </div>
        <ToggleGroup label="Chart time range" value={range} onChange={onRangeChange} options={CHART_RANGES} />
      </div>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Orders over time"
            description={loading ? 'Loading…' : `${formatNumber(totals.created)} created · ${formatNumber(totals.paid)} paid`}
            loading={loading}
          >
            {totals.created + totals.paid === 0 ? (
              <ChartEmpty>No orders in this period.</ChartEmpty>
            ) : (
              <Bars
                data={rows}
                xKey="day"
                xFormat={dayLabel}
                format={(v) => formatNumber(v)}
                series={[
                  { key: 'orders_created', label: 'Created', color: 'ink' },
                  { key: 'orders_paid', label: 'Paid', color: 'brand' },
                ]}
              />
            )}
          </ChartCard>

          <ChartCard
            title="Revenue"
            description={loading ? 'Loading…' : `${formatINR(totals.gmv)} GMV · ${formatINR(totals.revenue)} platform revenue`}
            loading={loading}
          >
            {totals.gmv + totals.revenue === 0 ? (
              <ChartEmpty>No captured payments in this period.</ChartEmpty>
            ) : (
              <AreaTrend
                data={rows}
                xKey="day"
                xFormat={dayLabel}
                format={(v) => formatINR(v)}
                series={[
                  { key: 'gmv', label: 'GMV', color: 'ink' },
                  { key: 'platform_revenue', label: 'Platform revenue', color: 'brand' },
                ]}
              />
            )}
          </ChartCard>

          <ChartCard
            title="New creators & brands"
            description={loading ? 'Loading…' : `${formatNumber(totals.creators)} creators · ${formatNumber(totals.brands)} brands joined`}
            loading={loading}
          >
            {totals.creators + totals.brands === 0 ? (
              <ChartEmpty>No new sign-ups in this period.</ChartEmpty>
            ) : (
              <Bars
                data={rows}
                xKey="day"
                xFormat={dayLabel}
                format={(v) => formatNumber(v)}
                series={[
                  { key: 'new_creators', label: 'Creators', color: 'lilac' },
                  { key: 'new_brands', label: 'Brands', color: 'sky' },
                ]}
              />
            )}
          </ChartCard>

          <ChartCard
            title="Checkout conversion"
            description={loading ? 'Loading…' : `${formatPercent(conversion)} of created orders were paid`}
            loading={loading}
          >
            {totals.created === 0 ? (
              <ChartEmpty>No checkouts started in this period.</ChartEmpty>
            ) : (
              <AreaTrend
                data={rows}
                xKey="day"
                xFormat={dayLabel}
                format={(v) => formatPercent(v)}
                series={[{ key: 'conversion_rate', label: 'Paid / created', color: 'mint' }]}
              />
            )}
          </ChartCard>
        </div>
      )}
    </section>
  )
}
