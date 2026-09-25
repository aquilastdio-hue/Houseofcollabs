import type { OrderStatus, OrderStatusHistory } from '@/types'

export type StatusTone = 'neutral' | 'brand' | 'info' | 'warning' | 'success' | 'danger' | 'lilac'

type Meta = { label: string; tone: StatusTone; brand: string; creator: string }

/**
 * Presentation metadata for every order status. The database is the source of
 * truth for what transitions are allowed; this only drives labels and hints.
 */
export const ORDER_STATUS_META: Record<OrderStatus, Meta> = {
  draft: { label: 'Draft', tone: 'neutral', brand: 'Finish checkout to place this order.', creator: '' },
  payment_pending: { label: 'Awaiting payment', tone: 'warning', brand: 'Complete payment to send this order to the creator.', creator: '' },
  order_placed: { label: 'Order placed', tone: 'info', brand: 'Payment received. Sending to the creator…', creator: 'New order.' },
  creator_pending: { label: 'Awaiting creator', tone: 'warning', brand: 'Waiting for the creator to accept your order.', creator: 'Review the brief and accept or decline this order.' },
  accepted: { label: 'Accepted', tone: 'info', brand: 'The creator accepted your order.', creator: 'Start working when you’re ready.' },
  awaiting_shipment: { label: 'Awaiting shipment', tone: 'warning', brand: 'Ship the product to the creator’s address and add tracking.', creator: 'Waiting for the brand to ship the product.' },
  shipped: { label: 'Shipped', tone: 'info', brand: 'Product is on its way to the creator.', creator: 'The product is on its way. Mark it received when it arrives.' },
  received: { label: 'Product received', tone: 'info', brand: 'The creator has your product.', creator: 'Start working on the content.' },
  in_progress: { label: 'In progress', tone: 'lilac', brand: 'The creator is working on your content.', creator: 'Upload your deliverables when they’re ready.' },
  delivered: { label: 'Delivered', tone: 'brand', brand: 'Review the delivery — approve it or request a revision.', creator: 'Waiting for the brand’s review.' },
  revision_requested: { label: 'Revision requested', tone: 'warning', brand: 'The creator is working on your revision.', creator: 'The brand requested changes. Submit your revision.' },
  revision_submitted: { label: 'Revision submitted', tone: 'brand', brand: 'Review the revision — approve it or ask for another change.', creator: 'Waiting for the brand’s review.' },
  approved: { label: 'Approved', tone: 'success', brand: 'You approved the delivery.', creator: 'The brand approved your work.' },
  completed: { label: 'Completed', tone: 'success', brand: 'All done. Leave a review for the creator.', creator: 'Completed — your earning is in your balance.' },
  cancelled: { label: 'Cancelled', tone: 'danger', brand: 'This order was cancelled.', creator: 'This order was cancelled.' },
  disputed: { label: 'In dispute', tone: 'danger', brand: 'Our team is reviewing this order.', creator: 'Our team is reviewing this order.' },
  refunded: { label: 'Refunded', tone: 'neutral', brand: 'This order was refunded.', creator: 'This order was refunded to the brand.' },
}

export const ACTIVE_STATUSES: OrderStatus[] = [
  'creator_pending', 'accepted', 'awaiting_shipment', 'shipped', 'received', 'in_progress', 'delivered',
  'revision_requested', 'revision_submitted', 'disputed',
]
export const CLOSED_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'refunded']
export const REVIEW_STATUSES: OrderStatus[] = ['delivered', 'revision_submitted']

export const ORDER_FILTER_GROUPS: { value: string; label: string; statuses?: OrderStatus[] }[] = [
  { value: 'all', label: 'All' },
  { value: 'action', label: 'Needs action' },
  { value: 'active', label: 'Active', statuses: ACTIVE_STATUSES },
  { value: 'completed', label: 'Completed', statuses: ['completed'] },
  { value: 'cancelled', label: 'Cancelled', statuses: ['cancelled', 'refunded'] },
]

/** Statuses where the given party is expected to act next. */
export function needsActionStatuses(role: 'brand' | 'creator'): OrderStatus[] {
  return role === 'brand'
    ? ['payment_pending', 'awaiting_shipment', 'delivered', 'revision_submitted']
    : ['creator_pending', 'accepted', 'received', 'shipped', 'in_progress', 'revision_requested']
}

export function statusLabel(status: OrderStatus) {
  return ORDER_STATUS_META[status]?.label ?? status
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
export type TimelineStep = {
  key: string
  label: string
  state: 'done' | 'current' | 'upcoming' | 'skipped'
  at?: string | null
  note?: string | null
}

const STEP_DEFS: { key: string; label: string; statuses: OrderStatus[]; shippingOnly?: boolean }[] = [
  { key: 'placed', label: 'Order placed', statuses: ['order_placed', 'creator_pending'] },
  { key: 'accepted', label: 'Creator accepted', statuses: ['accepted'] },
  { key: 'shipped', label: 'Product shipped', statuses: ['awaiting_shipment', 'shipped'], shippingOnly: true },
  { key: 'received', label: 'Product received', statuses: ['received'], shippingOnly: true },
  { key: 'started', label: 'Work started', statuses: ['in_progress'] },
  { key: 'delivered', label: 'Content delivered', statuses: ['delivered'] },
  { key: 'revision', label: 'Revisions', statuses: ['revision_requested', 'revision_submitted'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
]

/**
 * Builds the high-level progress timeline from the status history. The full
 * audit-style list of every change is rendered separately from `history`.
 */
export function buildTimeline(status: OrderStatus, history: OrderStatusHistory[], requiresShipping: boolean): TimelineStep[] {
  const reached = new Map<string, string>()
  const sorted = [...history].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const h of sorted) {
    const def = STEP_DEFS.find((d) => d.statuses.includes(h.new_status))
    if (def && !reached.has(def.key)) reached.set(def.key, h.created_at)
    if (h.new_status === 'shipped') reached.set('shipped', h.created_at)
  }
  const hadRevision = sorted.some((h) => h.new_status === 'revision_requested')
  const defs = STEP_DEFS.filter((d) => (!d.shippingOnly || requiresShipping) && (d.key !== 'revision' || hadRevision))
  const currentDef = defs.find((d) => d.statuses.includes(status))
  let passedCurrent = false
  const terminal = status === 'cancelled' || status === 'refunded'
  return defs.map((d) => {
    const at = reached.get(d.key) ?? null
    if (currentDef?.key === d.key) {
      passedCurrent = true
      return { key: d.key, label: d.label, state: status === 'completed' ? 'done' : 'current', at }
    }
    if (at && !passedCurrent) return { key: d.key, label: d.label, state: 'done', at }
    return { key: d.key, label: d.label, state: terminal ? 'skipped' : 'upcoming', at: null }
  })
}

export function historyLabel(h: Pick<OrderStatusHistory, 'old_status' | 'new_status'>) {
  if (!h.old_status) return 'Order created'
  return statusLabel(h.new_status)
}

export function isOverdue(dueAt?: string | null, status?: OrderStatus) {
  if (!dueAt || !status) return false
  if (!['accepted', 'received', 'in_progress', 'revision_requested'].includes(status)) return false
  return new Date(dueAt).getTime() < Date.now()
}
