import * as React from 'react'
import { BadgeCheck, CheckCircle2, RotateCcw, ShieldOff, ShieldCheck, Sparkles, Trash2, UserX, XCircle } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatDate } from '@/lib/format'
import { restoreCreator, setCreatorFlags, setCreatorStatus, setUserStatus, softDeleteCreator, type AdminCreatorDetail } from '@/services/admin.service'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ACCOUNT_STATUS_META, CREATOR_STATUS_META, StatusBadge } from './admin-status'
import { adminLists } from './admin-keys'
import { DetailCard } from './detail'
import { useAdminMutation } from './use-admin-mutation'

type CreatorAction =
  | 'approve'
  | 'reject'
  | 'suspend'
  | 'reinstate'
  | 'verify'
  | 'unverify'
  | 'feature'
  | 'unfeature'
  | 'remove'
  | 'restore'
  | 'suspend_account'
  | 'reactivate_account'

type ActionConfig = {
  title: string
  description: string
  confirmLabel: string
  success: string
  destructive?: boolean
  reason?: { label: string; placeholder: string; required: boolean }
}

function configFor(action: CreatorAction, name: string): ActionConfig {
  switch (action) {
    case 'approve':
      return {
        title: `Approve ${name}?`,
        description: 'The profile goes live on the marketplace and the creator is notified.',
        confirmLabel: 'Approve & publish',
        success: 'Creator approved and published',
      }
    case 'reject':
      return {
        title: `Reject ${name}’s profile?`,
        description: 'The creator sees your reason and can fix the profile before resubmitting.',
        confirmLabel: 'Reject profile',
        success: 'Profile rejected',
        destructive: true,
        reason: { label: 'Reason (shared with the creator)', placeholder: 'e.g. Add at least three portfolio samples and a clear profile photo.', required: true },
      }
    case 'suspend':
      return {
        title: `Suspend ${name}’s storefront?`,
        description: 'The profile is removed from search and can’t receive new orders. Existing orders continue.',
        confirmLabel: 'Suspend storefront',
        success: 'Storefront suspended',
        destructive: true,
        reason: { label: 'Reason (shared with the creator)', placeholder: 'What policy was broken?', required: true },
      }
    case 'reinstate':
      return {
        title: `Reinstate ${name}?`,
        description: 'The storefront is published again and appears in search.',
        confirmLabel: 'Reinstate',
        success: 'Creator reinstated',
        reason: { label: 'Internal note', placeholder: 'Why is the creator being reinstated?', required: false },
      }
    case 'verify':
      return { title: `Verify ${name}?`, description: 'Adds the verified badge to the storefront and cards. The creator is notified.', confirmLabel: 'Verify creator', success: 'Creator verified' }
    case 'unverify':
      return { title: `Remove ${name}’s verified badge?`, description: 'The badge disappears from the storefront and search results.', confirmLabel: 'Remove badge', success: 'Verified badge removed', destructive: true }
    case 'feature':
      return { title: `Feature ${name}?`, description: 'Featured creators are highlighted on the homepage and in discovery.', confirmLabel: 'Feature creator', success: 'Creator featured' }
    case 'unfeature':
      return { title: `Stop featuring ${name}?`, description: 'The creator is removed from featured placements.', confirmLabel: 'Unfeature', success: 'Creator unfeatured' }
    case 'remove':
      return {
        title: `Remove ${name}’s storefront?`,
        description: 'Soft delete: the profile is hidden everywhere and suspended. Orders, earnings and history are kept, and you can restore it later.',
        confirmLabel: 'Remove storefront',
        success: 'Storefront removed',
        destructive: true,
        reason: { label: 'Reason', placeholder: 'Why is this storefront being removed?', required: true },
      }
    case 'restore':
      return {
        title: `Restore ${name}’s storefront?`,
        description: 'The profile comes back as “Pending review” so you can check it before publishing.',
        confirmLabel: 'Restore',
        success: 'Storefront restored — pending review',
      }
    case 'suspend_account':
      return {
        title: `Suspend ${name}’s account?`,
        description: 'The creator is signed out of every workspace action and can’t log in to work until reactivated.',
        confirmLabel: 'Suspend account',
        success: 'Account suspended',
        destructive: true,
        reason: { label: 'Reason (sent to the creator)', placeholder: 'e.g. Repeated off-platform payment requests.', required: true },
      }
    case 'reactivate_account':
      return {
        title: `Reactivate ${name}’s account?`,
        description: 'The creator can sign in and use their workspace again.',
        confirmLabel: 'Reactivate account',
        success: 'Account reactivated',
        reason: { label: 'Internal note', placeholder: 'Optional context for the audit log.', required: false },
      }
  }
}

