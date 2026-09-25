import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { getDashboardStats } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { DashboardStats } from '@/components/admin/dashboard-stats'
import { CHART_RANGES, DashboardCharts, type ChartRange } from '@/components/admin/dashboard-charts'
import { OrdersByStatus, QuickLinks } from '@/components/admin/dashboard-breakdown'
import { DetailCard } from '@/components/admin/detail'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'

const RANGE_VALUES = CHART_RANGES.map((r) => r.value)

export default function Dashboard() {
  const qc = useQueryClient()
  const url = useUrlState()
  const rawRange = url.get('days')
  const range: ChartRange = isOneOf(RANGE_VALUES, rawRange) ? rawRange : '30'
  const stats = useQuery({ queryKey: qk.admin.stats, queryFn: getDashboardStats })
  const refreshing = stats.isFetching && !stats.isPending

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.admin.stats })
    void qc.invalidateQueries({ queryKey: [...qk.admin.all, 'timeseries'] })
  }

  return (
    <>
      <Seo title="Admin dashboard" noindex />
      <PageHeader
        eyebrow="Admin"
        title="Marketplace overview"
        description="Money, orders, supply and trust & safety — live from the database."
        actions={
          <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing}>
            {!refreshing && <RefreshCw />} Refresh
          </Button>
        }
      />

      {stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <DashboardStats stats={stats.data} loading={stats.isPending} />
      )}

      <DashboardCharts range={range} onRangeChange={(next) => url.update({ days: next === '30' ? null : next })} />

      {!stats.isError && (
        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <DetailCard title="Orders by status" description="Every order in the system, grouped by where it stands.">
            <OrdersByStatus stats={stats.data} loading={stats.isPending} />
          </DetailCard>
          <DetailCard title="Needs attention" description="Queues that usually need an admin today.">
            <QuickLinks stats={stats.data} loading={stats.isPending} />
          </DetailCard>
        </div>
      )}
    </>
  )
}
