import * as React from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Lock, Undo2 } from 'lucide-react'
import { formatCompact, formatDateTime } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { closeCampaign, getCampaign, reviewCampaign, type ManagedCampaign } from '@/services/campaigns.service'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { ErrorState } from '@/components/shared/states'
import { SectionCard } from '@/components/brand/section-card'
import { ApplicantsList } from '@/components/campaigns/applicants-list'
import { CampaignBrandLine, CampaignOverview, CampaignStatusBadge } from '@/components/campaigns/campaign-ui'

type Action = 'approve' | 'reject' | 'close'

/** Admin → one campaign: review it, and keep an eye on who applied. */
export default function CampaignDetail() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const query = useQuery({ queryKey: qk.campaigns.detail(id), queryFn: () => getCampaign(id), enabled: !!id })
  const c = query.data as ManagedCampaign | undefined
  const [pending, setPending] = React.useState<Action | null>(null)
  const act = useMutation({
    mutationFn: ({ action, note }: { action: Action; note: string }) =>
      action === 'close' ? closeCampaign(id) : reviewCampaign(id, action === 'approve', note),
    meta: { successMessage: 'Campaign updated' },
    onSuccess: async () => {
      setPending(null)
      await qc.invalidateQueries({ queryKey: qk.campaigns.all })
    },
  })

  return (
    <>
      <Seo title={c?.title ?? 'Campaign'} noindex />
      <Breadcrumb items={[{ label: 'Campaigns', href: '/admin/campaigns' }, { label: c?.title ?? 'Campaign' }]} />
      {query.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError || !c ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <PageHeader title={c.title} description={<CampaignBrandLine campaign={c} />} actions={<CampaignStatusBadge status={c.status} />} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="min-w-0 space-y-6">
              <CampaignOverview campaign={c} />
              {(c.status === 'live' || c.status === 'closed') && <ApplicantsList campaign={c} canDecide={false} profileBase="/admin/creators" />}
            </div>
            <aside className="space-y-6 lg:sticky lg:top-6">
              <SectionCard title="Review">
                {c.status === 'pending_review' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted">
                      Submitted {c.submitted_at ? formatDateTime(c.submitted_at) : ''}. Approving puts it in front of every creator and notifies anyone invited.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setPending('approve')}>
                        <CheckCircle2 /> Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setPending('reject')}>
                        <Undo2 /> Send back
                      </Button>
                    </div>
                  </div>
                ) : c.status === 'rejected' ? (
                  <p className="text-sm text-muted">
                    Sent back {c.reviewed_at ? formatDateTime(c.reviewed_at) : ''}: <span className="text-ink">{c.review_note}</span>
                  </p>
                ) : c.status === 'live' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted">Approved {c.reviewed_at ? formatDateTime(c.reviewed_at) : ''}. Live for creators.</p>
                    <Button size="sm" variant="secondary" onClick={() => setPending('close')}>
                      <Lock /> Close campaign
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted">Closed {c.closed_at ? formatDateTime(c.closed_at) : ''}.</p>
                )}
              </SectionCard>
              <SectionCard title="Brand">
                <Link to={`/admin/brands/${c.brand.id}`} className="flex items-center gap-2.5 hover:underline">
                  <Avatar src={c.brand.logo} name={c.brand.name} size="sm" shape="rounded" />
                  <span className="text-sm font-medium">{c.brand.name}</span>
                </Link>
              </SectionCard>
              {c.invites.length > 0 && (
                <SectionCard title="Invited creators">
                  <ul className="space-y-2.5">
                    {c.invites.map((i) => (
                      <li key={i.id}>
                        <Link to={`/admin/creators/${i.id}`} className="flex items-center gap-2.5 hover:underline">
                          <Avatar src={i.photo} name={i.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{i.name}</span>
                            <span className="block text-xs text-muted">{formatCompact(i.followers)} followers</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}
            </aside>
          </div>
          <ConfirmDialog
            open={!!pending}
            onOpenChange={(o) => !o && setPending(null)}
            title={pending === 'approve' ? 'Approve this campaign?' : pending === 'reject' ? 'Send this campaign back?' : 'Close this campaign?'}
            description={
              pending === 'approve'
                ? 'It goes live for every creator, and invited creators are notified.'
                : pending === 'reject'
                  ? 'The brand sees your reason and can edit and resubmit.'
                  : 'Creators can no longer apply. Existing applicants are kept.'
            }
            confirmLabel={pending === 'approve' ? 'Approve' : pending === 'reject' ? 'Send back' : 'Close campaign'}
            destructive={pending !== 'approve'}
            loading={act.isPending}
            reasonLabel={pending === 'reject' ? 'What should the brand change? (shown to them)' : undefined}
            reasonPlaceholder="e.g. Add the posting window and the fee per creator."
            reasonRequired={pending === 'reject'}
            onConfirm={(note) => {
              if (pending) act.mutate({ action: pending, note: note ?? '' })
            }}
          />
        </>
      )}
    </>
  )
}
