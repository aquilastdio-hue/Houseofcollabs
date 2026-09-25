import { Badge, type BadgeTone } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import type { BriefStatus } from '@/types'

type Meta = { label: string; tone: BadgeTone; brand: string; creator: string }

/** Presentation metadata per brief status (the database owns transitions). */
export const BRIEF_STATUS_META: Record<BriefStatus, Meta> = {
  draft: {
    label: 'Draft',
    tone: 'neutral',
    brand: 'Only you can see this brief. Send it to a creator when it’s ready.',
    creator: 'This brief hasn’t been sent yet.',
  },
  sent: {
    label: 'Sent',
    tone: 'info',
    brand: 'Waiting for the creator to accept or decline.',
    creator: 'Review the brief, then accept or decline it.',
  },
  accepted: {
    label: 'Accepted',
    tone: 'success',
    brand: 'The creator is in. Hire them through one of their services to start.',
    creator: 'You accepted this brief. The brand can now hire you through one of your services.',
  },
  rejected: {
    label: 'Declined',
    tone: 'danger',
    brand: 'The creator passed on this brief. You can send it to someone else.',
    creator: 'You declined this brief.',
  },
  completed: {
    label: 'Completed',
    tone: 'brand',
    brand: 'The collaboration for this brief is complete.',
    creator: 'The collaboration for this brief is complete.',
  },
}

export const BRIEF_STATUS_FILTERS: { value: BriefStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Declined' },
  { value: 'completed', label: 'Completed' },
]

export function BriefStatusBadge({ status, size = 'md' }: { status: BriefStatus; size?: 'sm' | 'md' | 'lg' }) {
  const meta = BRIEF_STATUS_META[status]
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  )
}

/** `deadline` is a DB `date` (yyyy-MM-dd); parse it as a local calendar day. */
export function deadlineDate(deadline?: string | null) {
  return deadline ? new Date(`${deadline}T00:00:00`) : null
}

export function formatDeadline(deadline?: string | null, pattern?: string) {
  return formatDate(deadlineDate(deadline), pattern)
}

/** Deadline has passed while the brief is still waiting to go out / be answered. */
export function isBriefOverdue(deadline: string | null | undefined, status: BriefStatus) {
  const d = deadlineDate(deadline)
  if (!d || (status !== 'draft' && status !== 'sent')) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d.getTime() < today.getTime()
}
