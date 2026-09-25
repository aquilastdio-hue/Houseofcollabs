import { useNavigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatNumber } from '@/lib/format'
import { listOrders, type AdminOrderParams } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { DebouncedInput, FilterBar, FilterField, SearchInput, ToggleGroup } from '@/components/admin/filter-bar'
import { OrderPartyChips, OrderStatusPicker } from '@/components/admin/order-filters'
import { orderColumns } from '@/components/admin/order-table'
import { ORDER_PRESETS, ORDER_STATUSES, matchPreset } from '@/components/admin/order-presets'
import { PAYMENT_STATUS_META, metaOptions } from '@/components/admin/admin-status'
import { dayEndIso, dayParam, dayStartIso, isOneOf, parseAmount } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'
import type { OrderStatus, PaymentStatus } from '@/types'

const PAGE_SIZE = 25
const PAYMENT_OPTIONS = metaOptions(PAYMENT_STATUS_META)
const PAYMENT_VALUES = PAYMENT_OPTIONS.map((o) => o.value)
const PRESET_OPTIONS = ORDER_PRESETS.map((p) => ({ value: p.value, label: p.label }))
const COLUMNS = orderColumns()

export default function Orders() {
  const navigate = useNavigate()
  const url = useUrlState()

  const statuses = url.getList('status').filter((s): s is OrderStatus => isOneOf(ORDER_STATUSES, s))
  const refund = url.get('refund') === '1'
  const search = url.get('q')
  const brandId = url.get('brand')
  const creatorId = url.get('creator')
  const from = dayParam(url.get('from'))
  const to = dayParam(url.get('to'))
  const min = url.get('min')
  const max = url.get('max')
  const rawPay = url.get('pay')
  const paymentStatus: PaymentStatus | '' = isOneOf(PAYMENT_VALUES, rawPay) ? rawPay : ''

  const params: AdminOrderParams = {
    statuses,
    refundRequired: refund || undefined,
    search,
    brandId: brandId || undefined,
    creatorId: creatorId || undefined,
    from: from ? dayStartIso(from) : undefined,
    to: to ? dayEndIso(to) : undefined,
    minAmount: parseAmount(min),
    maxAmount: parseAmount(max),
    paymentStatus,
    page: url.page,
    pageSize: PAGE_SIZE,
  }
  const query = useQuery({
    queryKey: qk.admin.orders(params),
    queryFn: () => listOrders(params),
    placeholderData: keepPreviousData,
  })

  const preset = matchPreset(statuses, refund)
  const activeCount = [statuses.length > 0 && preset === null, paymentStatus, from, to, parseAmount(min) !== undefined, parseAmount(max) !== undefined].filter(Boolean).length
  const filtered = statuses.length > 0 || refund || !!search || !!brandId || !!creatorId || activeCount > 0
  const resetFilters = () => url.update({ status: null, refund: null, pay: null, from: null, to: null, min: null, max: null })
  const resetAll = () => url.update({ status: null, refund: null, pay: null, from: null, to: null, min: null, max: null, q: null, brand: null, creator: null })

  const applyPreset = (value: string) => {
    const p = ORDER_PRESETS.find((x) => x.value === value)
    url.update({ status: p?.statuses ?? null, refund: p?.refund ?? null })
  }

  return (
    <>
      <Seo title="Orders" noindex />
      <PageHeader
        eyebrow="Marketplace"
        title="Orders"
        description={
          query.data
            ? `${formatNumber(query.data.total)} ${filtered ? 'matching orders' : 'orders'}, newest first.`
            : 'Every order on the platform, with payment and status.'
        }
      />

      <FilterBar
        activeCount={activeCount}
        onReset={resetFilters}
        search={<SearchInput value={search} onCommit={(q) => url.update({ q })} placeholder="Search order number or service" label="Search orders" />}
        toolbar={
          <>
            <ToggleGroup label="Quick views" value={preset} onChange={applyPreset} options={PRESET_OPTIONS} />
            <OrderPartyChips brandId={brandId} creatorId={creatorId} onClearBrand={() => url.update({ brand: null })} onClearCreator={() => url.update({ creator: null })} />
          </>
        }
      >
        <FilterField label="Status" htmlFor="order-status" className="lg:w-48">
          <OrderStatusPicker id="order-status" value={statuses} onChange={(next) => url.update({ status: next })} />
        </FilterField>
        <FilterField label="Payment" htmlFor="order-payment">
          <Select id="order-payment" size="sm" value={paymentStatus} onValueChange={(v) => url.update({ pay: v })} options={PAYMENT_OPTIONS} anyLabel="Any payment" />
        </FilterField>
        <FilterField label="From" htmlFor="order-from" className="lg:w-40">
          <DatePicker id="order-from" value={from || null} onChange={(v) => url.update({ from: v })} placeholder="Any date" className="h-9" />
        </FilterField>
        <FilterField label="To" htmlFor="order-to" className="lg:w-40">
          <DatePicker id="order-to" value={to || null} onChange={(v) => url.update({ to: v })} placeholder="Any date" className="h-9" />
        </FilterField>
        <FilterField label="Min amount (₹)" htmlFor="order-min" className="lg:w-32">
          <DebouncedInput id="order-min" inputSize="sm" type="number" inputMode="decimal" min={0} step="1" placeholder="0" value={min} onCommit={(v) => url.update({ min: parseAmount(v) ?? null })} />
        </FilterField>
        <FilterField label="Max amount (₹)" htmlFor="order-max" className="lg:w-32">
          <DebouncedInput id="order-max" inputSize="sm" type="number" inputMode="decimal" min={0} step="1" placeholder="Any" value={max} onCommit={(v) => url.update({ max: parseAmount(v) ?? null })} />
        </FilterField>
      </FilterBar>

      <DataTable
        className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
        columns={COLUMNS}
        rows={query.data?.items}
        rowKey={(o) => o.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
        mobilePrimary="number"
        empty={
          <EmptyState
            icon={<Package />}
            title={filtered ? 'No orders match these filters' : 'No orders yet'}
            description={filtered ? 'Try another view or clear the filters.' : 'Orders show up here as soon as a brand starts checkout.'}
            action={
              filtered ? (
                <Button variant="secondary" size="sm" onClick={resetAll}>
                  Clear all filters
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => navigate('/admin')}>
                  Back to dashboard
                </Button>
              )
            }
          />
        }
        pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'orders' } : undefined}
      />
    </>
  )
}
