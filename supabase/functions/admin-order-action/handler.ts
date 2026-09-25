// Admin order operations (all audited):
//   refund          { amount?, reason }           → Razorpay refund + record_refund
//   cancel          { reason }
//   force_complete  { reason }                     (disputed → completed, delivered → approved → completed)
//   set_status      { status, reason }             (validated by the DB state machine)
//   resolve_dispute { dispute_id, outcome, note, amount? }
import { handler, HttpError, json, must, readJson, requireString, requireUuid } from '../_shared/http.ts'
import { adminClient, audit, requireAdmin } from '../_shared/supabase.ts'
import { razorpay } from '../_shared/razorpay.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

type Order = { id: string; order_number: string; status: string; total_amount: number }
type Payment = { id: string; amount: number; refunded_amount: number; provider_payment_id: string | null; status: string }

const OUTCOMES = ['release_to_creator', 'resume_order', 'rejected', 'refund_brand', 'partial_refund'] as const

async function refundPayment(db: SupabaseClient, order: Order, adminId: string, reason: string, amount?: number) {
  const payment = must(
    await db
      .from('payments')
      .select('id, amount, refunded_amount, provider_payment_id, status')
      .eq('order_id', order.id)
      .in('status', ['captured', 'partially_refunded'])
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as Payment | null
  if (!payment?.provider_payment_id) throw new HttpError(422, 'This order has no captured payment to refund.', 'NO_CAPTURED_PAYMENT')

  const refundable = Math.round((Number(payment.amount) - Number(payment.refunded_amount)) * 100) / 100
  const value = amount === undefined ? refundable : Math.round(amount * 100) / 100
  if (!(value > 0) || value > refundable) throw new HttpError(422, `Refund must be between ₹1 and ₹${refundable}.`, 'INVALID_REFUND_AMOUNT')

  const refund = await razorpay.refund(payment.provider_payment_id, Math.round(value * 100), {
    reason: reason.slice(0, 200),
    order_number: order.order_number,
  })
  must(
    await db.rpc('record_refund', {
      p_payment_id: payment.id,
      p_provider_refund_id: refund.id,
      p_amount: value,
      p_status: refund.status === 'processed' ? 'processed' : refund.status === 'failed' ? 'failed' : 'pending',
      p_reason: reason,
      p_actor_id: adminId,
      p_raw: refund,
    }),
  )
  return { refund_id: refund.id, amount: value, status: refund.status }
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const admin = await requireAdmin(req)
  const body = await readJson<Record<string, unknown>>(req)
  const orderId = requireUuid(body.order_id, 'order_id')
  const action = requireString(body.action, 'action', 40)
  const db = adminClient()

  const order = must(await db.from('orders').select('id, order_number, status, total_amount').eq('id', orderId).maybeSingle()) as Order | null
  if (!order) throw new HttpError(404, 'Order not found.', 'ORDER_NOT_FOUND')

  const transition = (to: string, reason: string) =>
    db.rpc('admin_transition_order', { p_order_id: order.id, p_to: to, p_actor_id: admin.id, p_reason: reason }).then(must)

  let result: unknown = null
  switch (action) {
    case 'refund': {
      const reason = requireString(body.reason, 'reason', 1000)
      const amount = body.amount === undefined || body.amount === null || body.amount === '' ? undefined : Number(body.amount)
      if (amount !== undefined && !Number.isFinite(amount)) throw new HttpError(400, 'Invalid amount.', 'BAD_REQUEST')
      // Active orders are cancelled first so the state machine allows `refunded`.
      if (!['cancelled', 'disputed', 'completed', 'refunded'].includes(order.status)) await transition('cancelled', reason)
      result = await refundPayment(db, order, admin.id, reason, amount)
      break
    }
    case 'cancel': {
      result = await transition('cancelled', requireString(body.reason, 'reason', 1000))
      break
    }
    case 'force_complete': {
      const reason = requireString(body.reason, 'reason', 1000)
      if (order.status === 'disputed') result = await transition('completed', reason)
      else if (['delivered', 'revision_submitted'].includes(order.status)) result = await transition('approved', reason)
      else throw new HttpError(422, 'Only delivered or disputed orders can be force-completed.', 'INVALID_ORDER_STATE')
      break
    }
    case 'set_status': {
      result = await transition(requireString(body.status, 'status', 40), requireString(body.reason, 'reason', 1000))
      break
    }
    case 'resolve_dispute': {
      const disputeId = requireUuid(body.dispute_id, 'dispute_id')
      const outcome = body.outcome as (typeof OUTCOMES)[number]
      if (!OUTCOMES.includes(outcome)) throw new HttpError(400, 'Unknown outcome.', 'BAD_REQUEST')
      const note = requireString(body.note, 'note', 2000)
      const amount = body.amount === undefined || body.amount === null || body.amount === '' ? undefined : Number(body.amount)
      if (outcome === 'partial_refund' && !(amount && amount > 0)) throw new HttpError(422, 'Enter the partial refund amount.', 'AMOUNT_REQUIRED')
      let refund = null
      if (outcome === 'refund_brand') refund = await refundPayment(db, order, admin.id, note)
      if (outcome === 'partial_refund') refund = await refundPayment(db, order, admin.id, note, amount)
      const dispute = must(
        await db.rpc('resolve_dispute', { p_dispute_id: disputeId, p_actor_id: admin.id, p_outcome: outcome, p_note: note, p_refund_amount: refund?.amount ?? null }),
      )
      result = { dispute, refund }
      break
    }
    default:
      throw new HttpError(400, 'Unknown action.', 'BAD_REQUEST')
  }

  await audit(admin.id, 'admin_order_action', 'order', order.id, { action, order_number: order.order_number })
  return json({ ok: true, result })
})
