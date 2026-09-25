import { Badge, type BadgeTone } from '@/components/ui/badge'
import { titleCase } from '@/lib/format'
import type { AccountStatus, ActorRole, CreatorStatus, DisputeStatus, Enums, PaymentStatus, PayoutStatus, ReportStatus, ReportTarget, RevisionStatus } from '@/types'

export type StatusMeta = { label: string; tone: BadgeTone }

export const CREATOR_STATUS_META: Record<CreatorStatus, StatusMeta> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_review: { label: 'Pending review', tone: 'warning' },
  published: { label: 'Published', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  suspended: { label: 'Suspended', tone: 'danger' },
}

export const ACCOUNT_STATUS_META: Record<AccountStatus, StatusMeta> = {
  active: { label: 'Active', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'danger' },
  deleted: { label: 'Deleted', tone: 'neutral' },
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, StatusMeta> = {
  created: { label: 'Created', tone: 'neutral' },
  authorized: { label: 'Authorized', tone: 'info' },
  captured: { label: 'Captured', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'lilac' },
  partially_refunded: { label: 'Partly refunded', tone: 'warning' },
}

export const PAYOUT_STATUS_META: Record<PayoutStatus, StatusMeta> = {
  pending: { label: 'Pending', tone: 'warning' },
  processing: { label: 'Processing', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  rejected: { label: 'Rejected', tone: 'neutral' },
}

export const PAYOUT_TXN_STATUS_META: Record<Enums<'payout_txn_status'>, StatusMeta> = {
  initiated: { label: 'Initiated', tone: 'neutral' },
  processing: { label: 'Processing', tone: 'info' },
  success: { label: 'Success', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  reversed: { label: 'Reversed', tone: 'warning' },
}

export const DISPUTE_STATUS_META: Record<DisputeStatus, StatusMeta> = {
  created: { label: 'New', tone: 'warning' },
  under_review: { label: 'Under review', tone: 'info' },
  waiting_for_brand: { label: 'Waiting for brand', tone: 'lilac' },
  waiting_for_creator: { label: 'Waiting for creator', tone: 'lilac' },
  resolved: { label: 'Resolved', tone: 'success' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'neutral' },
}

export const OPEN_DISPUTE_STATUSES: DisputeStatus[] = ['created', 'under_review', 'waiting_for_brand', 'waiting_for_creator']

export const REPORT_STATUS_META: Record<ReportStatus, StatusMeta> = {
  open: { label: 'Open', tone: 'warning' },
  under_review: { label: 'Under review', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
}

export const REPORT_TARGET_LABEL: Record<ReportTarget, string> = {
  creator: 'Creator',
  brand: 'Brand',
  message: 'Message',
  portfolio: 'Portfolio item',
  review: 'Review',
  order: 'Order',
}

export const REFUND_STATUS_META: Record<Enums<'refund_status'>, StatusMeta> = {
  pending: { label: 'Pending', tone: 'warning' },
  processed: { label: 'Processed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
}

export const REVISION_STATUS_META: Record<RevisionStatus, StatusMeta> = {
  requested: { label: 'Requested', tone: 'warning' },
  submitted: { label: 'Submitted', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export const ACTOR_ROLE_META: Record<ActorRole, StatusMeta> = {
  brand: { label: 'Brand', tone: 'sky' },
  creator: { label: 'Creator', tone: 'lilac' },
  admin: { label: 'Admin', tone: 'dark' },
  system: { label: 'System', tone: 'neutral' },
}

export const REVIEW_STATUS_META: Record<'published' | 'hidden', StatusMeta> = {
  published: { label: 'Published', tone: 'success' },
  hidden: { label: 'Hidden', tone: 'neutral' },
}

export const CONTACT_STATUS_META: Record<'new' | 'read' | 'archived', StatusMeta> = {
  new: { label: 'New', tone: 'brand' },
  read: { label: 'Read', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'outline' },
}

/** `{ value, label }` options (in declaration order) for Select / filters. */
export function metaOptions<K extends string>(meta: Record<K, StatusMeta>) {
  return (Object.keys(meta) as K[]).map((value) => ({ value, label: meta[value].label }))
}

export function StatusBadge({
  meta,
  value,
  size = 'md',
  dot = true,
}: {
  meta: Record<string, StatusMeta>
  value: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
}) {
  if (!value) return <span className="text-faint">—</span>
  const m = meta[value] ?? { label: titleCase(value), tone: 'neutral' as const }
  return (
    <Badge tone={m.tone} size={size} dot={dot}>
      {m.label}
    </Badge>
  )
}

export function RoleBadge({ role, size = 'sm' }: { role: ActorRole | null | undefined; size?: 'sm' | 'md' }) {
  return <StatusBadge meta={ACTOR_ROLE_META} value={role ?? 'system'} size={size} dot={false} />
}
