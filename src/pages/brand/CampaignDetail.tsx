import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil, Send, Trash2 } from 'lucide-react'
import { formatCompact, formatRelative } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { closeCampaign, deleteCampaign, getCampaign, submitCampaign, type ManagedCampaign } from '@/services/campaigns.service'
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
import { CampaignOverview, CampaignStatusBadge } from '@/components/campaigns/campaign-ui'

/** Brand → one campaign: where it stands, what to do next, and who applied. */
export default function CampaignDetail() {
  const { id = '' } = useParams()
  const query = useQuery({ queryKey: qk.campaigns.detail(id), queryFn: () => getCampaign(id), enabled: !!id })
  const c = query.data as ManagedCampaign | undefined

  return (
    <>
      <Seo title={c?.title ?? 'Campaign'} noindex />
      <Breadcrumb items={[{ label: 'Campaigns', href: '/brand/campaigns' }, { label: c?.title ?? 'Campaign' }]} />
      {query.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError || !c ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <PageHeader title={c.title} description={`Created ${formatRelative(c.created_at)}`} actions={<CampaignStatusBadge status={c.status} />} />
          <StatusPanel campaign={c} />
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="min-w-0 space-y-6">
              {(c.status === 'live' || c.status === 'closed') && <ApplicantsList campaign={c} canDecide={c.status === 'live'} profileBase="/creators" />}
              <CampaignOverview campaign={c} />
            </div>
            <aside className="space-y-6 lg:sticky lg:top-6">
              <SectionCard title="Invited creators" description={c.invites.length ? 'Told once the campaign is approved.' : 'You didn’t invite anyone specific.'}>
                {c.invites.length > 0 && (
                  <ul className="space-y-2.5">
                    {c.invites.map((i) => (
                      <li key={i.id} className="flex items-center gap-2.5">
                        <Avatar src={i.photo} name={i.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{i.name}</span>
                          <span className="block text-xs text-muted">
                            {formatCompact(i.followers)} followers{i.city ? ` · ${i.city}` : ''}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </aside>
          </div>
        </>
      )}
    </>
  )
}

/** The one thing to know (and do) for each status. */
function StatusPanel({ campaign: c }: { campaign: ManagedCampaign }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [confirm, setConfirm] = React.useState<'close' | 'delete' | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: qk.campaigns.all })
  const submit = useMutation({ mutationFn: () => submitCampaign(c.id), meta: { successMessage: 'Sent for review' }, onSuccess: refresh })
  const close = useMutation({
    mutationFn: () => closeCampaign(c.id),
    meta: { successMessage: 'Campaign closed' },
    onSuccess: async () => {
      setConfirm(null)
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteCampaign(c.id),
    meta: { successMessage: 'Campaign deleted' },
    onSuccess: async () => {
      await refresh()
      navigate('/brand/campaigns', { replace: true })
    },
  })
  const editable = c.status === 'draft' || c.status === 'rejected'

  const copy: Record<ManagedCampaign['status'], { tone: string; text: React.ReactNode }> = {
    draft: { tone: 'border-line bg-subtle', text: 'This is a draft. Submit it for review when it’s ready — our team checks every campaign before creators can see it.' },
    pending_review: { tone: 'border-info/30 bg-info-soft text-info', text: 'Our team is reviewing this campaign. You’ll get a notification once it’s approved or if anything needs changing.' },
    rejected: {
      tone: 'border-warning/30 bg-warning-soft text-warning',
      text: (
        <>
          <span className="font-medium">Sent back for changes:</span> {c.review_note}
        </>
      ),
    },
    live: { tone: 'border-success/30 bg-success-soft text-success', text: 'Live — creators can see this campaign and apply.' },
    closed: { tone: 'border-line bg-subtle', text: 'Closed — no new applications. Your applicants are kept below.' },
  }

  return (
    <div className={`flex flex-col gap-3 rounded-card border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${copy[c.status].tone}`}>
      <p>{copy[c.status].text}</p>
      <div className="flex shrink-0 flex-wrap gap-2">
        {editable && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirm('delete')}>
              <Trash2 /> Delete
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to={`/brand/campaigns/${c.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
            <Button size="sm" loading={submit.isPending} onClick={() => submit.mutate()}>
              <Send /> Submit for review
            </Button>
          </>
        )}
        {c.status === 'live' && (
          <Button size="sm" variant="secondary" onClick={() => setConfirm('close')}>
            <Lock /> Close campaign
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'close' ? 'Close this campaign?' : 'Delete this campaign?'}
        description={
          confirm === 'close'
            ? 'Creators can no longer apply. Applicants you’ve already got stay here.'
            : 'The draft is removed for good.'
        }
        confirmLabel={confirm === 'close' ? 'Close campaign' : 'Delete'}
        destructive
        loading={close.isPending || remove.isPending}
        onConfirm={() => {
          if (confirm === 'close') close.mutate()
          else remove.mutate()
        }}
      />
    </div>
  )
}
