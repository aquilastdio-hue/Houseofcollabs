import { Link, useNavigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Gavel } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDate, formatDateTime, formatINR, formatNumber, formatRelative } from '@/lib/format'
import { listDisputes, type AdminDisputeItem } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { DISPUTE_STATUS_META, RoleBadge, StatusBadge } from '@/components/admin/admin-status'
import { CellLink } from '@/components/admin/detail'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'

const PAGE_SIZE = 25
const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
] as const
const TAB_VALUES = TABS.map((t) => t.value)

const columns: Column<AdminDisputeItem>[] = [
  {
    key: 'order',
    header: 'Order',
    cell: (d) => (
      <span className="flex flex-col">
        <CellLink to={`/admin/disputes/${d.id}`} className="font-mono text-xs">
          {d.order?.order_number ?? 'Order'}
        </CellLink>
        <span className="max-w-52 truncate text-xs text-muted">{d.order?.service_title}</span>
      </span>
    ),
  },
  {
    key: 'parties',
    header: 'Parties',
    cell: (d) =>
      d.order ? (
        <span className="flex max-w-64 flex-wrap items-center gap-1 text-sm">
          <span className="truncate">{d.order.brand?.brand_name ?? 'Brand'}</span>
          <ArrowLeftRight className="size-3.5 shrink-0 text-faint" aria-label="and" />
          <span className="truncate">{d.order.creator?.display_name ?? 'Creator'}</span>
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  {
    key: 'reason',
    header: 'Reason',
    className: 'max-w-64',
    cell: (d) => (
      <span className="block truncate" title={d.description ?? d.reason}>
        {d.reason}
      </span>
    ),
  },
  { key: 'amount', header: 'Order value', className: 'tabular-nums whitespace-nowrap', cell: (d) => (d.order ? formatINR(d.order.total_amount) : '—') },
  {
    key: 'status',
    header: 'Status',
    cell: (d) => (
      <span className="flex flex-col items-start gap-1">
        <StatusBadge meta={DISPUTE_STATUS_META} value={d.status} size="sm" />
        {d.order && d.order.status !== 'disputed' && <OrderStatusBadge status={d.order.status} size="sm" />}
      </span>
    ),
  },
  { key: 'raised', header: 'Raised by', cell: (d) => <RoleBadge role={d.raised_by_role} /> },
  {
    key: 'opened',
    header: 'Opened',
    className: 'whitespace-nowrap text-muted',
    cell: (d) => (
      <span title={formatDateTime(d.created_at)}>
        {formatDate(d.created_at)}
        <span className="block text-xs text-faint">{formatRelative(d.created_at)}</span>
      </span>
    ),
  },
]

export default function Disputes() {
  const navigate = useNavigate()
  const url = useUrlState()
  const rawTab = url.get('status')
  const tab = isOneOf(TAB_VALUES, rawTab) ? rawTab : 'open'

  const params = { status: tab === 'all' ? ('' as const) : tab, page: url.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: qk.admin.disputes(params),
    queryFn: () => listDisputes(params),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <Seo title="Disputes" noindex />
      <PageHeader
        eyebrow="Trust & safety"
        title="Disputes"
        description={
          query.data && tab === 'open'
            ? `${formatNumber(query.data.total)} open dispute${query.data.total === 1 ? '' : 's'} waiting for a decision.`
            : 'Disagreements between brands and creators. Review the evidence, talk to both sides, then resolve.'
        }
      />

      <Tabs value={tab} onValueChange={(v) => url.update({ status: v === 'open' ? null : v })}>
        <TabsList aria-label="Dispute status" className="mb-5">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <DataTable
            className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
            columns={columns}
            rows={query.data?.items}
            rowKey={(d) => d.id}
            loading={query.isPending}
            error={query.isError ? query.error : undefined}
            onRetry={() => void query.refetch()}
            onRowClick={(d) => navigate(`/admin/disputes/${d.id}`)}
            mobilePrimary="order"
            empty={
              <EmptyState
                icon={<Gavel />}
                title={tab === 'open' ? 'No open disputes' : `No ${tab === 'all' ? '' : `${tab} `}disputes`}
                description={tab === 'open' ? 'Nice — every disagreement has been handled.' : 'Disputes move here once they’re closed.'}
                action={
                  tab === 'open' ? (
                    <Button asChild variant="secondary" size="sm">
                      <Link to="/admin/orders">Review orders</Link>
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => url.update({ status: null })}>
                      Show open disputes
                    </Button>
                  )
                }
              />
            }
            pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'disputes' } : undefined}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
