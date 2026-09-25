import * as React from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Gavel, SearchX } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatINR, formatRelative } from '@/lib/format'
import { getDispute } from '@/services/admin.service'
import { useOrder } from '@/hooks/use-orders'
import { Seo } from '@/components/shared/seo'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { DetailCard, DetailPageSkeleton } from '@/components/admin/detail'
import { DISPUTE_STATUS_META, OPEN_DISPUTE_STATUSES, StatusBadge } from '@/components/admin/admin-status'
import { DisputeEvidenceCard, DisputeInfoCard, DisputeOrderCard, DisputeStatusCard, DisputeThread, isOpenDispute } from '@/components/admin/dispute-parts'
import { ResolveDisputeDialog } from '@/components/admin/order-actions'
import { refundableAmount } from '@/components/admin/order-sections'
import type { Dispute } from '@/types'

function ResolutionCard({ orderId, dispute }: { orderId: string; dispute: Pick<Dispute, 'id' | 'reason' | 'previous_order_status'> }) {
  const [open, setOpen] = React.useState(false)
  const order = useOrder(orderId)
  const refundable = order.data ? refundableAmount(order.data.payments) : 0
  return (
    <DetailCard title="Resolution" description="Release the money, resume the work, or refund the brand.">
      <p className="mb-4 text-sm text-muted">
        {order.isPending
          ? 'Checking the payment…'
          : order.isError
            ? 'Couldn’t load the payment — refund options may be unavailable.'
            : refundable > 0
              ? `${formatINR(refundable, { precise: true })} is captured and can be refunded.`
              : 'No captured payment is left to refund.'}
      </p>
      <Button block onClick={() => setOpen(true)} disabled={order.isPending}>
        <Gavel /> Resolve dispute
      </Button>
      <ResolveDisputeDialog orderId={orderId} dispute={dispute} refundable={refundable} open={open} onOpenChange={setOpen} />
    </DetailCard>
  )
}

export default function DisputeDetail() {
  const { id = '' } = useParams()
  const query = useQuery({
    queryKey: qk.admin.dispute(id),
    queryFn: () => getDispute(id),
    enabled: !!id,
    // Dispute messages aren't streamed over Realtime; poll while the dispute is open.
    refetchInterval: (q) => (q.state.data && OPEN_DISPUTE_STATUSES.includes(q.state.data.status) ? 30_000 : false),
  })

  if (query.isPending) {
    return (
      <>
        <Seo title="Dispute" noindex />
        <DetailPageSkeleton />
      </>
    )
  }
  if (query.isError) {
    return (
      <>
        <Seo title="Dispute" noindex />
        <Breadcrumb items={[{ label: 'Disputes', href: '/admin/disputes' }, { label: 'Dispute' }]} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    )
  }
  const d = query.data
  if (!d) {
    return (
      <>
        <Seo title="Dispute not found" noindex />
        <Breadcrumb items={[{ label: 'Disputes', href: '/admin/disputes' }, { label: 'Not found' }]} />
        <EmptyState
          icon={<SearchX />}
          title="Dispute not found"
          description="This dispute doesn’t exist or the link is wrong."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/admin/disputes">Back to disputes</Link>
            </Button>
          }
        />
      </>
    )
  }

  const open = isOpenDispute(d.status)
  const orderNumber = d.order?.order_number ?? 'Order'

  return (
    <>
      <Seo title={`Dispute · ${orderNumber}`} noindex />
      <Breadcrumb items={[{ label: 'Disputes', href: '/admin/disputes' }, { label: orderNumber }]} />

      <header className="mb-6 flex flex-col gap-2 sm:mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-display-sm font-semibold sm:text-display-md">
            Dispute on <span className="font-mono">{orderNumber}</span>
          </h1>
          <StatusBadge meta={DISPUTE_STATUS_META} value={d.status} size="lg" />
        </div>
        <p className="text-muted">
          {d.reason} · opened {formatRelative(d.created_at)}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <DisputeInfoCard dispute={d} />
          <DisputeThread dispute={d} />
        </div>
        <aside className="space-y-6">
          {open && <ResolutionCard orderId={d.order_id} dispute={d} />}
          {open && <DisputeStatusCard dispute={d} />}
          <DisputeOrderCard dispute={d} />
          <DisputeEvidenceCard orderId={d.order_id} />
        </aside>
      </div>
    </>
  )
}
