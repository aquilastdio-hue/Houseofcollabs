import { RefreshCw } from 'lucide-react'
import { formatCompact, formatDateTime, formatPercent } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { useInstagramStats } from '@/hooks/use-creators'
import { refreshAllInstagramStats, refreshInstagramStats } from '@/services/instagram-stats.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DetailCard, DetailItem, DetailList } from './detail'
import { useAdminMutation } from './use-admin-mutation'

const STATUS = {
  ok: { label: 'Public', tone: 'success' },
  private: { label: 'Private account', tone: 'warning' },
  not_found: { label: 'Not found', tone: 'danger' },
  error: { label: 'Error', tone: 'danger' },
} as const

/**
 * The public Instagram numbers shown on the storefront, with a manual refresh.
 * The Sunday job covers live creators; this is for checking a new or edited
 * profile without waiting a week.
 */
export function CreatorInstagramCard({ creatorId }: { creatorId: string }) {
  const { data: stats, isPending } = useInstagramStats(creatorId)
  const refresh = useAdminMutation(() => refreshInstagramStats(creatorId), {
    invalidate: [qk.creators.instagram(creatorId)],
    success: (row) => (row.status === 'ok' ? 'Instagram stats updated' : `Instagram: ${STATUS[row.status as keyof typeof STATUS]?.label ?? row.status}`),
  })
  const refreshAll = useAdminMutation(() => refreshAllInstagramStats(), {
    success: (r) => (r.started ? `Refreshing ${r.profiles} creators — results arrive in a few minutes` : 'No live creators with Instagram'),
  })
  const status = stats ? STATUS[stats.status as keyof typeof STATUS] : null

  return (
    <DetailCard
      title="Instagram stats"
      description="Public numbers on the storefront, refreshed every Sunday."
      action={
        <>
          <Button type="button" size="sm" variant="ghost" loading={refreshAll.isPending} onClick={() => refreshAll.mutate()}>
            Refresh all creators
          </Button>
          <Button type="button" size="sm" variant="secondary" loading={refresh.isPending} onClick={() => refresh.mutate()}>
            <RefreshCw /> Refresh now
          </Button>
        </>
      }
    >
      {isPending ? null : !stats ? (
        <p className="text-sm text-muted">Not fetched yet. Refresh now, or it’s picked up on Sunday once the creator is live.</p>
      ) : (
        <DetailList>
          <DetailItem label="Account">
            <span className="flex flex-wrap items-center gap-2">
              @{stats.username}
              {status && <Badge size="sm" tone={status.tone}>{status.label}</Badge>}
            </span>
          </DetailItem>
          <DetailItem label="Updated">{stats.fetched_at ? formatDateTime(stats.fetched_at) : null}</DetailItem>
          <DetailItem label="Followers">{stats.followers_count !== null ? formatCompact(stats.followers_count) : null}</DetailItem>
          <DetailItem label="Engagement rate">
            {stats.engagement_rate !== null ? `${formatPercent(Number(stats.engagement_rate), 2)} · ${stats.posts_sampled} posts` : null}
          </DetailItem>
          <DetailItem label="Avg. Reel views">
            {stats.avg_reel_views !== null ? `${formatCompact(Number(stats.avg_reel_views))} · ${stats.reels_sampled} Reels` : null}
          </DetailItem>
          {stats.last_error && <DetailItem label="Note" className="sm:col-span-2">{stats.last_error}</DetailItem>}
        </DetailList>
      )}
    </DetailCard>
  )
}
