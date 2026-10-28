import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { listCreatorCampaigns, type CreatorCampaign } from '@/services/campaigns.service'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { CampaignCard, CampaignListSkeleton, isApplyClosed } from '@/components/campaigns/campaign-ui'

const TABS = [
  { value: 'open', label: 'Open', empty: 'No open campaigns right now. New ones appear here as soon as brands publish them.' },
  { value: 'invited', label: 'Invited', empty: 'When a brand invites you to a campaign, it shows up here.' },
  { value: 'applied', label: 'Applied', empty: 'Campaigns you apply to are tracked here.' },
] as const

type Tab = (typeof TABS)[number]['value']

function inTab(c: CreatorCampaign, tab: Tab) {
  if (tab === 'applied') return !!c.my_application && c.my_application.status !== 'withdrawn'
  const open = !isApplyClosed(c) && (!c.my_application || c.my_application.status === 'withdrawn')
  return tab === 'invited' ? open && c.invited : open
}

/** Creator → Campaigns: every live campaign from brands, plus the ones you applied to. */
export default function Campaigns() {
  const [sp, setSp] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.value === sp.get('tab'))?.value ?? 'open'
  const query = useQuery({ queryKey: qk.campaigns.creator, queryFn: listCreatorCampaigns })
  const all = query.data ?? []
  const count = (t: Tab) => all.filter((c) => inTab(c, t)).length

  return (
    <>
      <Seo title="Campaigns" noindex />
      <PageHeader
        title="Campaigns"
        description="Open calls from brands. Apply to the ones that suit you — the brand picks who it works with."
      />
      <Tabs value={tab} onValueChange={(v) => setSp(v === 'open' ? {} : { tab: v })}>
        <TabsList aria-label="Filter campaigns">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {query.data && <span className="ml-1.5 rounded-pill bg-subtle px-1.5 text-xs text-muted tabular-nums">{count(t.value)}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-6">
          {query.isPending ? (
            <CampaignListSkeleton />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : all.filter((c) => inTab(c, tab)).length === 0 ? (
            <EmptyState icon={<Megaphone />} title="Nothing here yet" description={TABS.find((t) => t.value === tab)!.empty} />
          ) : (
            <ul className="space-y-3">
              {all
                .filter((c) => inTab(c, tab))
                .map((c) => (
                  <li key={c.id}>
                    <CampaignCard campaign={c} perspective="creator" />
                  </li>
                ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
