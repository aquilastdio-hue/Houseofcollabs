// POST { order_id } → creates (or reuses) a Razorpay order for an order that is
// awaiting payment. The amount always comes from the database, never the client.
import { handler, HttpError, json, must, readJson, requireUuid } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { razorpay, razorpayConfigured, razorpayKeyId } from '../_shared/razorpay.ts'

type OrderRow = {
  id: string
  order_number: string
  status: string
  total_amount: number
  currency: string
  service_title: string
  brand: { id: string; profile_id: string; brand_name: string; contact_phone: string | null } | null
  creator: { display_name: string } | null
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const user = await requireUser(req)
  const { order_id } = await readJson<{ order_id?: string }>(req)
  const orderId = requireUuid(order_id, 'order_id')
  if (!razorpayConfigured()) throw new HttpError(503, 'Payments are not configured yet. Please contact support.', 'PAYMENTS_NOT_CONFIGURED')

  const db = adminClient()
  const order = must(
    await db
      .from('orders')
      .select('id, order_number, status, total_amount, currency, service_title, brand:brands(id, profile_id, brand_name, contact_phone), creator:creators(display_name)')
      .eq('id', orderId)
      .maybeSingle(),
  ) as unknown as OrderRow | null

  if (!order || order.brand?.profile_id !== user.id) throw new HttpError(404, 'Order not found.', 'ORDER_NOT_FOUND')
  if (order.status !== 'payment_pending') throw new HttpError(409, 'This order is not awaiting payment.', 'INVALID_ORDER_STATE')

  const amountPaise = Math.round(Number(order.total_amount) * 100)
  const currency = order.currency || 'INR'

  // Reuse the latest open Razorpay order for the same amount (safe retries).
  const { data: existing } = await db
    .from('payments')
    .select('id, provider_order_id, amount, status')
    .eq('order_id', order.id)
    .in('status', ['created', 'failed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let razorpayOrderId: string | null = null
  if (existing?.provider_order_id && Math.round(Number(existing.amount) * 100) === amountPaise) {
    const remote = await razorpay.fetchOrder(existing.provider_order_id)
    if (remote.status === 'paid') throw new HttpError(409, 'This order has already been paid. It will update in a moment.', 'ALREADY_PAID')
    razorpayOrderId = remote.id
  }

  if (!razorpayOrderId) {
    const remote = await razorpay.createOrder(amountPaise, currency, order.order_number, { order_id: order.id, order_number: order.order_number })
    must(
      await db.rpc('register_payment_attempt', {
        p_order_id: order.id,
        p_payer_id: user.id,
        p_provider_order_id: remote.id,
        p_amount: order.total_amount,
        p_currency: currency,
        p_raw: remote,
      }),
    )
    razorpayOrderId = remote.id
  }

  const { data: profile } = await db.from('profiles').select('full_name, email, phone').eq('id', user.id).maybeSingle()

  return json({
    key_id: razorpayKeyId,
    razorpay_order_id: razorpayOrderId,
    amount: amountPaise,
    currency,
    order_number: order.order_number,
    description: `${order.service_title} · ${order.creator?.display_name ?? 'Creator'}`.slice(0, 250),
    prefill: {
      name: profile?.full_name ?? order.brand?.brand_name ?? undefined,
      email: profile?.email ?? user.email ?? undefined,
      contact: profile?.phone ?? order.brand?.contact_phone ?? undefined,
    },
  })
})
