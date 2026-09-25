import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDate, formatINR, formatNumber, formatRelative } from '@/lib/format'
import { listBriefs, type AdminBriefItem, type BriefStatus } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Avatar } from '@/components/ui/avatar'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'

const PAGE_SIZE = 25

/** Campaign brief lifecycle, mirroring public.brief_status. */
const STATUS_META: Record<BriefStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'brand' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Declined', tone: 'danger' },
  completed: { label: 'Completed', tone: 'dark' },
}
const STATUS_OPTIONS = (Object.keys(STATUS_META) as BriefStatus[]).map((value) => ({ value, label: STATUS_META[value].label }))
const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value)

const COLUMNS: Column<AdminBriefItem>[] = [
  {
    key: 'title',
    header: 'Campaign',
    mobileLabel: 'Campaign',
    cell: (b) => (
      <Link to={`/brief/${b.id}`} className="focus-ring flex min-w-0 flex-col rounded-md hover:underline">
        <span className="truncate font-medium">{b.title}</span>
        <span className="truncate text-xs text-muted">
          {b.content_type ?? 'Content'}
          {b.platform ? ` · ${b.platform}` : ''}
        </span>
      </Link>
    ),
  },
  {
    key: 'brand',
    header: 'Brand',
    mobileLabel: 'Brand',
    cell: (b) =>
      b.brand ? (
        <Link to={`/admin/brands/${b.brand.id}`} className="focus-ring flex min-w-0 items-center gap-2 rounded-md hover:underline">
          <Avatar src={b.brand.brand_logo_url} name={b.brand.brand_name} size="xs" shape="rounded" />
          <span className="truncate">{b.brand.brand_name}</span>
        </Link>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  {
    key: 'creator',
    header: 'Creator',
    mobileLabel: 'Creator',
    hideOnMobile: true,
    cell: (b) =>
      b.creator ? (
        <Link to={`/admin/creators/${b.creator.id}`} className="focus-ring flex min-w-0 items-center gap-2 rounded-md hover:underline">
          <Avatar src={b.creator.profile_image_url} name={b.creator.display_name} size="xs" />
          <span className="truncate">{b.creator.display_name}</span>
        </Link>
      ) : (
        <span className="text-faint">Not sent yet</span>
      ),
  },
  {
    key: 'budget',
    header: 'Budget',
    mobileLabel: 'Budget',
    headerClassName: 'text-right',
    className: 'text-right tabular-nums',
    cell: (b) => (b.budget !== null ? formatINR(Number(b.budget)) : <span className="text-faint">—</span>),
  },
  {
    key: 'status',
    header: 'Status',
    mobileLabel: 'Status',
    cell: (b) => {
      const meta = STATUS_META[b.status as BriefStatus]
      return (
        <Badge tone={meta?.tone ?? 'neutral'} size="sm">
          {meta?.label ?? b.status}
        </Badge>
      )
    },
  },
  {
    key: 'deadline',
    header: 'Deadline',
    mobileLabel: 'Deadline',
    hideOnMobile: true,
    className: 'whitespace-nowrap',
    cell: (b) => (b.deadline ? <span className="text-xs">{formatDate(b.deadline)}</span> : <span className="text-faint">—</span>),
  },
  {
    key: 'created',
    header: 'Created',
    mobileLabel: 'Created',
    className: 'whitespace-nowrap',
    cell: (b) => <span className="text-xs text-muted">{formatRelative(b.created_at)}</span>,
  },
]

export default function Briefs() {
  const url = useUrlState()
  const search = url.get('q')
  const raw = url.get('status')
  const status: BriefStatus | '' = isOneOf(STATUS_VALUES, raw) ? raw : ''

  const params = { status, search, page: url.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: qk.admin.content({ kind: 'briefs', ...params }),
    queryFn: () => listBriefs(params),
    placeholderData: keepPreviousData,
  })

  const activeCount = [search, status].filter(Boolean).length
  const reset = () => url.update({ q: null, status: null })

  return (
    <>
      <Seo title="Campaign briefs" noindex />
      <PageHeader
        eyebrow="Marketplace"
        title="Campaign briefs"
        description={
          query.data
            ? `${formatNumber(query.data.total)} ${activeCount ? 'matching ' : ''}brief${query.data.total === 1 ? '' : 's'}. A brief is how a brand pitches a campaign to a creator before the order is placed.`
            : 'How brands pitch campaigns to creators before an order is placed.'
        }
      />

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        search={<SearchInput value={search} onCommit={(v) => url.update({ q: v })} placeholder="Search campaign titles" label="Search briefs" />}
      >
        <FilterField label="Status" htmlFor="brief-status">
          <Select id="brief-status" size="sm" value={status} onValueChange={(v) => url.update({ status: v })} options={STATUS_OPTIONS} anyLabel="All statuses" />
        </FilterField>
      </FilterBar>

      <DataTable
        className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
        columns={COLUMNS}
        rows={query.data?.items}
        rowKey={(b) => b.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        mobilePrimary="title"
        empty={
          <EmptyState
            icon={<Megaphone />}
            title={activeCount ? 'No briefs match these filters' : 'No campaign briefs yet'}
            description={activeCount ? 'Try another status or search term.' : 'Briefs appear here once brands start pitching campaigns to creators.'}
            action={
              activeCount ? (
                <Button variant="secondary" size="sm" onClick={reset}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
        pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'briefs' } : undefined}
      />
    </>
  )
}
