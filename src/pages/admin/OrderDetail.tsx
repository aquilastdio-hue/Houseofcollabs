import { Link, useParams } from 'react-router'
import { AlertTriangle, CalendarClock, PackageX } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { isOverdue } from '@/lib/order-state'
import { useOrder } from '@/hooks/use-orders'
import { Seo } from '@/components/shared/seo'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DetailPageSkeleton, IdText } from '@/components/admin/detail'
import { Notice } from '@/components/admin/form-dialog'
import { OrderActionsPanel } from '@/components/admin/order-actions'
import {
  BriefSnapshotCard,
  DeliverablesCard,
  HistoryCard,
  OrderItemsCard,
  OrderMoney,
  OrderParties,
  PaymentsCard,
  ReviewsCard,
  RevisionsCard,
  ShippingCard,
  TimelineCard,
} from '@/components/admin/order-sections'

export default function OrderDetail() {
  const { id = '' } = useParams()
  const query = useOrder(id || undefined)

  if (query.isPending) {
    return (
      <>
        <Seo title="Order" noindex />
        <DetailPageSkeleton />
      </>
    )
  }
  if (query.isError) {
    return (
      <>
        <Seo title="Order" noindex />
        <Breadcrumb items={[{ label: 'Orders', href: '/admin/orders' }, { label: 'Order' }]} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    )
  }
  const order = query.data
  if (!order) {
    return (
      <>
        <Seo title="Order not found" noindex />
        <Breadcrumb items={[{ label: 'Orders', href: '/admin/orders' }, { label: 'Not found' }]} />
        <EmptyState
          icon={<PackageX />}
          title="Order not found"
          description="This order doesn’t exist or the link is wrong."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/admin/orders">Back to orders</Link>
            </Button>
          }
        />
      </>
    )
  }

  const overdue = isOverdue(order.due_at, order.status)

  return (
    <>
      <Seo title={`Order ${order.order_number}`} noindex />
      <Breadcrumb items={[{ label: 'Orders', href: '/admin/orders' }, { label: order.order_number }]} />

      <header className="mb-6 flex flex-col gap-3 sm:mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{order.order_number}</h1>
          <OrderStatusBadge status={order.status} size="lg" />
          {order.refund_required && (
            <Badge tone="danger" size="lg">
              <AlertTriangle /> Refund due
            </Badge>
          )}
        </div>
        <p className="text-lg text-ink-soft">{order.service_title}</p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>Created {formatDateTime(order.created_at)}</span>
          {order.paid_at && <span>Paid {formatDateTime(order.paid_at)}</span>}
          {order.completed_at && <span>Completed {formatDateTime(order.completed_at)}</span>}
          {order.cancelled_at && <span>Cancelled {formatDateTime(order.cancelled_at)}</span>}
          {order.due_at && !['completed', 'cancelled', 'refunded'].includes(order.status) && (
            <span className={overdue ? 'inline-flex items-center gap-1 font-medium text-danger' : 'inline-flex items-center gap-1'}>
              <CalendarClock className="size-3.5" aria-hidden /> {overdue ? 'Overdue since' : 'Due'} {formatDateTime(order.due_at)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            Id <IdText value={order.id} />
          </span>
        </p>
      </header>

      {order.cancellation_reason && (
        <div className="mb-6 space-y-3">
          {order.cancellation_reason && (
            <Notice tone="info">
              <span className="font-medium">Cancellation reason:</span> {order.cancellation_reason}
            </Notice>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <OrderParties order={order} />
          <OrderItemsCard order={order} />
          <BriefSnapshotCard order={order} />
          <DeliverablesCard order={order} />
          <RevisionsCard order={order} />
          <ShippingCard order={order} />
          <PaymentsCard order={order} />
          <ReviewsCard order={order} />
          <HistoryCard order={order} />
        </div>
        <aside className="space-y-6">
          <OrderActionsPanel order={order} />
          <OrderMoney order={order} />
          <TimelineCard order={order} />
        </aside>
      </div>
    </>
  )
}
