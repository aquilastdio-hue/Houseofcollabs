import { ORDER_STATUS_META } from '@/lib/order-state'
import type { OrderStatus } from '@/types'

/** Every order status in lifecycle order. */
export const ORDER_STATUSES = Object.keys(ORDER_STATUS_META) as OrderStatus[]

/** Paid orders somewhere between "sent to creator" and "awaiting approval". */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'creator_pending',
  'accepted',
  'awaiting_shipment',
  'shipped',
  'received',
  'in_progress',
  'delivered',
  'revision_requested',
  'revision_submitted',
]

export type OrderPreset = { value: string; label: string; statuses?: OrderStatus[]; refund?: boolean }

/** Quick views on the admin orders list. */
export const ORDER_PRESETS: OrderPreset[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active', statuses: ACTIVE_ORDER_STATUSES },
  { value: 'review', label: 'Awaiting approval', statuses: ['delivered', 'revision_submitted'] },
  { value: 'disputed', label: 'Disputed', statuses: ['disputed'] },
  { value: 'completed', label: 'Completed', statuses: ['approved', 'completed'] },
  { value: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
  { value: 'refunded', label: 'Refunded', statuses: ['refunded'] },
  { value: 'unpaid', label: 'Unpaid', statuses: ['draft', 'payment_pending'] },
  { value: 'refund', label: 'Refund required', refund: true },
]

/** Admin orders URL for a set of statuses (or the refund queue). */
export function ordersHref(opts: { statuses?: OrderStatus[]; refund?: boolean; brand?: string; creator?: string }) {
  const params = new URLSearchParams()
  if (opts.statuses?.length) params.set('status', opts.statuses.join(','))
  if (opts.refund) params.set('refund', '1')
  if (opts.brand) params.set('brand', opts.brand)
  if (opts.creator) params.set('creator', opts.creator)
  const qs = params.toString()
  return `/admin/orders${qs ? `?${qs}` : ''}`
}

/** Which preset (if any) matches the current status/refund filters. */
export function matchPreset(statuses: OrderStatus[], refund: boolean): string | null {
  if (refund) return statuses.length === 0 ? 'refund' : null
  if (statuses.length === 0) return 'all'
  const set = new Set(statuses)
  const match = ORDER_PRESETS.find((p) => p.statuses && p.statuses.length === set.size && p.statuses.every((s) => set.has(s)))
  return match?.value ?? null
}
