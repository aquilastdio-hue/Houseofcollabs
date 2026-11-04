// A creator pays HOC's commission invoice (Billing → Pay now).
//
//   POST { action: 'create', invoice_id }
//     → opens (or reuses) a Razorpay order for what is still owed. The amount
//       comes from the invoice, never the client.
//   POST { action: 'verify', razorpay_order_id, razorpay_payment_id, razorpay_signature }
//     → checks the signature, re-fetches the payment, captures it if only
//       authorised, then `confirm_invoice_payment` marks the invoice paid.
//       The Razorpay webhook calls the same function, so whichever arrives
//       first wins and the other is a no-op.
//
// A test account's invoice is paid in Razorpay test mode, like its orders.
import { handler, HttpError, json, must, readJson, requireString, requireUuid } from '../_shared/http.ts'
import { adminClient, audit, requireUser } from '../_shared/supabase.ts'
import { razorpayConfigured, razorpayFor, razorpayKeyIdFor, verifyPaymentSignature, type RazorpayMode } from '../_shared/razorpay.ts'

type Invoice = {
  id: string
  kind: string
  number: string
  status: string
  total_amount: number
  amount_paid: number
  is_test: boolean
  creator: { profile_id: string; display_name: string } | null
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const user = await requireUser(req)
  const body = await readJson<Record<string, unknown>>(req)
  const db = adminClient()

  if (body.action === 'create') {
    const invoiceId = requireUuid(body.invoice_id, 'invoice_id')
    const invoice = must(
      await db
        .from('invoices')
        .select('id, kind, number, status, total_amount, amount_paid, is_test, creator:creators(profile_id, display_name)')
        .eq('id', invoiceId)
        .maybeSingle(),
    ) as unknown as Invoice | null
    if (!invoice || invoice.kind !== 'creator_commission' || invoice.creator?.profile_id !== user.id) {
      throw new HttpError(404, 'Invoice not found.', 'INVOICE_NOT_FOUND')
    }
    if (!['unpaid', 'partially_paid'].includes(invoice.status)) {
      throw new HttpError(409, 'This invoice is already settled.', 'INVOICE_NOT_PAYABLE')
    }

    const mode: RazorpayMode = invoice.is_test ? 'test' : 'live'
    if (!razorpayConfigured(mode)) throw new HttpError(503, 'Payments are not configured yet. Please contact support.', 'PAYMENTS_NOT_CONFIGURED')
    const razorpay = razorpayFor(mode)
    const due = Math.round((Number(invoice.total_amount) - Number(invoice.amount_paid)) * 100) / 100
    const amountPaise = Math.round(due * 100)

    // Reuse an open attempt for the same amount, so a retry doesn't stack up orders.
    const { data: open } = await db
      .from('invoice_payments')
      .select('provider_order_id, amount')
      .eq('invoice_id', invoice.id)
      .eq('payer_id', user.id)
      .eq('status', 'created')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    let razorpayOrderId: string | null = null
    if (open?.provider_order_id && Math.round(Number(open.amount) * 100) === amountPaise) {
      const remote = await razorpay.fetchOrder(open.provider_order_id).catch(() => null)
      if (remote?.status === 'paid') throw new HttpError(409, 'This invoice has just been paid. It will update in a moment.', 'ALREADY_PAID')
      razorpayOrderId = remote?.id ?? null
    }
    if (!razorpayOrderId) {
      const remote = await razorpay.createOrder(amountPaise, 'INR', invoice.number, { invoice_id: invoice.id, invoice_number: invoice.number })
      must(
        await db.rpc('register_invoice_payment', {
          p_invoice_id: invoice.id,
          p_payer_id: user.id,
          p_provider_order_id: remote.id,
          p_amount: due,
          p_raw: remote,
        }),
      )
      razorpayOrderId = remote.id
    }

    const { data: profile } = await db.from('profiles').select('full_name, email, phone').eq('id', user.id).maybeSingle()
    return json({
      key_id: razorpayKeyIdFor(mode),
      razorpay_order_id: razorpayOrderId,
      amount: amountPaise,
      currency: 'INR',
      invoice_number: invoice.number,
      description: `Commission invoice ${invoice.number}`,
      prefill: {
        name: profile?.full_name ?? invoice.creator?.display_name ?? undefined,
        email: profile?.email ?? user.email ?? undefined,
        contact: profile?.phone ?? undefined,
      },
    })
  }

  if (body.action === 'verify') {
    const orderId = requireString(body.razorpay_order_id, 'razorpay_order_id', 64)
    const paymentId = requireString(body.razorpay_payment_id, 'razorpay_payment_id', 64)
    const signature = requireString(body.razorpay_signature, 'razorpay_signature', 256)
    if (!/^order_\w+$/.test(orderId) || !/^pay_\w+$/.test(paymentId)) throw new HttpError(400, 'Invalid payment reference.', 'BAD_REQUEST')

    const payment = must(
      await db
        .from('invoice_payments')
        .select('id, invoice_id, payer_id, amount, invoice:invoices(is_test)')
        .eq('provider_order_id', orderId)
        .maybeSingle(),
    ) as unknown as { id: string; invoice_id: string; payer_id: string | null; amount: number; invoice: { is_test: boolean } | null } | null
    if (!payment || payment.payer_id !== user.id) throw new HttpError(404, 'Payment not found.', 'PAYMENT_NOT_FOUND')

    const mode: RazorpayMode = payment.invoice?.is_test ? 'test' : 'live'
    if (!(await verifyPaymentSignature(orderId, paymentId, signature, mode))) {
      await audit(user.id, 'payment_signature_invalid', 'invoice_payment', payment.id, { provider_order_id: orderId })
      throw new HttpError(400, 'We could not verify this payment. If money was deducted it will be reconciled automatically.', 'INVALID_SIGNATURE')
    }
    const razorpay = razorpayFor(mode)
    const expectedPaise = Math.round(Number(payment.amount) * 100)
    let remote = await razorpay.fetchPayment(paymentId)
    if (remote.order_id !== orderId) throw new HttpError(400, 'Payment does not belong to this invoice.', 'ORDER_MISMATCH')
    if (remote.amount !== expectedPaise) throw new HttpError(400, 'Payment amount does not match the invoice.', 'AMOUNT_MISMATCH')
    if (remote.status === 'authorized') remote = await razorpay.capturePayment(paymentId, remote.amount, remote.currency)

    if (remote.status === 'captured') {
      must(
        await db.rpc('confirm_invoice_payment', {
          p_provider_order_id: orderId,
          p_provider_payment_id: paymentId,
          p_method: remote.method ?? null,
          p_amount_paise: remote.amount,
          p_raw: remote,
        }),
      )
      return json({ status: 'captured', invoice_id: payment.invoice_id })
    }
    if (remote.status === 'failed') {
      throw new HttpError(402, remote.error_description ?? 'The payment failed. Please try again.', 'PAYMENT_FAILED')
    }
    return json({ status: 'processing', invoice_id: payment.invoice_id })
  }

  throw new HttpError(400, 'Unknown action.', 'BAD_REQUEST')
})
