import * as React from 'react'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import type { VerificationStatus } from '@/services/creators.service'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useRequirements } from './feature-gate'
import { VerificationForm } from './verification-form'

export const VERIFICATION_META: Record<VerificationStatus, { label: string; tone: BadgeTone; description: string }> = {
  pending: { label: 'Pending', tone: 'info', description: 'Our team is checking your details. We’ll let you know as soon as it’s done.' },
  approved: { label: 'Verified', tone: 'success', description: 'Your verified badge is showing on your storefront.' },
  rejected: { label: 'Not approved', tone: 'danger', description: 'We couldn’t verify you with what was sent.' },
  more_info: { label: 'More info needed', tone: 'warning', description: 'We need something else before we can verify you.' },
}

/**
 * Identity verification, offered from the profile page rather than asked for at
 * signup. Shows the current state and the "more info" note when there is one.
 */
export function VerificationCard({ className }: { className?: string }) {
  const query = useRequirements()
  const [open, setOpen] = React.useState(false)

  if (query.isPending) return <Skeleton className={cn('h-36 rounded-card', className)} />
  if (query.isError || !query.data?.creator_id) return null

  const { verified, verification } = query.data
  const status: VerificationStatus | null = verified ? 'approved' : (verification?.status ?? null)
  const meta = status ? VERIFICATION_META[status] : null
  const canSubmit = !verified && (status === null || status === 'rejected' || status === 'more_info')

  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <h2 className="eyebrow text-faint">Verification</h2>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {meta ? (
          <Badge tone={meta.tone} size="lg" dot>
            {meta.label}
          </Badge>
        ) : (
          <Badge tone="neutral" size="lg" dot>
            Not verified
          </Badge>
        )}
        {status === 'approved' && verification?.reviewed_at && <span className="text-xs text-muted">Since {formatDate(verification.reviewed_at)}</span>}
      </div>

      <p className="mt-3 text-sm text-muted">
        {meta?.description ?? 'A verified badge tells brands you are who you say you are. It takes a couple of minutes.'}
      </p>

      {verification?.review_note && (status === 'rejected' || status === 'more_info') && (
        <div className="mt-3 rounded-control bg-warning-soft px-3 py-2.5 text-sm text-warning">
          <p className="font-medium">Note from our team</p>
          <p className="mt-0.5 whitespace-pre-line">{verification.review_note}</p>
        </div>
      )}

      {canSubmit && (
        <Button type="button" block className="mt-5" variant={status ? 'secondary' : 'primary'} onClick={() => setOpen(true)}>
          <ShieldCheck /> {status === 'more_info' ? 'Send the extra details' : status === 'rejected' ? 'Try again' : 'Get verified'}
        </Button>
      )}

      <Modal open={open} onOpenChange={setOpen} size="lg" title="Verify your identity">
        <VerificationForm onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Modal>
    </Card>
  )
}
