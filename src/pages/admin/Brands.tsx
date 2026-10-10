import { Link, useNavigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Activity, Building2, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatNumber } from '@/lib/format'
import { getPeopleStats, listBrands } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { BRAND_SORTS, brandColumns } from '@/components/admin/brand-table'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'
import type { AccountStatus } from '@/types'

const PAGE_SIZE = 25
const STATUS_OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
]
const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value)
const SORT_VALUES = BRAND_SORTS.map((s) => s.value)

export default function Brands() {
  const navigate = useNavigate()
  const url = useUrlState()
  const search = url.get('q')
  const rawStatus = url.get('status')
  const status: AccountStatus | '' = isOneOf(STATUS_VALUES, rawStatus) ? rawStatus : ''
  const rawSort = url.get('sort')
  const sort = isOneOf(SORT_VALUES, rawSort) ? rawSort : 'newest'

  const params = { search, status, sort, page: url.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: qk.admin.brands(params),
    queryFn: () => listBrands(params),
    placeholderData: keepPreviousData,
  })
  const stats = useQuery({ queryKey: qk.admin.peopleStats, queryFn: getPeopleStats, staleTime: 60_000 })

  const activeCount = [status, sort !== 'newest'].filter(Boolean).length
  const filtered = activeCount > 0 || !!search
  const reset = () => url.update({ q: null, status: null, sort: null })

  return (
    <>
      <Seo title="Brands" noindex />
      <PageHeader
        eyebrow="Marketplace"
        title="Brands"
        description={query.data ? `${formatNumber(query.data.total)} ${filtered ? 'matching' : 'registered'} brands.` : 'Brand accounts, their spend and activity.'}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatsCard
          label="Total brands"
          value={formatNumber(stats.data?.brands_total)}
          icon={<Building2 />}
          loading={stats.isPending}
          hint={stats.data ? `${formatNumber(stats.data.brands_active)} active accounts` : undefined}
        />
        <StatsCard
          label="Active today"
          value={formatNumber(stats.data?.brands_active_today)}
          icon={<Activity />}
          loading={stats.isPending}
          hint="Seen in the last 24 hours"
        />
        <StatsCard
          label="Onboarded today"
          value={formatNumber(stats.data?.brands_onboarded_today)}
          icon={<CalendarDays />}
          loading={stats.isPending}
          hint="Brand accounts created today"
        />
      </div>

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        search={<SearchInput value={search} onCommit={(q) => url.update({ q })} placeholder="Search brand, email or industry" label="Search brands" />}
      >
        <FilterField label="Account status" htmlFor="brand-status">
          <Select id="brand-status" size="sm" value={status} onValueChange={(v) => url.update({ status: v })} options={STATUS_OPTIONS} anyLabel="All statuses" />
        </FilterField>
        <FilterField label="Sort by" htmlFor="brand-sort">
          <Select id="brand-sort" size="sm" value={sort} onValueChange={(v) => url.update({ sort: v === 'newest' ? null : v })} options={BRAND_SORTS} />
        </FilterField>
      </FilterBar>

      <DataTable
        className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
        columns={brandColumns}
        rows={query.data?.items}
        rowKey={(b) => b.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        onRowClick={(b) => navigate(`/admin/brands/${b.id}`)}
        mobilePrimary="brand"
        empty={
          <EmptyState
            icon={<Building2 />}
            title={filtered ? 'No brands match these filters' : 'No brands yet'}
            description={filtered ? 'Try a different search or clear the filters.' : 'Brands appear here once they sign up and finish onboarding.'}
            action={
              filtered ? (
                <Button variant="secondary" size="sm" onClick={reset}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild variant="secondary" size="sm">
                  <Link to="/discover">View the public marketplace</Link>
                </Button>
              )
            }
          />
        }
        pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'brands' } : undefined}
      />
    </>
  )
}
