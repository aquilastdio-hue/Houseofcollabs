// Razorpay → Supabase webhook. Verifies X-Razorpay-Signature over the RAW
// body, de-duplicates by event id, and applies payment/refund/payout events
// through service-only, idempotent database functions.
import { handler, json } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'
import { razorpay, sha256Hex, verifyWebhookSignature, type RzpPayment, type RzpPayout, type RzpRefund } from '../_shared/razorpay.ts'

type Event = {
  event: string
  payload: {
    payment?: { entity: RzpPayment }
    refund?: { entity: RzpRefund }
    payout?: { entity: RzpPayout }
  }
}

const isNotOurs = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P0002'

async function applyEvent(evt: Event) {
  const db = adminClient()
  const payment = evt.payload.payment?.entity
  switch (evt.event) {
    case 'payment.authorized': {
      // Only needed when the account captures manually; Orders use auto-capture.
      if (!payment?.order_id) return 'ignored'
      const captured = await razorpay.capturePayment(payment.id, payment.amount, payment.currency).catch(() => null)
      if (captured?.status !== 'captured') return 'authorized'
      const { error } = await db.rpc('confirm_order_payment', {
        p_provider_order_id: payment.order_id,
        p_provider_payment_id: payment.id,
        p_method: captured.method ?? null,
        p_amount_paise: captured.amount,
        p_raw: captured,
      })
      if (error && !isNotOurs(error)) throw error
      return 'captured'
    }
    case 'payment.captured':
    case 'order.paid': {
      if (!payment?.order_id) return 'ignored'
      const { error } = await db.rpc('confirm_order_payment', {
        p_provider_order_id: payment.order_id,
        p_provider_payment_id: payment.id,
        p_method: payment.method ?? null,
        p_amount_paise: payment.amount,
        p_raw: payment,
      })
      if (error && !isNotOurs(error)) throw error
      return error ? 'unknown_order' : 'captured'
    }
    case 'payment.failed': {
      if (!payment?.order_id) return 'ignored'
      const { error } = await db.rpc('mark_payment_failed', {
        p_provider_order_id: payment.order_id,
        p_provider_payment_id: payment.id,
        p_error_code: payment.error_code ?? null,
        p_error_description: payment.error_description ?? null,
        p_raw: payment,
      })
      if (error && !isNotOurs(error)) throw error
      return 'failed'
    }
    case 'refund.created':
    case 'refund.processed':
    case 'refund.failed': {
      const refund = evt.payload.refund?.entity
      if (!refund) return 'ignored'
      const { data: pay } = await db.from('payments').select('id').eq('provider_payment_id', refund.payment_id).maybeSingle()
      if (!pay) return 'unknown_payment'
      const status = evt.event === 'refund.processed' ? 'processed' : evt.event === 'refund.failed' ? 'failed' : 'pending'
      const { error } = await db.rpc('record_refund', {
        p_payment_id: pay.id,
        p_provider_refund_id: refund.id,
        p_amount: refund.amount / 100,
        p_status: status,
        p_reason: refund.notes?.reason ?? null,
        p_actor_id: null,
        p_raw: refund,
      })
      if (error) throw error
      return status
    }
    case 'payout.processed':
    case 'payout.failed':
    case 'payout.reversed': {
      const payout = evt.payload.payout?.entity
      if (!payout) return 'ignored'
      const { data: txn } = await db
        .from('payout_transactions')
        .select('payout_request_id, payout_requests(status, processed_by)')
        .eq('provider_reference', payout.id)
        .maybeSingle()
      const request = (txn as { payout_request_id: string; payout_requests: { status: string; processed_by: string | null } | null } | null)
      if (!request || !request.payout_requests?.processed_by) return 'unknown_payout'
      if (!['pending', 'processing'].includes(request.payout_requests.status)) return 'already_final'
      const { error } = await db.rpc('complete_payout', {
        p_payout_request_id: request.payout_request_id,
        p_actor_id: request.payout_requests.processed_by,
        p_action: evt.event === 'payout.processed' ? 'paid' : 'failed',
        p_provider: 'razorpayx',
        p_reference: payout.utr ?? payout.id,
        p_note: evt.event === 'payout.processed' ? 'Paid via RazorpayX' : `RazorpayX ${evt.event.split('.')[1]}`,
        p_metadata: { razorpayx: payout },
      })
      if (error) throw error
      return evt.event
    }
    default:
      return 'ignored'
  }
}

export const handle = handler(
  async (req) => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const raw = await req.text()
    if (!(await verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature')))) {
      return json({ error: 'Invalid signature' }, 400)
    }
    let evt: Event
    try {
      evt = JSON.parse(raw) as Event
    } catch {
      return json({ error: 'Invalid payload' }, 400)
    }
    const eventId = req.headers.get('x-razorpay-event-id') ?? (await sha256Hex(raw))
    const db = adminClient()

    const { data: inserted } = await db
      .from('webhook_events')
      .upsert({ provider: 'razorpay', event_id: eventId, event_type: evt.event, payload: evt }, { onConflict: 'provider,event_id', ignoreDuplicates: true })
      .select('id')
    if (!inserted?.length) {
      const { data: prior } = await db.from('webhook_events').select('processed_at').eq('provider', 'razorpay').eq('event_id', eventId).maybeSingle()
      if (prior?.processed_at) return json({ ok: true, duplicate: true })
    }

    try {
      const outcome = await applyEvent(evt)
      await db.from('webhook_events').update({ processed_at: new Date().toISOString(), error: null }).eq('provider', 'razorpay').eq('event_id', eventId)
      return json({ ok: true, outcome })
    } catch (e) {
      const message = e instanceof Error ? e.message : JSON.stringify(e)
      await db.from('webhook_events').update({ error: message.slice(0, 1000) }).eq('provider', 'razorpay').eq('event_id', eventId)
      console.error('webhook processing failed', evt.event, message)
      // 500 → Razorpay retries with backoff.
      return json({ error: 'Processing failed' }, 500)
    }
  },
  { cors: false },
)
