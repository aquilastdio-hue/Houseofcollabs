import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, Ban, CheckCheck, ListRestart, RotateCcw } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatINR } from '@/lib/format'
import { ORDER_STATUS_META, statusLabel } from '@/lib/order-state'
import { orderAction, type OrderAdminAction } from '@/services/admin.service'
import type { OrderDetail } from '@/services/orders.service'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { CheckboxRow } from '@/components/ui/checkbox'
import { RadioGroup } from '@/components/ui/radio-group'
import type { OrderStatus } from '@/types'
import { toPaise } from './admin-utils'
import { ChoiceRow } from './choice'
import { DetailCard } from './detail'
import { FormDialog, Notice } from './form-dialog'
import { ORDER_STATUSES } from './order-presets'
import { refundableAmount } from './order-sections'
import { useAdminMutation } from './use-admin-mutation'

const SUCCESS: Record<OrderAdminAction['action'], string> = {
  refund: 'Refund initiated',
  cancel: 'Order cancelled',
  force_complete: 'Order completed',
  set_status: 'Order status updated',
}

/**
 * Runs an `admin-order-action` Edge Function call. Server messages (e.g. an
 * invalid transition) surface through the global mutation toast.
 */
export function useOrderAdminAction(orderId: string, onDone?: () => void) {
  return useAdminMutation((payload: OrderAdminAction) => orderAction(orderId, payload), {
    invalidate: [qk.orders.detail(orderId), qk.admin.all],
    success: (_d, p) => SUCCESS[p.action],
    onSuccess: () => onDone?.(),
  })
}

const amountString = /^\d+(\.\d{1,2})?$/

// ---------------------------------------------------------------------------
// Refund
// ---------------------------------------------------------------------------
function refundSchema(max: number) {
  return z
    .object({
      mode: z.enum(['full', 'partial']),
      amount: z.string().trim(),
      reason: z.string().trim().min(3, 'Add a short reason').max(500, 'Keep it under 500 characters'),
    })
    .superRefine((v, ctx) => {
      if (v.mode !== 'partial') return
      const n = Number(v.amount)
      if (!v.amount || !amountString.test(v.amount) || !(n > 0)) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter an amount in rupees, e.g. 500 or 499.50' })
      else if (n > max) ctx.addIssue({ code: 'custom', path: ['amount'], message: `You can refund at most ${formatINR(max, { precise: true })}` })
    })
}

type RefundValues = z.infer<ReturnType<typeof refundSchema>>

function RefundDialog({ order, open, onOpenChange }: { order: OrderDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refundable = refundableAmount(order.payments)
  const schema = React.useMemo(() => refundSchema(refundable), [refundable])
  const form = useForm<RefundValues>({ resolver: zodResolver(schema), defaultValues: { mode: 'full', amount: '', reason: '' } })
  const act = useOrderAdminAction(order.id, () => onOpenChange(false))
  const mode = form.watch('mode')
  const e = form.formState.errors

  React.useEffect(() => {
    if (!open) form.reset({ mode: 'full', amount: '', reason: '' })
  }, [open, form])

  const onSubmit = form.handleSubmit((v) =>
    act.mutate({ action: 'refund', reason: v.reason, amount: v.mode === 'partial' ? toPaise(Number(v.amount)) : undefined }),
  )

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Refund the brand"
      description={`Refunds go back to the brand’s original payment method through Razorpay. Up to ${formatINR(refundable, { precise: true })} can be refunded.`}
      submitLabel={mode === 'partial' ? 'Refund amount' : 'Refund in full'}
      destructive
      loading={act.isPending}
      onSubmit={onSubmit}
    >
      <RadioGroup value={mode} onValueChange={(v) => form.setValue('mode', v as RefundValues['mode'], { shouldValidate: true })} aria-label="Refund type">
        <ChoiceRow id="refund-full" value="full" checked={mode === 'full'} title={`Full refund · ${formatINR(refundable, { precise: true })}`} description="Everything still captured on this order." />
        <ChoiceRow id="refund-partial" value="partial" checked={mode === 'partial'} title="Partial refund" description="Refund part of the captured amount." />
      </RadioGroup>
      {mode === 'partial' && (
        <Field label="Amount (₹)" htmlFor="refund-amount" required error={e.amount?.message} hint={`Maximum ${formatINR(refundable, { precise: true })}`}>
          <Input id="refund-amount" type="text" inputMode="decimal" autoComplete="off" placeholder="0.00" {...form.register('amount')} />
        </Field>
      )}
      <Field label="Reason" htmlFor="refund-reason" required error={e.reason?.message} hint="Stored with the refund and in the audit log.">
        <Textarea id="refund-reason" rows={3} maxLength={500} {...form.register('reason')} />
      </Field>
      {order.status !== 'cancelled' && order.status !== 'completed' && (
        <Notice tone="warning" icon={<AlertTriangle />}>
          This order is still “{statusLabel(order.status)}”. A full refund on an active order doesn’t stop the work — cancel the order as well if it shouldn’t continue.
        </Notice>
      )}
    </FormDialog>
  )
}

