import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { adminListCampaigns, type CampaignStatus } from '@/services/campaigns.service'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { CAMPAIGN_STATUS_META, CampaignCard, CampaignListSkeleton } from '@/components/campaigns/campaign-ui'

const TABS: { value: CampaignStatus | 'all'; label: string }[] = [
  { value: 'pending_review', label: CAMPAIGN_STATUS_META.pending_review.label },
  { value: 'live', label: CAMPAIGN_STATUS_META.live.label },
  { value: 'rejected', label: 'Sent back' },
  { value: 'closed', label: CAMPAIGN_STATUS_META.closed.label },
  { value: 'all', label: 'All' },
]

/** Admin → Campaigns: every campaign needs approval before creators see it. Drafts stay private to the brand. */
export default function Campaigns() {
  const [sp, setSp] = useSearchParams()
  const tab = TABS.find((t) => t.value === sp.get('status'))?.value ?? 'pending_review'
  const query = useQuery({ queryKey: qk.campaigns.admin('all'), queryFn: () => adminListCampaigns() })
  const all = query.data ?? []
  const shown = tab === 'all' ? all : all.filter((c) => c.status === tab)

  return (
    <>
      <Seo title="Campaigns" noindex />
      <PageHeader
        eyebrow="Marketplace"
        title="Campaigns"
        description="Open calls from brands. Approve them to put them in front of creators, or send them back with what to change."
      />
      <Tabs value={tab} onValueChange={(v) => setSp(v === 'pending_review' ? {} : { status: v })}>
        <TabsList aria-label="Filter campaigns by status">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {query.data && t.value !== 'all' && (
                <span className="ml-1.5 rounded-pill bg-subtle px-1.5 text-xs text-muted tabular-nums">{all.filter((c) => c.status === t.value).length}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-6">
          {query.isPending ? (
            <CampaignListSkeleton />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<Megaphone />}
              title={tab === 'pending_review' ? 'Nothing waiting for review' : 'Nothing here'}
              description={tab === 'pending_review' ? 'Campaigns brands submit show up here.' : 'Campaigns with this status show up here.'}
            />
          ) : (
            <ul className="space-y-3">
              {shown.map((c) => (
                <li key={c.id}>
                  <CampaignCard campaign={c} perspective="admin" />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
