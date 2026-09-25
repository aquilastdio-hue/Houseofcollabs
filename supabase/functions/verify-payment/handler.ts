// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// 1. verifies the Checkout HMAC signature (constant time)
// 2. fetches the payment from Razorpay and checks order/amount/currency
// 3. captures if only authorised
// 4. confirms through the service-only DB function (idempotent with the webhook)
import { handler, HttpError, json, must, readJson, requireString } from '../_shared/http.ts'
import { adminClient, audit, requireUser } from '../_shared/supabase.ts'
import { razorpay, verifyPaymentSignature } from '../_shared/razorpay.ts'

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const user = await requireUser(req)
  const body = await readJson<Record<string, unknown>>(req)
  const orderId = requireString(body.razorpay_order_id, 'razorpay_order_id', 64)
  const paymentId = requireString(body.razorpay_payment_id, 'razorpay_payment_id', 64)
  const signature = requireString(body.razorpay_signature, 'razorpay_signature', 256)
  if (!/^order_\w+$/.test(orderId) || !/^pay_\w+$/.test(paymentId)) throw new HttpError(400, 'Invalid payment reference.', 'BAD_REQUEST')

  const db = adminClient()
  const payment = must(
    await db.from('payments').select('id, order_id, payer_id, amount, currency, status').eq('provider_order_id', orderId).maybeSingle(),
  ) as { id: string; order_id: string; payer_id: string | null; amount: number; currency: string; status: string } | null
  if (!payment || payment.payer_id !== user.id) throw new HttpError(404, 'Payment not found.', 'PAYMENT_NOT_FOUND')

  if (!(await verifyPaymentSignature(orderId, paymentId, signature))) {
    await audit(user.id, 'payment_signature_invalid', 'payment', payment.id, { provider_order_id: orderId, provider_payment_id: paymentId })
    throw new HttpError(400, 'We could not verify this payment. If money was deducted it will be reconciled automatically.', 'INVALID_SIGNATURE')
  }

  const expectedPaise = Math.round(Number(payment.amount) * 100)
  let remote = await razorpay.fetchPayment(paymentId)
  if (remote.order_id !== orderId) throw new HttpError(400, 'Payment does not belong to this order.', 'ORDER_MISMATCH')
  if (remote.amount !== expectedPaise || remote.currency !== payment.currency) {
    await audit(user.id, 'payment_amount_mismatch', 'payment', payment.id, { expected: expectedPaise, received: remote.amount })
    throw new HttpError(400, 'Payment amount does not match the order.', 'AMOUNT_MISMATCH')
  }

  if (remote.status === 'authorized') remote = await razorpay.capturePayment(paymentId, remote.amount, remote.currency)

  if (remote.status === 'captured') {
    must(
      await db.rpc('confirm_order_payment', {
        p_provider_order_id: orderId,
        p_provider_payment_id: paymentId,
        p_signature: signature,
        p_method: remote.method ?? null,
        p_amount_paise: remote.amount,
        p_raw: remote,
      }),
    )
    return json({ status: 'captured', order_id: payment.order_id })
  }

  if (remote.status === 'failed') {
    await db.rpc('mark_payment_failed', {
      p_provider_order_id: orderId,
      p_provider_payment_id: paymentId,
      p_error_code: remote.error_code ?? null,
      p_error_description: remote.error_description ?? null,
      p_raw: remote,
    })
    throw new HttpError(402, remote.error_description ?? 'The payment failed. Please try again.', 'PAYMENT_FAILED')
  }

  // Still processing at the bank — the webhook will finalise it.
  return json({ status: 'processing', order_id: payment.order_id })
})
