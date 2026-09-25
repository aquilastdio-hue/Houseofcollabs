import { Link } from 'react-router'
import { CalendarClock, ChevronRight, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatINR, formatRelative } from '@/lib/format'
import { isOverdue, ORDER_STATUS_META } from '@/lib/order-state'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { OrderListItem } from '@/services/orders.service'
import { OrderStatusBadge } from './order-status-badge'

/** Order summary row used in brand + creator order lists and dashboards. */
export function OrderCard({ order, perspective, className }: { order: OrderListItem; perspective: 'brand' | 'creator'; className?: string }) {
  const counterpart =
    perspective === 'brand'
      ? { name: order.creator?.display_name ?? 'Creator', image: order.creator?.profile_image_url }
      : { name: order.brand?.brand_name ?? 'Brand', image: order.brand?.brand_logo_url }
  const href = `/${perspective}/orders/${order.id}`
  const overdue = isOverdue(order.due_at, order.status)
  const hint = perspective === 'brand' ? ORDER_STATUS_META[order.status].brand : ORDER_STATUS_META[order.status].creator
  const amount = perspective === 'brand' ? order.total_amount : order.creator_earning_amount

  return (
    <Link
      to={href}
      className={cn(
        'group focus-ring flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition-[box-shadow,border-color] duration-300 hover:border-line-strong hover:shadow-card-hover sm:flex-row sm:items-center sm:p-5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Avatar src={counterpart.image} name={counterpart.name} size="lg" shape="rounded" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{order.service_title}</p>
            {order.requires_shipping && (
              <Badge tone="outline" size="sm">
                <Package /> Product
              </Badge>
            )}
          </div>
          <p className="truncate text-sm text-muted">
            {counterpart.name} · <span className="font-mono text-xs">{order.order_number}</span>
          </p>
          {hint && <p className="mt-1 hidden truncate text-xs text-faint sm:block">{hint}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <OrderStatusBadge status={order.status} />
          {order.due_at && !['completed', 'cancelled', 'refunded'].includes(order.status) ? (
            <span className={cn('inline-flex items-center gap-1 text-xs', overdue ? 'font-medium text-danger' : 'text-muted')}>
              <CalendarClock className="size-3.5" /> {overdue ? 'Overdue · ' : 'Due '}
              {formatDate(order.due_at, 'd MMM')}
            </span>
          ) : (
            <span className="text-xs text-muted">{formatRelative(order.updated_at)}</span>
          )}
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold tabular-nums">{formatINR(amount)}</p>
          <p className="text-xs text-muted">{perspective === 'brand' ? 'Total' : 'You earn'}</p>
        </div>
        <ChevronRight className="hidden size-5 text-faint transition-transform group-hover:translate-x-0.5 sm:block" />
      </div>
    </Link>
  )
}
