import * as React from 'react'
import { usePublicSettings } from '@/hooks/use-catalog'
import { formatINR } from '@/lib/format'

/**
 * Public platform settings normalised for marketing and policy copy. Every
 * value is `null` until it has loaded (or when it is missing), so copy can
 * fall back to generic wording instead of showing a number that may be stale.
 */
export type PlatformTerms = {
  feePercent: number | null
  minPayout: number | null
  holdDays: number | null
  responseHours: number | null
  autoApproveDays: number | null
  paymentExpiryHours: number | null
  maxRevisions: number | null
  requireApproval: boolean | null
  cancellationRules: string | null
  refundRules: string | null
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? n : null
}

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export function usePlatformTerms() {
  const query = usePublicSettings()
  const data = query.data
  const terms = React.useMemo<PlatformTerms>(() => {
    const s: Record<string, unknown> = data ?? {}
    return {
      feePercent: toNumber(s.platform_fee_percentage),
      minPayout: toNumber(s.minimum_payout_amount),
      holdDays: toNumber(s.earning_hold_days),
      responseHours: toNumber(s.creator_response_hours),
      autoApproveDays: toNumber(s.auto_approve_days),
      paymentExpiryHours: toNumber(s.payment_expiry_hours),
      maxRevisions: toNumber(s.max_revisions),
      requireApproval: toBool(s.require_creator_approval),
      cancellationRules: toText(s.cancellation_rules),
      refundRules: toText(s.refund_rules),
    }
  }, [data])
  return { terms, query }
}

// ---------------------------------------------------------------------------
// Phrase helpers — each returns ready-to-read copy with a generic fallback.
// ---------------------------------------------------------------------------
export function percentText(n: number) {
  return `${Number(n.toFixed(2))}%`
}

export function hoursText(n: number) {
  return `${n} hour${n === 1 ? '' : 's'}`
}

export function daysText(n: number) {
  return `${n} day${n === 1 ? '' : 's'}`
}

/** "10%" or the fallback wording. */
export function feeText(t: PlatformTerms, fallback = 'a small percentage') {
  return t.feePercent != null ? percentText(t.feePercent) : fallback
}

/** "₹500" or the fallback wording. */
export function minPayoutText(t: PlatformTerms, fallback = 'the minimum shown on your Payouts page') {
  return t.minPayout != null ? formatINR(t.minPayout) : fallback
}

/** When a completed order's earning becomes withdrawable. */
export function holdText(t: PlatformTerms) {
  if (t.holdDays == null) return 'after a short holding period shown on your Earnings page'
  if (t.holdDays <= 0) return 'as soon as the order is completed'
  return `${daysText(t.holdDays)} after the order is completed`
}

export function responseWindowText(t: PlatformTerms, fallback = 'the response window shown on the order') {
  return t.responseHours != null ? hoursText(t.responseHours) : fallback
}

export function autoApproveText(t: PlatformTerms, fallback = 'the review window shown on the order') {
  return t.autoApproveDays != null ? daysText(t.autoApproveDays) : fallback
}

export function paymentWindowText(t: PlatformTerms, fallback = 'a limited time') {
  return t.paymentExpiryHours != null ? hoursText(t.paymentExpiryHours) : fallback
}

/** Mirrors the database rounding: fee = round(amount × pct / 100, 2). */
export function splitEarning(amount: number, feePercent: number) {
  const fee = Math.round(amount * feePercent) / 100
  return { fee, net: Math.round((amount - fee) * 100) / 100 }
}