// ---------------------------------------------------------------------------
// Set status
// ---------------------------------------------------------------------------
/** Moves the order workflow lets an admin make (the database is still the judge). */
const ADMIN_TARGETS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  payment_pending: ['cancelled'],
  order_placed: ['cancelled'],
  creator_pending: ['cancelled'],
  accepted: ['cancelled'],
  awaiting_shipment: ['cancelled'],
  shipped: ['cancelled'],
  received: ['cancelled'],
  in_progress: ['cancelled'],
  delivered: ['approved', 'cancelled'],
  revision_requested: ['cancelled'],
  revision_submitted: ['approved', 'delivered', 'cancelled'],
  approved: ['completed'],
}

const TARGET_HINTS: Partial<Record<OrderStatus, string>> = {
  approved: 'Approving completes the order right away and releases the creator’s earning.',
  completed: 'Completing releases the creator’s earning.',
  cancelled: 'Paid orders are flagged “refund due” — issue the refund afterwards.',
  refunded: 'Use Refund instead: it moves the money and marks the order refunded.',
}

const statusSchema = z.object({
  status: z.string().min(1, 'Choose a status'),
  reason: z.string().trim().min(3, 'Add a short reason').max(500, 'Keep it under 500 characters'),
})
type StatusValues = z.infer<typeof statusSchema>

