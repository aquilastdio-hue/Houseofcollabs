import * as React from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, Users, X } from 'lucide-react'
import { formatCompact, formatINR, formatRelative } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { decideApplication, listCampaignApplicants, type Campaign, type CampaignApplicant } from '@/services/campaigns.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { SectionCard } from '@/components/brand/section-card'
import { ApplicationStatusBadge, MatchList } from './campaign-ui'

/**
 * Who applied. The brand can accept or reject pending applicants; an admin sees
 * the same list read-only. Profiles open the creator's storefront.
 */
export function ApplicantsList({ campaign, canDecide, profileBase }: { campaign: Campaign; canDecide: boolean; profileBase: '/creators' | '/admin/creators' }) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: qk.campaigns.applicants(campaign.id), queryFn: () => listCampaignApplicants(campaign.id) })
  const [pending, setPending] = React.useState<{ applicant: CampaignApplicant; accept: boolean } | null>(null)
  const decide = useMutation({
    mutationFn: (v: { id: string; accept: boolean; note: string }) => decideApplication(v.id, v.accept, v.note),
    meta: { successMessage: 'Applicant updated' },
    onSuccess: async () => {
      setPending(null)
      await qc.invalidateQueries({ queryKey: qk.campaigns.all })
    },
  })
  const items = query.data ?? []
  const accepted = items.filter((a) => a.status === 'accepted').length

  return (
    <SectionCard
      title="Applicants"
      description={`${accepted} of ${campaign.creators_needed} ${campaign.creators_needed === 1 ? 'creator' : 'creators'} accepted`}
    >
      {query.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={<Users />}
          title="No applications yet"
          description={campaign.status === 'live' ? 'Creators who apply will show up here.' : 'Creators can apply once the campaign is live.'}
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((a) => (
            <li key={a.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar src={a.creator.photo} name={a.creator.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={profileBase === '/creators' ? `/creators/${a.creator.slug}` : `/admin/creators/${a.creator.id}`}
                      target={profileBase === '/creators' ? '_blank' : undefined}
                      className="font-medium hover:underline"
                    >
                      {a.creator.name}
                    </Link>
                    <ApplicationStatusBadge status={a.status} size="sm" />
                    {a.invited && (
                      <Badge tone="brand" size="sm">
                        Invited
                      </Badge>
                    )}
                    {a.match?.matches && (
                      <Badge tone="success" size="sm">
                        Matches
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    {formatCompact(a.creator.followers)} followers
                    {a.creator.city ? ` · ${a.creator.city}` : ''}
                    {a.creator.categories.length ? ` · ${a.creator.categories.slice(0, 3).join(', ')}` : ''}
                    {` · applied ${formatRelative(a.created_at)}`}
                  </p>
                  <p className="mt-2 text-sm whitespace-pre-line">{a.pitch}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {a.proposed_fee != null && <span>Asks {formatINR(a.proposed_fee)}</span>}
                    {a.sample_url && (
                      <a href={a.sample_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 underline underline-offset-2">
                        Example <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-xs text-muted">Requirements match</summary>
                    <div className="mt-2">
                      <MatchList campaign={campaign} match={a.match} />
                    </div>
                  </details>
                  {a.brand_note && <p className="mt-2 text-xs text-muted">Your note: {a.brand_note}</p>}
                </div>
                {canDecide && a.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setPending({ applicant: a, accept: false })}>
                      <X /> Reject
                    </Button>
                    <Button size="sm" onClick={() => setPending({ applicant: a, accept: true })}>
                      <Check /> Accept
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? `${pending.accept ? 'Accept' : 'Reject'} ${pending.applicant.creator.name}?` : ''}
        description={
          pending?.accept
            ? 'They’re notified straight away. Agree next steps (product, posting dates, payment) with them directly.'
            : 'They’re told you went with other creators this time.'
        }
        confirmLabel={pending?.accept ? 'Accept' : 'Reject'}
        destructive={!pending?.accept}
        loading={decide.isPending}
        reasonLabel="Note to the creator"
        reasonPlaceholder={pending?.accept ? 'e.g. We’ll ship the kit on Monday.' : 'Optional'}
        reasonRequired={false}
        onConfirm={(note) => {
          if (pending) decide.mutate({ id: pending.applicant.id, accept: pending.accept, note })
        }}
      />
    </SectionCard>
  )
}
