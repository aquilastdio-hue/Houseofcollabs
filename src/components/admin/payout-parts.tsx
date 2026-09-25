import { Landmark, Smartphone } from 'lucide-react'
import type { AdminPayoutItem } from '@/services/admin.service'
import type { Json } from '@/types'
import { asRecord, asString } from './admin-utils'

export type PayoutSnapshot = {
  methodType: 'upi' | 'bank_transfer' | null
  holder: string | null
  upiId: string | null
  last4: string | null
  ifsc: string | null
  bankName: string | null
}

/** Reads the (masked) payout method snapshot stored on the request. */
export function readPayoutSnapshot(json: Json | null | undefined): PayoutSnapshot {
  const r = asRecord(json)
  const type = asString(r.method_type)
  return {
    methodType: type === 'upi' || type === 'bank_transfer' ? type : null,
    holder: asString(r.account_holder_name),
    upiId: asString(r.upi_id),
    last4: asString(r.bank_account_last4),
    ifsc: asString(r.ifsc_code),
    bankName: asString(r.bank_name),
  }
}

/** Masked method: UPI id, or ••••last4 + IFSC for bank transfers. */
export function PayoutMethodSummary({ snapshot, compact }: { snapshot: PayoutSnapshot; compact?: boolean }) {
  const s = snapshot
  if (!s.methodType) return <span className="text-faint">Not recorded</span>
  const Icon = s.methodType === 'upi' ? Smartphone : Landmark
  return (
    <span className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate font-mono text-xs">
          {s.methodType === 'upi' ? s.upiId ?? 'UPI' : `•••• ${s.last4 ?? '????'}${s.ifsc ? ` · ${s.ifsc}` : ''}`}
        </span>
        {!compact && (
          <span className="block truncate text-xs text-muted">
            {s.methodType === 'upi' ? 'UPI' : s.bankName ?? 'Bank transfer'}
            {s.holder ? ` · ${s.holder}` : ''}
          </span>
        )}
      </span>
    </span>
  )
}

/** Most recent transaction reference (UTR / provider payout id), if any. */
export function latestReference(p: AdminPayoutItem) {
  const txns = [...(p.payout_transactions ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return txns.find((t) => t.provider_reference)?.provider_reference ?? null
}

export function linkedEarnings(p: AdminPayoutItem) {
  const list = p.creator_earnings ?? []
  return { count: list.length, amount: list.reduce((sum, e) => sum + Number(e.net_amount ?? 0), 0) }
}