function SetStatusDialog({ order, open, onOpenChange }: { order: OrderDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [showAll, setShowAll] = React.useState(false)
  const form = useForm<StatusValues>({ resolver: zodResolver(statusSchema), defaultValues: { status: '', reason: '' } })
  const act = useOrderAdminAction(order.id, () => onOpenChange(false))
  const e = form.formState.errors
  const target = form.watch('status') as OrderStatus | ''
  const allowed = ADMIN_TARGETS[order.status] ?? []
  const options = (showAll ? ORDER_STATUSES.filter((s) => s !== order.status) : allowed).map((s) => ({
    value: s,
    label: showAll && !allowed.includes(s) ? `${ORDER_STATUS_META[s].label} (not a standard move)` : ORDER_STATUS_META[s].label,
  }))

  React.useEffect(() => {
    if (!open) {
      form.reset({ status: '', reason: '' })
      setShowAll(false)
    }
  }, [open, form])

  const onSubmit = form.handleSubmit((v) => act.mutate({ action: 'set_status', status: v.status as OrderStatus, reason: v.reason }))

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change order status"
      description={
        <>
          Currently <OrderStatusBadge status={order.status} size="sm" />. The order workflow in the database validates every change and rejects moves that aren’t allowed.
        </>
      }
      submitLabel="Update status"
      loading={act.isPending}
      onSubmit={onSubmit}
    >
      {allowed.length === 0 && !showAll && (
        <Notice tone="info">There are no standard admin moves from “{statusLabel(order.status)}”. Show every status to try an override.</Notice>
      )}
      <Field label="New status" htmlFor="set-status" required error={e.status?.message} hint={target ? TARGET_HINTS[target] : undefined}>
        <Select
          id="set-status"
          value={target}
          onValueChange={(v) => form.setValue('status', v, { shouldValidate: true })}
          options={options}
          placeholder={options.length ? 'Choose a status' : 'No statuses available'}
          disabled={options.length === 0}
        />
      </Field>
      <CheckboxRow
        id="set-status-all"
        label="Show every status"
        description="For unusual fixes. Anything outside the workflow is rejected by the database."
        checked={showAll}
        onCheckedChange={(v) => {
          setShowAll(v)
          form.setValue('status', '')
        }}
      />
      <Field label="Reason" htmlFor="set-status-reason" required error={e.reason?.message} hint="Visible in the order history.">
        <Textarea id="set-status-reason" rows={3} maxLength={500} {...form.register('reason')} />
      </Field>
    </FormDialog>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
type DialogKey = 'refund' | 'cancel' | 'force_complete' | 'set_status'

const CLOSED: OrderStatus[] = ['completed', 'cancelled', 'refunded', 'draft']
const FORCE_COMPLETE_FROM: OrderStatus[] = ['delivered', 'revision_submitted', 'approved']

/** Admin-only order actions. Every action needs a reason and is audited server-side. */
export function OrderActionsPanel({ order }: { order: OrderDetail }) {
  const [dialog, setDialog] = React.useState<DialogKey | null>(null)
  const close = () => setDialog(null)
  const quick = useOrderAdminAction(order.id, close)

  const refundable = refundableAmount(order.payments)
  const canCancel = !CLOSED.includes(order.status)
  const canForceComplete = FORCE_COMPLETE_FROM.includes(order.status)

  return (
    <DetailCard title="Admin actions" description="Each action needs a reason and is recorded in the audit log.">
      <div className="space-y-3">
        {order.refund_required && (
          <Notice tone="danger" icon={<AlertTriangle />}>
            Refund due — this order was cancelled after payment. {refundable > 0 ? `${formatINR(refundable, { precise: true })} is still captured.` : 'No captured amount remains.'}
          </Notice>
        )}
        <div className="grid gap-2">
          <Button variant="secondary" block disabled={refundable <= 0} onClick={() => setDialog('refund')} className="justify-start">
            <RotateCcw /> Refund{refundable > 0 ? ` · up to ${formatINR(refundable)}` : ''}
          </Button>
          {refundable <= 0 && <p className="-mt-1 px-1 text-xs text-muted">Refunds need a captured payment with an unrefunded balance.</p>}
          <Button variant="secondary" block disabled={!canForceComplete} onClick={() => setDialog('force_complete')} className="justify-start">
            <CheckCheck /> Force complete
          </Button>
          <Button variant="secondary" block onClick={() => setDialog('set_status')} className="justify-start">
            <ListRestart /> Set status…
          </Button>
          <Button variant="danger-ghost" block disabled={!canCancel} onClick={() => setDialog('cancel')} className="justify-start">
            <Ban /> Cancel order
          </Button>
        </div>
        {!canForceComplete && <p className="px-1 text-xs text-muted">Force complete is available for delivered, revision-submitted or approved orders.</p>}
      </div>

      <RefundDialog order={order} open={dialog === 'refund'} onOpenChange={(o) => !o && close()} />
      <SetStatusDialog order={order} open={dialog === 'set_status'} onOpenChange={(o) => !o && close()} />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && close()}
        title={`Cancel order ${order.order_number}?`}
        description={
          capturedPayment(order)
            ? 'The order stops immediately and is flagged “refund due”. Issue the refund from this panel afterwards.'
            : 'The order stops immediately. No payment was captured, so nothing needs refunding.'
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        loading={quick.isPending}
        reasonLabel="Reason (visible to both parties)"
        reasonPlaceholder="Why is this order being cancelled?"
        onConfirm={(reason) => quick.mutate({ action: 'cancel', reason })}
      />
      <ConfirmDialog
        open={dialog === 'force_complete'}
        onOpenChange={(o) => !o && close()}
        title={`Complete order ${order.order_number}?`}
        description="Approves the delivery on the brand’s behalf and completes the order. The creator’s earning is released."
        confirmLabel="Complete order"
        loading={quick.isPending}
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Brand unresponsive for 10 days after delivery."
        onConfirm={(reason) => quick.mutate({ action: 'force_complete', reason })}
      />
    </DetailCard>
  )
}

function capturedPayment(order: OrderDetail) {
  return order.payments.some((p) => p.status === 'captured' || p.status === 'partially_refunded')
}
