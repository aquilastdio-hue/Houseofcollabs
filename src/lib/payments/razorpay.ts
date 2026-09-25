import { AppError } from '@/lib/errors'

/** Values returned by Razorpay Checkout on success. Verified server-side only. */
export type RazorpaySuccess = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

type RazorpayFailure = {
  error: { code?: string; description?: string; reason?: string; metadata?: { order_id?: string; payment_id?: string } }
}

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description?: string
  image?: string
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color?: string; backdrop_color?: string }
  handler: (response: RazorpaySuccess) => void
  modal?: { ondismiss?: () => void; confirm_close?: boolean; escape?: boolean }
  retry?: { enabled: boolean; max_count?: number }
}

type RazorpayInstance = {
  open: () => void
  on: (event: 'payment.failed', cb: (response: RazorpayFailure) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let loading: Promise<void> | null = null

export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new AppError('Could not load the payment window. Check your connection and try again.', { kind: 'payment', code: 'CHECKOUT_LOAD_FAILED' }))
    }
    document.body.appendChild(script)
  })
  return loading
}

export type CheckoutParams = {
  keyId: string
  razorpayOrderId: string
  amountPaise: number
  currency: string
  name: string
  description: string
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  onFailure?: (message: string) => void
}

/**
 * Opens Razorpay Checkout. Resolves with the gateway response (which MUST be
 * verified by the `verify-payment` Edge Function) or rejects if dismissed.
 */
export async function openRazorpayCheckout(params: CheckoutParams): Promise<RazorpaySuccess> {
  await loadRazorpay()
  const Razorpay = window.Razorpay
  if (!Razorpay) throw new AppError('Payment window unavailable.', { kind: 'payment', code: 'CHECKOUT_UNAVAILABLE' })

  return new Promise<RazorpaySuccess>((resolve, reject) => {
    const rzp = new Razorpay({
      key: params.keyId,
      amount: params.amountPaise,
      currency: params.currency,
      order_id: params.razorpayOrderId,
      name: params.name,
      description: params.description,
      prefill: params.prefill,
      notes: params.notes,
      theme: { color: '#111111' },
      retry: { enabled: true, max_count: 3 },
      handler: (response) => resolve(response),
      modal: {
        confirm_close: true,
        ondismiss: () => reject(new AppError('Payment was cancelled. You can retry from the order page.', { kind: 'payment', code: 'CHECKOUT_DISMISSED' })),
      },
    })
    rzp.on('payment.failed', (response) => {
      params.onFailure?.(response.error?.description ?? 'Payment failed. You can try again.')
    })
    rzp.open()
  })
}
