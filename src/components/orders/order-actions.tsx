import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import {
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Gavel,
  PackageCheck,
  Play,
  RefreshCcw,
  Truck,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { useOrderAction } from '@/hooks/use-orders'
import { ORDER_STATUS_META, ACTIVE_STATUSES } from '@/lib/order-state'
import { formatDays, formatINR } from '@/lib/format'
import { toAppError } from '@/lib/errors'
import {
  acceptOrder,
  approveOrder,
  cancelOrder,
  declineOrder,
  markReceived,
  markShipped,
  openDispute,
  requestRevision,
  startWork,
  submitDeliverables,
  submitShippingAddress,
  type OrderDetail,
} from '@/services/orders.service'
import { payForOrder } from '@/services/payments.service'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { AddressDialog, DeliverDialog, DisputeDialog, RevisionDialog, ShipDialog } from './order-dialogs'
import type { ShippingAddressInput } from '@/types'

type Dialog = 'accept' | 'decline' | 'cancel' | 'address' | 'ship' | 'deliver' | 'revision' | 'approve' | 'dispute' | null

/**
 * The "what happens next" card. Shows only the actions the current party can
 * take; the database validates every transition regardless.
 */
export function OrderActions({ order, perspective }: { order: OrderDetail; perspective: 'brand' | 'creator' }) {
  const qc = useQueryClient()
  const [dialog, setDialog] = React.useState<Dialog>(null)
  const [paying, setPaying] = React.useState(false)
  const close = () => setDialog(null)
  const id = order.id
  const status = order.status
  const shipping = Array.isArray(order.shipping_details) ? order.shipping_details[0] : order.shipping_details
  const openDisputeExists = order.disputes.some((d) => ['created', 'under_review', 'waiting_for_brand', 'waiting_for_creator'].includes(d.status))
  const remainingRevisions = Math.max(0, order.revisions_allowed - order.revisions_used)
  const meta = ORDER_STATUS_META[status]
  const hint = perspective === 'brand' ? meta.brand : meta.creator

  const accept = useOrderAction(id, (shippingAddress?: ShippingAddressInput) => acceptOrder(id, shippingAddress), 'Order accepted')
  const decline = useOrderAction(id, (reason: string) => declineOrder(id, reason), 'Order declined')
  const cancel = useOrderAction(id, (reason: string) => cancelOrder(id, reason), 'Order cancelled')
  const address = useOrderAction(id, (a: ShippingAddressInput) => submitShippingAddress(id, a), 'Address updated')
  const ship = useOrderAction(id, (v: { courier: string; tracking_number: string; tracking_url: string }) => markShipped(id, v.courier, v.tracking_number, v.tracking_url), 'Marked as shipped')
  const received = useOrderAction(id, () => markReceived(id), 'Marked as received')
  const start = useOrderAction(id, () => startWork(id), 'Work started')
  const deliver = useOrderAction(id, (v: { items: Parameters<typeof submitDeliverables>[1]; note: string }) => submitDeliverables(id, v.items, v.note), status === 'revision_requested' ? 'Revision submitted' : 'Delivered — the brand has been notified')
  const revision = useOrderAction(id, (v: { reason: string; instructions: string; attachments: Parameters<typeof requestRevision>[3] }) => requestRevision(id, v.reason, v.instructions, v.attachments), 'Revision requested')
  const approve = useOrderAction(id, () => approveOrder(id), 'Order approved and completed')
  const dispute = useOrderAction(id, (v: { reason: string; description: string }) => openDispute(id, v.reason, v.description), 'Dispute opened — our team will review it')

  const run = <T,>(m: { mutate: (v: T, o?: { onSuccess?: () => void }) => void }, v: T) => m.mutate(v, { onSuccess: close })

  const payNow = async () => {
    setPaying(true)
    try {
      const r = await payForOrder(id, { onFailure: (msg) => toast.error(msg) })
      toast.success(r.status === 'captured' ? 'Payment successful — your order was sent to the creator.' : 'Payment received — confirming…')
    } catch (e) {
      toast.error(toAppError(e).message)
    } finally {
      setPaying(false)
      void qc.invalidateQueries({ queryKey: qk.orders.detail(id) })
      void qc.invalidateQueries({ queryKey: ['orders', 'list'] })
    }
  }

  const buttons: React.ReactNode[] = []
  if (perspective === 'brand') {
    if (status === 'payment_pending') {
      buttons.push(
        <Button key="pay" variant="accent" onClick={payNow} loading={paying}>
          <CreditCard /> Complete payment · {formatINR(order.total_amount)}
        </Button>,
        <Button key="cancel" variant="secondary" onClick={() => setDialog('cancel')}>
          Cancel order
        </Button>,
      )
    }
    if (status === 'creator_pending')
      buttons.push(
        <Button key="cancel" variant="secondary" onClick={() => setDialog('cancel')}>
          <XCircle /> Cancel & refund
        </Button>,
      )
    if (status === 'awaiting_shipment')
      buttons.push(
        <Button key="ship" onClick={() => setDialog('ship')} disabled={!shipping?.address}>
          <Truck /> Mark as shipped
        </Button>,
      )
    if (status === 'delivered' || status === 'revision_submitted') {
      buttons.push(
        <Button key="approve" variant="accent" onClick={() => setDialog('approve')}>
          <CheckCircle2 /> Approve & complete
        </Button>,
        <Button key="revise" variant="secondary" onClick={() => setDialog('revision')} disabled={remainingRevisions === 0}>
          <RefreshCcw /> Request revision{remainingRevisions === 0 ? ' (none left)' : ` (${remainingRevisions} left)`}
        </Button>,
      )
    }
  } else {
    if (status === 'creator_pending') {
      buttons.push(
        <Button key="accept" variant="accent" onClick={() => (order.requires_shipping ? setDialog('accept') : accept.mutate(undefined))} loading={accept.isPending}>
          <CheckCircle2 /> Accept order
        </Button>,
        <Button key="decline" variant="secondary" onClick={() => setDialog('decline')}>
          Decline
        </Button>,
      )
    }
    if ((status === 'accepted' || status === 'awaiting_shipment') && order.requires_shipping)
      buttons.push(
        <Button key="addr" variant="secondary" onClick={() => setDialog('address')}>
          Update shipping address
        </Button>,
      )
    if (status === 'shipped')
      buttons.push(
        <Button key="recv" onClick={() => received.mutate(undefined)} loading={received.isPending}>
          <PackageCheck /> Mark product received
        </Button>,
      )
    if ((status === 'accepted' && !order.requires_shipping) || status === 'received')
      buttons.push(
        <Button key="start" variant="secondary" onClick={() => start.mutate(undefined)} loading={start.isPending}>
          <Play /> Start work
        </Button>,
      )
    if ((status === 'accepted' && !order.requires_shipping) || status === 'received' || status === 'in_progress' || status === 'revision_requested')
      buttons.push(
        <Button key="deliver" variant="accent" onClick={() => setDialog('deliver')}>
          <UploadCloud /> {status === 'revision_requested' ? 'Submit revision' : 'Deliver content'}
        </Button>,
      )
  }
  const canDispute = ACTIVE_STATUSES.includes(status) && status !== 'creator_pending' && status !== 'disputed' && !openDisputeExists

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6" aria-label="Next steps">
      <p className="eyebrow text-muted">Next step</p>
      <p className="mt-1.5 font-display text-lg font-semibold tracking-tight">{hint || meta.label}</p>
      {perspective === 'creator' && status === 'creator_pending' && (
        <p className="mt-1 text-sm text-muted">
          You’ll earn {formatINR(order.creator_earning_amount)} · deliver within {formatDays(order.delivery_days)} of {order.requires_shipping ? 'receiving the product' : 'accepting'}.
        </p>
      )}
      {status === 'revision_requested' && perspective === 'creator' && (() => {
        const latest = [...order.order_revisions].sort((a, b) => b.revision_number - a.revision_number)[0]
        return latest ? (
          <div className="mt-3 rounded-control bg-warning-soft p-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-warning">
              <CircleAlert className="size-4" /> Revision {latest.revision_number}: {latest.reason}
            </p>
            {latest.instructions && <p className="mt-1 whitespace-pre-wrap text-ink-soft">{latest.instructions}</p>}
          </div>
        ) : null
      })()}
      {order.refund_required && perspective === 'brand' && (
        <p className="mt-3 rounded-control bg-info-soft p-3 text-sm text-info">Your refund is being processed. It usually reaches you in 5–7 business days.</p>
      )}

      {(buttons.length > 0 || canDispute) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {buttons}
          {canDispute && (
            <Button variant="danger-ghost" onClick={() => setDialog('dispute')}>
              <Gavel /> Report a problem
            </Button>
          )}
        </div>
      )}

      <AddressDialog
        open={dialog === 'accept'}
        onOpenChange={(o) => !o && close()}
        title="Accept & share your delivery address"
        description="This service needs the brand’s product. Your address is only visible to this brand for this order."
        submitLabel="Accept order"
        loading={accept.isPending}
        initial={shipping}
        onSubmit={(a) => run(accept, a)}
      />
      <AddressDialog
        open={dialog === 'address'}
        onOpenChange={(o) => !o && close()}
        title="Update shipping address"
        submitLabel="Save address"
        loading={address.isPending}
        initial={shipping}
        onSubmit={(a) => run(address, a)}
      />
      <ConfirmDialog
        open={dialog === 'decline'}
        onOpenChange={(o) => !o && close()}
        title="Decline this order?"
        description="The brand is refunded in full. Declining often affects how you rank in search."
        reasonLabel="Reason (shared with the brand)"
        reasonPlaceholder="I’m fully booked until next month"
        confirmLabel="Decline order"
        destructive
        loading={decline.isPending}
        onConfirm={(reason) => run(decline, reason)}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && close()}
        title="Cancel this order?"
        description={status === 'payment_pending' ? 'Nothing has been charged yet.' : 'The creator hasn’t accepted yet, so you’ll get a full refund.'}
        reasonLabel="Reason"
        reasonRequired={false}
        confirmLabel="Cancel order"
        destructive
        loading={cancel.isPending}
        onConfirm={(reason) => run(cancel, reason)}
      />
      <ShipDialog open={dialog === 'ship'} onOpenChange={(o) => !o && close()} loading={ship.isPending} onSubmit={(v) => run(ship, v)} />
      <DeliverDialog
        open={dialog === 'deliver'}
        onOpenChange={(o) => !o && close()}
        orderId={id}
        isRevision={status === 'revision_requested'}
        loading={deliver.isPending}
        onSubmit={(items, note) => run(deliver, { items, note })}
      />
      <RevisionDialog
        open={dialog === 'revision'}
        onOpenChange={(o) => !o && close()}
        orderId={id}
        remaining={remainingRevisions}
        loading={revision.isPending}
        onSubmit={(reason, instructions, attachments) => run(revision, { reason, instructions, attachments })}
      />
      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && close()}
        title="Approve and complete this order?"
        description={`The creator will be paid for this order. Make sure you’ve downloaded your files — you can still access them later.`}
        confirmLabel="Approve & complete"
        loading={approve.isPending}
        onConfirm={() => run(approve, undefined)}
      />
      <DisputeDialog open={dialog === 'dispute'} onOpenChange={(o) => !o && close()} loading={dispute.isPending} onSubmit={(reason, description) => run(dispute, { reason, description })} />
    </section>
  )
}
