import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Megaphone, Plus } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { useAuth } from '@/contexts/auth-context'
import { listBrandCampaigns, type CampaignStatus } from '@/services/campaigns.service'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { BrandMissing } from '@/components/brand/brand-missing'
import { CAMPAIGN_STATUS_META, CampaignCard, CampaignListSkeleton } from '@/components/campaigns/campaign-ui'

const TABS: { value: CampaignStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: CAMPAIGN_STATUS_META.live.label },
  { value: 'pending_review', label: CAMPAIGN_STATUS_META.pending_review.label },
  { value: 'rejected', label: CAMPAIGN_STATUS_META.rejected.label },
  { value: 'draft', label: 'Drafts' },
  { value: 'closed', label: CAMPAIGN_STATUS_META.closed.label },
]

/** Brand → Campaigns: open calls to creators, each approved by the team first. */
export default function Campaigns() {
  const { brand } = useAuth()
  const [sp, setSp] = useSearchParams()
  const tab = TABS.find((t) => t.value === sp.get('status'))?.value ?? 'all'
  const query = useQuery({ queryKey: qk.campaigns.brand, queryFn: listBrandCampaigns, enabled: !!brand })
  const all = query.data ?? []
  const shown = tab === 'all' ? all : all.filter((c) => c.status === tab)

  const create = (
    <Button asChild>
      <Link to="/brand/campaigns/new">
        <Plus /> New campaign
      </Link>
    </Button>
  )

  return (
    <>
      <Seo title="Campaigns" noindex />
      <PageHeader
        title="Campaigns"
        description="Post an open call, and creators apply. Each campaign is checked by our team before it goes live."
        actions={brand ? create : undefined}
      />
      {!brand ? (
        <BrandMissing />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setSp(v === 'all' ? {} : { status: v })}>
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
                title={tab === 'all' ? 'No campaigns yet' : 'Nothing here'}
                description={tab === 'all' ? 'Describe what you need once, and let creators come to you.' : 'Campaigns with this status show up here.'}
                action={tab === 'all' ? create : undefined}
              />
            ) : (
              <ul className="space-y-3">
                {shown.map((c) => (
                  <li key={c.id}>
                    <CampaignCard campaign={c} perspective="brand" />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      )}
    </>
  )
}
