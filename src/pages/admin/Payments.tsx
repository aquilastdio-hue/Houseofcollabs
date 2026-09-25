import { useNavigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertCircle, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDate, formatINR, formatNumber, titleCase } from '@/lib/format'
import { listPayments, type AdminPaymentItem } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { PAYMENT_STATUS_META, StatusBadge, metaOptions } from '@/components/admin/admin-status'
import { CellLink, CopyButton } from '@/components/admin/detail'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'
import type { PaymentStatus } from '@/types'

const PAGE_SIZE = 25
const STATUS_OPTIONS = metaOptions(PAYMENT_STATUS_META)
const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value)

const columns: Column<AdminPaymentItem>[] = [
  {
    key: 'created',
    header: 'Created',
    className: 'whitespace-nowrap text-muted',
    cell: (p) => (
      <span>
        {formatDate(p.created_at, 'd MMM yyyy')}
        <span className="block text-xs text-faint">{formatDate(p.created_at, 'h:mm a')}</span>
      </span>
    ),
  },
  {
    key: 'order',
    header: 'Order',
    cell: (p) =>
      p.order ? (
        <span className="flex flex-col">
          <CellLink to={`/admin/orders/${p.order.id}`} className="font-mono text-xs">
            {p.order.order_number}
          </CellLink>
          <span className="max-w-48 truncate text-xs text-muted">{p.order.service_title}</span>
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  {
    key: 'brand',
    header: 'Brand',
    cell: (p) =>
      p.order?.brand ? (
        <span className="block max-w-40 truncate">
          <CellLink to={`/admin/brands/${p.order.brand.id}`} className="font-normal">
            {p.order.brand.brand_name}
          </CellLink>
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  {
    key: 'creator',
    header: 'Creator',
    cell: (p) =>
      p.order?.creator ? (
        <span className="block max-w-40 truncate">
          <CellLink to={`/admin/creators/${p.order.creator.id}`} className="font-normal">
            {p.order.creator.display_name}
          </CellLink>
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  { key: 'amount', header: 'Amount', className: 'tabular-nums whitespace-nowrap font-medium', cell: (p) => formatINR(p.amount) },
  { key: 'method', header: 'Method', cell: (p) => (p.method ? titleCase(p.method) : <span className="text-faint">—</span>) },
  {
    key: 'status',
    header: 'Status',
    cell: (p) => (
      <span className="flex flex-col items-start gap-1">
        <span className="flex items-center gap-1">
          <StatusBadge meta={PAYMENT_STATUS_META} value={p.status} size="sm" />
          {p.error_description && (
            <Tooltip content={`${p.error_code ? `${p.error_code}: ` : ''}${p.error_description}`}>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Payment error: ${p.error_description}`}
                className="focus-ring hidden size-6 items-center justify-center rounded-full text-danger hover:bg-danger-soft md:inline-flex"
              >
                <AlertCircle className="size-4" />
              </button>
            </Tooltip>
          )}
        </span>
        {p.error_description && <span className="max-w-48 truncate text-xs text-danger md:hidden">{p.error_description}</span>}
      </span>
    ),
  },
  {
    key: 'refunded',
    header: 'Refunded',
    className: 'tabular-nums whitespace-nowrap',
    cell: (p) => (Number(p.refunded_amount) > 0 ? formatINR(p.refunded_amount) : <span className="text-faint">—</span>),
  },
  {
    key: 'provider',
    header: 'Provider payment id',
    mobileLabel: 'Payment id',
    cell: (p) =>
      p.provider_payment_id ? (
        <span className="flex max-w-44 items-center gap-1">
          <span className="truncate font-mono text-xs" title={p.provider_payment_id}>
            {p.provider_payment_id}
          </span>
          <span className="hidden md:inline-flex">
            <CopyButton value={p.provider_payment_id} label="Copy payment id" />
          </span>
        </span>
      ) : (
        <span className="text-xs text-faint">{p.provider_order_id ? 'Not paid yet' : '—'}</span>
      ),
  },
]

export default function Payments() {
  const navigate = useNavigate()
  const url = useUrlState()
  const search = url.get('q')
  const rawStatus = url.get('status')
  const status: PaymentStatus | '' = isOneOf(STATUS_VALUES, rawStatus) ? rawStatus : ''

  const params = { status, search, page: url.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: qk.admin.payments(params),
    queryFn: () => listPayments(params),
    placeholderData: keepPreviousData,
  })

  const filtered = !!status || !!search
  const reset = () => url.update({ status: null, q: null })

  return (
    <>
      <Seo title="Payments" noindex />
      <PageHeader
        eyebrow="Money"
        title="Payments"
        description={query.data ? `${formatNumber(query.data.total)} ${filtered ? 'matching ' : ''}payment attempts via Razorpay.` : 'Every Razorpay payment attempt, newest first.'}
      />

      <FilterBar
        activeCount={status ? 1 : 0}
        onReset={() => url.update({ status: null })}
        search={<SearchInput value={search} onCommit={(q) => url.update({ q })} placeholder="Search Razorpay order or payment id" label="Search payments" />}
      >
        <FilterField label="Status" htmlFor="payment-status">
          <Select id="payment-status" size="sm" value={status} onValueChange={(v) => url.update({ status: v })} options={STATUS_OPTIONS} anyLabel="All statuses" />
        </FilterField>
      </FilterBar>

      <DataTable
        className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
        columns={columns}
        rows={query.data?.items}
        rowKey={(p) => p.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        onRowClick={(p) => navigate(`/admin/orders/${p.order_id}`)}
        mobilePrimary="order"
        empty={
          <EmptyState
            icon={<CreditCard />}
            title={filtered ? 'No payments match' : 'No payments yet'}
            description={filtered ? 'Check the id or clear the filters.' : 'Payments appear once brands start checking out.'}
            action={
              filtered ? (
                <Button variant="secondary" size="sm" onClick={reset}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => navigate('/admin/orders')}>
                  View orders
                </Button>
              )
            }
          />
        }
        pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'payments' } : undefined}
      />
    </>
  )
}
