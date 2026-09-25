import { supabase } from '@/lib/supabase/client'
import { AppError, toAppError } from '@/lib/errors'
import { invokeFunction } from '@/lib/supabase/functions'
import { openRazorpayCheckout, type RazorpaySuccess } from '@/lib/payments/razorpay'
import { site } from '@/config/site'

type CreatePaymentResponse = {
  key_id: string
  razorpay_order_id: string
  amount: number // paise
  currency: string
  order_number: string
  description: string
  prefill: { name?: string; email?: string; contact?: string }
}

type VerifyPaymentResponse = { status: 'captured' | 'processing'; order_id: string }

/** Server creates (or reuses) the Razorpay order for the DB-computed amount. */
export function createPayment(orderId: string) {
  return invokeFunction<CreatePaymentResponse>('create-payment', { order_id: orderId })
}

/** Server verifies the signature + fetches the payment from Razorpay. */
export function verifyPayment(response: RazorpaySuccess) {
  return invokeFunction<VerifyPaymentResponse>('verify-payment', { ...response })
}

/**
 * Full checkout: create payment → Razorpay Checkout → server verification.
 * The order only advances when the Edge Function (or webhook) confirms it.
 */
export async function payForOrder(orderId: string, opts: { onFailure?: (message: string) => void } = {}) {
  const payment = await createPayment(orderId)
  if (!payment.key_id) {
    throw new AppError('Payments are not configured yet. Please contact support.', { kind: 'payment', code: 'PAYMENTS_NOT_CONFIGURED' })
  }
  const response = await openRazorpayCheckout({
    keyId: payment.key_id,
    razorpayOrderId: payment.razorpay_order_id,
    amountPaise: payment.amount,
    currency: payment.currency,
    name: site.name,
    description: payment.description,
    prefill: payment.prefill,
    notes: { order_number: payment.order_number },
    onFailure: opts.onFailure,
  })
  return verifyPayment(response)
}

const PAYMENT_COLUMNS = `
  id, order_id, amount, currency, provider, provider_order_id, provider_payment_id, status, method,
  error_code, error_description, refunded_amount, captured_at, created_at, updated_at,
  order:orders ( id, order_number, service_title, creator:creators ( id, display_name, slug ) )
`

export async function listMyPayments(page = 1, pageSize = 20) {
  const { data, error, count } = await supabase
    .from('payments')
    .select(PAYMENT_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}
export type PaymentListItem = Awaited<ReturnType<typeof listMyPayments>>['items'][number]
