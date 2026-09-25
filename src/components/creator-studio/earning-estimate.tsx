import { formatINR, formatPercent } from '@/lib/format'
import { usePublicSettings } from '@/hooks/use-catalog'

/** Live platform fee (%) from public settings, or null while unknown. */
export function useFeePercent() {
  const settings = usePublicSettings()
  const raw = settings.data?.platform_fee_percentage
  const fee = Number(raw)
  return raw != null && Number.isFinite(fee) ? fee : null
}

/** Display-only estimate of the creator's share; the real split is computed by the database per order. */
export function estimateEarning(amount: number, feePercent: number) {
  return Math.round(amount * (100 - feePercent)) / 100
}

/** Parses a price typed into a text field ("2,500" → 2500); NaN when not a number. */
export function parseAmount(value: string | undefined | null) {
  const cleaned = (value ?? '').replace(/[,\s_]/g, '')
  return cleaned === '' ? Number.NaN : Number(cleaned)
}

export function EarningEstimate({ amount, className }: { amount: number; className?: string }) {
  const fee = useFeePercent()
  if (fee == null || !Number.isFinite(amount) || amount <= 0) return null
  return (
    <span className={className}>
      You earn about <span className="font-medium text-ink">{formatINR(estimateEarning(amount, fee))}</span> after the {formatPercent(fee)} platform fee.
    </span>
  )
}
