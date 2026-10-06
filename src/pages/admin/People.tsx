import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ShieldCheck, UserRound, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDate, formatINR, formatNumber, formatRelative } from '@/lib/format'
import { getPeopleStats, listPeople, type PersonRow } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { ACCOUNT_STATUS_META, StatusBadge, metaOptions } from '@/components/admin/admin-status'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'
import type { AccountStatus } from '@/types'

const PAGE_SIZE = 25

const ROLE_OPTIONS = [
  { value: 'creator', label: 'Creators' },
  { value: 'brand', label: 'Brands' },
  { value: 'admin', label: 'Admins' },
  { value: 'unassigned', label: 'No role yet' },
] as const
const ROLE_VALUES = ROLE_OPTIONS.map((o) => o.value)

const STATUS_OPTIONS = metaOptions(ACCOUNT_STATUS_META)
const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value)

const SORT_OPTIONS = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'active', label: 'Recently active' },
  { value: 'value', label: 'Highest value' },
  { value: 'name', label: 'Name A–Z' },
] as const
const SORT_VALUES = SORT_OPTIONS.map((o) => o.value)

const ROLE_TONE = { creator: 'lilac', brand: 'sky', admin: 'brand', unassigned: 'neutral' } as const

/** Where this person's detail page lives, when they have one. */
function detailHref(row: PersonRow) {
  if (row.role === 'creator' && row.entity_id) return `/admin/creators/${row.entity_id}`
  if (row.role === 'brand' && row.entity_id) return `/admin/brands/${row.entity_id}`
  return null
}

function PersonCell({ row }: { row: PersonRow }) {
  const href = detailHref(row)
  const name = row.display_name ?? row.full_name ?? 'Unnamed'
  const inner = (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar src={row.avatar_url} name={name} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium">{name}</span>
          {row.verified && <ShieldCheck className="size-3.5 shrink-0 text-brand" aria-label="Verified" />}
        </span>
        <span className="truncate text-xs text-muted">{row.email}</span>
      </span>
    </span>
  )
  return href ? (
    <Link to={href} className="focus-ring rounded-md hover:underline">
      {inner}
    </Link>
  ) : (
    inner
  )
}

