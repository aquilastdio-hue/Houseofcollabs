import { Link, useNavigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatNumber } from '@/lib/format'
import { listCreators, type AdminCreatorParams } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { CREATOR_SORTS, creatorColumns } from '@/components/admin/creator-table'
import { CREATOR_STATUS_META, metaOptions } from '@/components/admin/admin-status'
import { isOneOf, yesNo } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'
import type { CreatorStatus } from '@/types'

const PAGE_SIZE = 25
const STATUS_OPTIONS = metaOptions(CREATOR_STATUS_META)
const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value)
const SORT_VALUES = CREATOR_SORTS.map((s) => s.value)
const VERIFIED_OPTIONS = [
  { value: 'yes', label: 'Verified' },
  { value: 'no', label: 'Not verified' },
]
const FEATURED_OPTIONS = [
  { value: 'yes', label: 'Featured' },
  { value: 'no', label: 'Not featured' },
]

export default function Creators() {
  const navigate = useNavigate()
  const url = useUrlState()
  const search = url.get('q')
  const rawStatus = url.get('status')
  const status: CreatorStatus | '' = isOneOf(STATUS_VALUES, rawStatus) ? rawStatus : ''
  const verified = url.get('verified')
  const featured = url.get('featured')
  const includeDeleted = url.get('deleted') === '1'
  const rawSort = url.get('sort')
  const sort = isOneOf(SORT_VALUES, rawSort) ? rawSort : 'newest'

  const params: AdminCreatorParams = {
    search,
    status,
    verified: yesNo(verified),
    featured: yesNo(featured),
    includeDeleted,
    sort,
    page: url.page,
    pageSize: PAGE_SIZE,
  }
  const query = useQuery({
    queryKey: qk.admin.creators(params),
    queryFn: () => listCreators(params),
    placeholderData: keepPreviousData,
  })

  const activeCount = [status, yesNo(verified) !== undefined, yesNo(featured) !== undefined, includeDeleted, sort !== 'newest'].filter(Boolean).length
  const filtered = activeCount > 0 || !!search
  const reset = () => url.update({ q: null, status: null, verified: null, featured: null, deleted: null, sort: null })

  return (
    <>
      <Seo title="Creators" noindex />
      <PageHeader
        eyebrow="Marketplace"
        title="Creators"
        description={query.data ? `${formatNumber(query.data.total)} ${filtered ? 'matching' : 'total'} creator profiles.` : 'Review, verify and manage creator profiles.'}
      />

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        search={<SearchInput value={search} onCommit={(q) => url.update({ q })} placeholder="Search name, email, city or referral code" label="Search creators" />}
      >
        <FilterField label="Status" htmlFor="creator-status">
          <Select id="creator-status" size="sm" value={status} onValueChange={(v) => url.update({ status: v })} options={STATUS_OPTIONS} anyLabel="All statuses" />
        </FilterField>
        <FilterField label="Verification" htmlFor="creator-verified">
          <Select id="creator-verified" size="sm" value={yesNo(verified) === undefined ? '' : verified} onValueChange={(v) => url.update({ verified: v })} options={VERIFIED_OPTIONS} anyLabel="Any" />
        </FilterField>
        <FilterField label="Featured" htmlFor="creator-featured">
          <Select id="creator-featured" size="sm" value={yesNo(featured) === undefined ? '' : featured} onValueChange={(v) => url.update({ featured: v })} options={FEATURED_OPTIONS} anyLabel="Any" />
        </FilterField>
        <FilterField label="Sort by" htmlFor="creator-sort">
          <Select id="creator-sort" size="sm" value={sort} onValueChange={(v) => url.update({ sort: v === 'newest' ? null : v })} options={CREATOR_SORTS} />
        </FilterField>
        <div className="flex h-9 items-center gap-2.5 lg:self-end">
          <Switch id="creator-deleted" checked={includeDeleted} onCheckedChange={(v) => url.update({ deleted: v })} />
          <label htmlFor="creator-deleted" className="cursor-pointer text-sm font-medium">
            Include removed
          </label>
        </div>
      </FilterBar>

      <DataTable
        className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
        columns={creatorColumns}
        rows={query.data?.items}
        rowKey={(c) => c.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        onRowClick={(c) => navigate(`/admin/creators/${c.id}`)}
        mobilePrimary="name"
        empty={
          <EmptyState
            icon={<Users />}
            title={filtered ? 'No creators match these filters' : 'No creators yet'}
            description={filtered ? 'Try a different search or clear the filters.' : 'Creator profiles appear here as soon as someone signs up as a creator.'}
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
        pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'creators' } : undefined}
      />
    </>
  )
}
