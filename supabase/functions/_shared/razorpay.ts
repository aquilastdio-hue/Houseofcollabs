// Minimal Razorpay REST client + signature verification (Web Crypto).
// Secrets come from Edge Function env vars and never reach the browser.
import { HttpError } from './http.ts'

const API_BASE = (Deno.env.get('RAZORPAY_API_BASE') ?? 'https://api.razorpay.com/v1').replace(/\/$/, '')
const KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') ?? ''
const KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') ?? ''
const WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? ''
const X_ACCOUNT = Deno.env.get('RAZORPAYX_ACCOUNT_NUMBER') ?? ''

export const razorpayKeyId = KEY_ID
export const razorpayConfigured = () => Boolean(KEY_ID && KEY_SECRET)
export const razorpayXConfigured = () => razorpayConfigured() && Boolean(X_ACCOUNT)

export type RzpOrder = { id: string; amount: number; currency: string; status: 'created' | 'attempted' | 'paid'; receipt?: string }
export type RzpPayment = {
  id: string
  order_id: string | null
  amount: number
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
  method?: string
  error_code?: string | null
  error_description?: string | null
  captured?: boolean
}
export type RzpRefund = { id: string; payment_id: string; amount: number; status: 'pending' | 'processed' | 'failed'; notes?: Record<string, string> }
export type RzpPayout = { id: string; status: string; amount: number; utr?: string | null; reference_id?: string | null }

async function call<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  if (!razorpayConfigured()) throw new HttpError(503, 'Payments are not configured yet. Please contact support.', 'PAYMENTS_NOT_CONFIGURED')
  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(`${KEY_ID}:${KEY_SECRET}`)}`,
    'Content-Type': 'application/json',
  }
  if (init.idempotencyKey) headers['X-Payout-Idempotency'] = init.idempotencyKey
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  if (!res.ok) {
    const desc = (body as { error?: { description?: string } } | null)?.error?.description ?? `HTTP ${res.status}`
    console.error('razorpay error', path, res.status, desc)
    throw new HttpError(502, `Payment provider error: ${desc}`, 'RAZORPAY_ERROR')
  }
  return body as T
}

export const razorpay = {
  createOrder(amountPaise: number, currency: string, receipt: string, notes: Record<string, string>) {
    return call<RzpOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify({ amount: amountPaise, currency, receipt: receipt.slice(0, 40), notes, payment_capture: 1 }),
    })
  },
  fetchOrder(orderId: string) {
    return call<RzpOrder>(`/orders/${encodeURIComponent(orderId)}`)
  },
  fetchPayment(paymentId: string) {
    return call<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}`)
  },
  capturePayment(paymentId: string, amountPaise: number, currency: string) {
    return call<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, {
      method: 'POST',
      body: JSON.stringify({ amount: amountPaise, currency }),
    })
  },
  refund(paymentId: string, amountPaise: number, notes: Record<string, string>) {
    return call<RzpRefund>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amount: amountPaise, speed: 'normal', notes }),
    })
  },
  /** RazorpayX composite payout (contact + fund account inline). */
  createPayout(input: {
    referenceId: string
    amountPaise: number
    name: string
    method: 'upi' | 'bank_transfer'
    upi?: string | null
    accountNumber?: string | null
    ifsc?: string | null
    narration: string
  }) {
    if (!X_ACCOUNT) throw new HttpError(503, 'RazorpayX payouts are not configured.', 'RAZORPAYX_NOT_CONFIGURED')
    const fund_account =
      input.method === 'upi'
        ? { account_type: 'vpa', vpa: { address: input.upi }, contact: { name: input.name, type: 'vendor', reference_id: input.referenceId } }
        : {
            account_type: 'bank_account',
            bank_account: { name: input.name, ifsc: input.ifsc, account_number: input.accountNumber },
            contact: { name: input.name, type: 'vendor', reference_id: input.referenceId },
          }
    return call<RzpPayout>('/payouts', {
      method: 'POST',
      idempotencyKey: input.referenceId,
      body: JSON.stringify({
        account_number: X_ACCOUNT,
        amount: input.amountPaise,
        currency: 'INR',
        mode: input.method === 'upi' ? 'UPI' : 'IMPS',
        purpose: 'payout',
        fund_account,
        queue_if_low_balance: true,
        reference_id: input.referenceId,
        narration: input.narration.slice(0, 30),
      }),
    })
  },
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------
const encoder = new TextEncoder()

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(message))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time comparison to avoid timing attacks on signatures. */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a)
  const bb = encoder.encode(b)
  let diff = ab.length ^ bb.length
  const len = Math.max(ab.length, bb.length)
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  return diff === 0
}

/** Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export async function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  if (!KEY_SECRET) return false
  return safeEqual(await hmacSha256Hex(KEY_SECRET, `${orderId}|${paymentId}`), signature)
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook_secret). */
export async function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!WEBHOOK_SECRET || !signature) return false
  return safeEqual(await hmacSha256Hex(WEBHOOK_SECRET, rawBody), signature)
}