const COLUMNS: Column<PersonRow>[] = [
  { key: 'person', header: 'Person', mobileLabel: 'Person', cell: (r) => <PersonCell row={r} /> },
  {
    key: 'role',
    header: 'Account type',
    mobileLabel: 'Type',
    cell: (r) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge tone={ROLE_TONE[r.role as keyof typeof ROLE_TONE] ?? 'neutral'} size="sm">
          {r.role === 'unassigned' ? 'No role' : r.role}
        </Badge>
        {r.is_admin && r.role !== 'admin' && (
          <Badge tone="brand" size="sm">
            Admin
          </Badge>
        )}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    mobileLabel: 'Status',
    cell: (r) => <StatusBadge meta={ACCOUNT_STATUS_META} value={r.status} size="sm" />,
  },
  {
    key: 'orders',
    header: 'Orders',
    mobileLabel: 'Orders',
    headerClassName: 'text-right',
    className: 'text-right tabular-nums',
    hideOnMobile: true,
    cell: (r) => (r.orders_count > 0 ? formatNumber(r.orders_count) : <span className="text-faint">—</span>),
  },
  {
    key: 'value',
    header: 'Order value',
    mobileLabel: 'Order value',
    headerClassName: 'text-right',
    className: 'text-right tabular-nums',
    cell: (r) => (Number(r.total_value) > 0 ? formatINR(Number(r.total_value)) : <span className="text-faint">—</span>),
  },
  {
    key: 'last_seen',
    header: 'Last active',
    mobileLabel: 'Last active',
    hideOnMobile: true,
    cell: (r) => (r.last_seen_at ? <span className="text-xs">{formatRelative(r.last_seen_at)}</span> : <span className="text-faint">Never</span>),
  },
  {
    // Next to "Joined", because both answer how this person arrived.
    key: 'referral',
    header: 'Referral',
    mobileLabel: 'Referral',
    hideOnMobile: true,
    cell: (r) =>
      r.referral_code ? (
        <span className="font-mono text-xs tracking-wide">{r.referral_code}</span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  {
    key: 'joined',
    header: 'Joined',
    mobileLabel: 'Joined',
    className: 'whitespace-nowrap',
    cell: (r) => <span className="text-xs">{formatDate(r.created_at)}</span>,
  },
]

export default function People() {
  const url = useUrlState()
  const search = url.get('q')
  const rawRole = url.get('role')
  const role: '' | 'brand' | 'creator' | 'admin' | 'unassigned' = isOneOf(ROLE_VALUES, rawRole) ? rawRole : ''
  const rawStatus = url.get('status')
  const status: AccountStatus | '' = isOneOf(STATUS_VALUES, rawStatus) ? rawStatus : ''
  const rawSort = url.get('sort')
  const sort = isOneOf(SORT_VALUES, rawSort) ? rawSort : 'recent'

  const params = { search, role, status, sort, page: url.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: qk.admin.people(params),
    queryFn: () => listPeople(params),
    placeholderData: keepPreviousData,
  })
  const stats = useQuery({ queryKey: qk.admin.peopleStats, queryFn: getPeopleStats, staleTime: 60_000 })

  const activeCount = [search, role, status].filter(Boolean).length
  const reset = () => url.update({ q: null, role: null, status: null })
  const s = stats.data

  return (
    <>
      <Seo title="People" noindex />
      <PageHeader
        eyebrow="Accounts"
        title="People"
        description="Every account on the platform — creators, brands and admins — in one directory."
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total accounts" value={formatNumber(s?.users_total)} icon={<Users />} loading={stats.isPending} tone="brand" hint={s ? `${formatNumber(s.new_30d)} joined in 30 days` : undefined} />
        <StatsCard label="Active today" value={formatNumber(s?.dau)} icon={<UserRound />} loading={stats.isPending} hint={s ? `${formatNumber(s.wau)} this week · ${formatNumber(s.mau)} this month` : undefined} />
        <StatsCard label="Creators" value={formatNumber(s?.creators_total)} loading={stats.isPending} hint={s ? `${formatNumber(s.creators_published)} published · ${formatNumber(s.creators_verified)} verified` : undefined} />
        <StatsCard label="Brands" value={formatNumber(s?.brands_total)} loading={stats.isPending} hint={s ? `${formatNumber(s.brands_active)} active` : undefined} />
      </div>

      {stats.isPending ? (
        <Skeleton className="mb-5 h-9 w-full max-w-md rounded-pill" />
      ) : null}

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        search={<SearchInput value={search} onCommit={(v) => url.update({ q: v })} placeholder="Search by name, email or brand" label="Search people" />}
      >
        <FilterField label="Account type" htmlFor="people-role">
          <Select id="people-role" size="sm" value={role} onValueChange={(v) => url.update({ role: v })} options={ROLE_OPTIONS} anyLabel="Everyone" />
        </FilterField>
        <FilterField label="Status" htmlFor="people-status">
          <Select id="people-status" size="sm" value={status} onValueChange={(v) => url.update({ status: v })} options={STATUS_OPTIONS} anyLabel="Any status" />
        </FilterField>
        <FilterField label="Sort" htmlFor="people-sort">
          <Select id="people-sort" size="sm" value={sort} onValueChange={(v) => url.update({ sort: v === 'recent' ? null : v })} options={SORT_OPTIONS} />
        </FilterField>
      </FilterBar>

      <DataTable
        className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
        columns={COLUMNS}
        rows={query.data?.items}
        rowKey={(r) => r.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        mobilePrimary="person"
        empty={
          <EmptyState
            icon={<Users />}
            title={activeCount ? 'No one matches these filters' : 'No accounts yet'}
            description={activeCount ? 'Try a different search, role or status.' : 'Accounts appear here as people sign up.'}
            action={
              activeCount ? (
                <Button variant="secondary" size="sm" onClick={reset}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
        pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'people' } : undefined}
      />
    </>
  )
}
