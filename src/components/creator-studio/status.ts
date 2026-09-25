import type { BadgeTone } from '@/components/ui/badge'
import type { BriefStatus, CreatorStatus, EarningStatus, Enums, PayoutStatus } from '@/types'

type Meta = { label: string; tone: BadgeTone }

export const CREATOR_STATUS_META: Record<CreatorStatus, Meta & { description: string }> = {
  draft: { label: 'Draft', tone: 'neutral', description: 'Your storefront isn’t visible to brands yet.' },
  pending_review: {
    label: 'In review',
    tone: 'info',
    description: 'Our team is reviewing your profile. We’ll notify you as soon as it’s live.',
  },
  published: { label: 'Live', tone: 'success', description: 'Brands can discover your storefront and order your services.' },
  rejected: { label: 'Needs changes', tone: 'warning', description: 'Update your profile and resubmit it for review.' },
  suspended: { label: 'Suspended', tone: 'danger', description: 'Your storefront is hidden. Contact support for help.' },
}

export const EARNING_STATUS_META: Record<EarningStatus, Meta> = {
  pending: { label: 'Pending', tone: 'warning' },
  available: { label: 'Available', tone: 'brand' },
  paid: { label: 'Paid', tone: 'success' },
  held: { label: 'On hold', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
}

export const PAYOUT_STATUS_META: Record<PayoutStatus, Meta> = {
  pending: { label: 'Requested', tone: 'warning' },
  processing: { label: 'Processing', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export const PAYOUT_TXN_STATUS_META: Record<Enums<'payout_txn_status'>, Meta> = {
  initiated: { label: 'Initiated', tone: 'neutral' },
  processing: { label: 'Processing', tone: 'info' },
  success: { label: 'Successful', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  reversed: { label: 'Reversed', tone: 'warning' },
}

export const BRIEF_STATUS_META: Record<BriefStatus, Meta> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'New', tone: 'brand' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Declined', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'info' },
}