/** Moderation panel: review decision, badges, account status and removal. Every action is confirmed. */
export function CreatorActionsPanel({ creator: c }: { creator: AdminCreatorDetail }) {
  const [pending, setPending] = React.useState<CreatorAction | null>(null)
  const removed = !!c.deleted_at
  const accountStatus = c.profile?.status ?? 'active'

  const run = useAdminMutation(
    async ({ action, reason }: { action: CreatorAction; reason: string }): Promise<unknown> => {
      const note = reason || undefined
      switch (action) {
        case 'approve':
        case 'reinstate':
          return setCreatorStatus(c.id, 'published', note)
        case 'reject':
          return setCreatorStatus(c.id, 'rejected', reason)
        case 'suspend':
          return setCreatorStatus(c.id, 'suspended', reason)
        case 'verify':
          return setCreatorFlags(c.id, { verified: true })
        case 'unverify':
          return setCreatorFlags(c.id, { verified: false })
        case 'feature':
          return setCreatorFlags(c.id, { featured: true })
        case 'unfeature':
          return setCreatorFlags(c.id, { featured: false })
        case 'remove':
          return softDeleteCreator(c.id, reason)
        case 'restore':
          return restoreCreator(c.id)
        case 'suspend_account':
          return setUserStatus(c.profile_id, 'suspended', reason)
        case 'reactivate_account':
          return setUserStatus(c.profile_id, 'active', note)
      }
    },
    {
      invalidate: [qk.admin.creator(c.id), adminLists.creators, qk.admin.stats, qk.creators.all],
      success: (_d, v) => configFor(v.action, c.display_name).success,
      onSuccess: () => setPending(null),
    },
  )

  const config = pending ? configFor(pending, c.display_name) : null

  return (
    <DetailCard title="Moderation" description="Every action is logged in the audit trail.">
      <div className="space-y-5">
        <section aria-labelledby="mod-review">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id="mod-review" className="text-sm font-semibold">
              Profile review
            </h3>
            <StatusBadge meta={CREATOR_STATUS_META} value={c.status} size="sm" />
          </div>
          {removed ? (
            <p className="text-sm text-muted">Removed on {formatDate(c.deleted_at)}. Restore it to review again.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(c.status === 'pending_review' || c.status === 'rejected') && (
                <Button size="sm" onClick={() => setPending('approve')}>
                  <CheckCircle2 /> Approve
                </Button>
              )}
              {c.status === 'pending_review' && (
                <Button size="sm" variant="secondary" onClick={() => setPending('reject')}>
                  <XCircle /> Reject
                </Button>
              )}
              {c.status === 'suspended' && (
                <Button size="sm" onClick={() => setPending('reinstate')}>
                  <RotateCcw /> Reinstate
                </Button>
              )}
              {c.status !== 'suspended' && (
                <Button size="sm" variant="danger-ghost" onClick={() => setPending('suspend')}>
                  <ShieldOff /> Suspend
                </Button>
              )}
              {c.status === 'draft' && <p className="w-full text-xs text-muted">The creator hasn’t submitted this profile for review yet.</p>}
            </div>
          )}
        </section>

        <Separator />

        <section aria-labelledby="mod-badges">
          <h3 id="mod-badges" className="mb-2 text-sm font-semibold">
            Badges
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={c.verified ? 'secondary' : 'outline'} onClick={() => setPending(c.verified ? 'unverify' : 'verify')}>
              <BadgeCheck /> {c.verified ? 'Unverify' : 'Verify'}
            </Button>
            <Button size="sm" variant={c.featured ? 'secondary' : 'outline'} onClick={() => setPending(c.featured ? 'unfeature' : 'feature')}>
              <Sparkles /> {c.featured ? 'Unfeature' : 'Feature'}
            </Button>
          </div>
        </section>

        <Separator />

        <section aria-labelledby="mod-account">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id="mod-account" className="text-sm font-semibold">
              Account access
            </h3>
            <StatusBadge meta={ACCOUNT_STATUS_META} value={accountStatus} size="sm" />
          </div>
          <p className="mb-3 text-xs text-muted">Suspending the account blocks sign-in to the creator workspace, not just the storefront.</p>
          {accountStatus === 'active' ? (
            <Button size="sm" variant="danger-ghost" onClick={() => setPending('suspend_account')}>
              <UserX /> Suspend account
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setPending('reactivate_account')}>
              <ShieldCheck /> Reactivate account
            </Button>
          )}
        </section>

        <Separator />

        <section aria-labelledby="mod-danger">
          <h3 id="mod-danger" className="mb-2 text-sm font-semibold text-danger">
            Danger zone
          </h3>
          {removed ? (
            <Button size="sm" variant="secondary" onClick={() => setPending('restore')}>
              <RotateCcw /> Restore storefront
            </Button>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setPending('remove')}>
              <Trash2 /> Remove storefront
            </Button>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={config?.title ?? ''}
        description={config?.description}
        confirmLabel={config?.confirmLabel}
        destructive={config?.destructive}
        loading={run.isPending}
        reasonLabel={config?.reason?.label}
        reasonPlaceholder={config?.reason?.placeholder}
        reasonRequired={config?.reason?.required ?? false}
        onConfirm={(reason) => {
          if (pending) run.mutate({ action: pending, reason })
        }}
      />
    </DetailCard>
  )
}
