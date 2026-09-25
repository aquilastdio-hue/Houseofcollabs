import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ExternalLink, LifeBuoy, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { usePublicSettings } from '@/hooks/use-catalog'
import { publishProfile, type CreatorProfile } from '@/services/creators.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CREATOR_STATUS_META } from './status'
import { FeatureGateDialog, useFeatureGate } from './feature-gate'
import { useStudioSync } from './use-studio'

/** Storefront status with the publish / resubmit action (via `publish_creator_profile`). */
export function ProfileStatusCard({ creator, className }: { creator: CreatorProfile; className?: string }) {
  const settings = usePublicSettings()
  const sync = useStudioSync()
  const meta = CREATOR_STATUS_META[creator.status]
  const needsReview = settings.data?.require_creator_approval !== false
  const canSubmit = creator.status === 'draft' || creator.status === 'rejected'
  // Going live is gated rather than disabled: clicking tells the creator what
  // is still needed and brings them back here once it's done.
  const gate = useFeatureGate('go_live')

  const publish = useMutation({
    mutationFn: async () => {
      const row = await publishProfile()
      await sync()
      return row
    },
    onSuccess: (row) => {
      if (row.status === 'published') toast.success('Your profile is live', { description: 'Brands can now discover and hire you.' })
      else toast.success('Submitted for review', { description: 'We’ll notify you as soon as your profile is approved.' })
    },
  })

  const submitLabel = creator.status === 'rejected' ? 'Resubmit for review' : needsReview ? 'Submit for review' : 'Publish profile'

  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <h2 className="eyebrow text-faint">Storefront status</h2>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone} size="lg" dot>
          {meta.label}
        </Badge>
        {creator.status === 'published' && creator.published_at && <span className="text-xs text-muted">Live since {formatDate(creator.published_at)}</span>}
      </div>
      <p className="mt-3 text-sm text-muted">{meta.description}</p>

      {(creator.status === 'rejected' || creator.status === 'suspended') && creator.rejection_reason && (
        <div className="mt-3 rounded-control bg-warning-soft px-3 py-2.5 text-sm text-warning">
          <p className="font-medium">Note from our team</p>
          <p className="mt-0.5 whitespace-pre-line">{creator.rejection_reason}</p>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {canSubmit && (
          <>
            <Button
              type="button"
              block
              loading={publish.isPending}
              disabled={gate.query.isPending}
              onClick={() => gate.run(() => publish.mutate())}
            >
              <Send /> {submitLabel}
            </Button>
            {!gate.query.isPending && !gate.ready && (
              <p className="text-center text-xs text-muted">
                {gate.missing.length} thing{gate.missing.length === 1 ? '' : 's'} left — we’ll show you which.
              </p>
            )}
            {!gate.query.isPending && gate.ready && needsReview && (
              <p className="text-center text-xs text-muted">Our team reviews profiles before they go live.</p>
            )}
          </>
        )}
        {creator.status === 'published' && (
          <Button asChild variant="secondary" block>
            <Link to={`/creators/${creator.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> View public storefront
            </Link>
          </Button>
        )}
        {creator.status === 'suspended' && (
          <Button asChild variant="secondary" block>
            <Link to="/contact">
              <LifeBuoy /> Contact support
            </Link>
          </Button>
        )}
      </div>

      <FeatureGateDialog gate={gate} />
    </Card>
  )
}
