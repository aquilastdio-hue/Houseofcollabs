import { AlertTriangle } from 'lucide-react'
import { formatDate, formatINR } from '@/lib/format'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import type { Column } from '@/components/shared/data-table'
import type { AdminOrderListItem } from '@/services/admin.service'
import type { PaymentStatus } from '@/types'
import { PAYMENT_STATUS_META, StatusBadge } from './admin-status'
import { CellLink } from './detail'

const SETTLED: PaymentStatus[] = ['captured', 'partially_refunded', 'refunded']

/** The payment that best represents an order: settled first, then authorized, else the latest attempt. */
export function primaryPayment<P extends { status: PaymentStatus }>(payments: P[] | null | undefined): P | null {
  if (!payments?.length) return null
  return payments.find((p) => SETTLED.includes(p.status)) ?? payments.find((p) => p.status === 'authorized') ?? payments[payments.length - 1] ?? null
}

type OrderColumnKey = 'number' | 'brand' | 'creator' | 'service' | 'amount' | 'fee' | 'payment' | 'status' | 'created'

const ORDER_COLUMNS: Record<OrderColumnKey, Column<AdminOrderListItem>> = {
  number: {
    key: 'number',
    header: 'Order',
    cell: (o) => (
      <span className="flex flex-col">
        <CellLink to={`/admin/orders/${o.id}`} className="font-mono text-xs">
          {o.order_number}
        </CellLink>
        <span className="truncate text-xs text-muted md:hidden">{o.service_title}</span>
      </span>
    ),
  },
  brand: {
    key: 'brand',
    header: 'Brand',
    cell: (o) =>
      o.brand ? (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar src={o.brand.brand_logo_url} name={o.brand.brand_name} size="xs" shape="rounded" />
          <span className="truncate">
            <CellLink to={`/admin/brands/${o.brand.id}`} className="font-normal">
              {o.brand.brand_name}
            </CellLink>
          </span>
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  creator: {
    key: 'creator',
    header: 'Creator',
    cell: (o) =>
      o.creator ? (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar src={o.creator.profile_image_url} name={o.creator.display_name} size="xs" />
          <span className="truncate">
            <CellLink to={`/admin/creators/${o.creator.id}`} className="font-normal">
              {o.creator.display_name}
            </CellLink>
          </span>
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  service: {
    key: 'service',
    header: 'Service',
    className: 'max-w-56',
    cell: (o) => (
      <span className="block truncate" title={o.service_title}>
        {o.service_title}
      </span>
    ),
  },
  amount: { key: 'amount', header: 'Amount', className: 'tabular-nums whitespace-nowrap font-medium', cell: (o) => formatINR(o.total_amount) },
  fee: { key: 'fee', header: 'Fee', className: 'tabular-nums whitespace-nowrap text-muted', cell: (o) => formatINR(o.platform_fee_amount) },
  payment: {
    key: 'payment',
    header: 'Payment',
    cell: (o) => {
      const p = primaryPayment(o.payments)
      return p ? <StatusBadge meta={PAYMENT_STATUS_META} value={p.status} size="sm" /> : <span className="text-xs text-faint">No payment</span>
    },
  },
  status: {
    key: 'status',
    header: 'Status',
    cell: (o) => (
      <span className="flex flex-wrap items-center gap-1">
        <OrderStatusBadge status={o.status} size="sm" />
        {o.refund_required && (
          <Badge tone="danger" size="sm">
            <AlertTriangle /> Refund due
          </Badge>
        )}
      </span>
    ),
  },
  created: {
    key: 'created',
    header: 'Created',
    className: 'whitespace-nowrap text-muted',
    cell: (o) => (
      <span title={formatDate(o.created_at, 'd MMM yyyy, h:mm a')}>
        {formatDate(o.created_at, 'd MMM yyyy')}
        <span className="block text-xs text-faint">{formatDate(o.created_at, 'h:mm a')}</span>
      </span>
    ),
  },
}

export function orderColumns(keys: OrderColumnKey[] = ['number', 'brand', 'creator', 'service', 'amount', 'fee', 'payment', 'status', 'created']) {
  return keys.map((k) => ORDER_COLUMNS[k])
}
