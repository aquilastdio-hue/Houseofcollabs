import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ExternalLink, Instagram, RefreshCw } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatCompact, formatDate, formatNumber, formatRelative } from '@/lib/format'
import { getInstagramConnection, syncInstagramConnection } from '@/services/admin.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAdminMutation } from './use-admin-mutation'

const keyFor = (p: { applicationId?: string; creatorId?: string }) => [...qk.admin.all, 'instagram', p.applicationId ?? null, p.creatorId ?? null] as const

const normalise = (handle: string) => handle.trim().replace(/^@/, '').toLowerCase()

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-control bg-subtle px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-base font-semibold tabular-nums">{value}</p>
      {note && <p className="text-[11px] text-faint">{note}</p>}
    </div>
  )
}

/**
 * What Instagram itself returned for a creator's connected account: verified
 * handle, followers, and averages over the posts that had each metric. Renders
 * nothing when the creator didn't connect. Admin-only data.
 */
export function InstagramVerified({ applicationId, creatorId, typedHandle }: { applicationId?: string; creatorId?: string; typedHandle?: string }) {
  const key = keyFor({ applicationId, creatorId })
  const query = useQuery({ queryKey: key, queryFn: () => getInstagramConnection({ applicationId, creatorId }) })
  const sync = useAdminMutation((id: string) => syncInstagramConnection(id), {
    invalidate: [key],
    success: 'Refreshed from Instagram',
  })

  if (query.isPending) return <p className="py-2 text-sm text-muted">Checking Instagram connection…</p>
  if (query.isError) return <p className="py-2 text-sm text-muted">Couldn’t load the Instagram connection.</p>
  const c = query.data
  if (!c) return null

  const s = c.stats ?? {}
  const mismatch = typedHandle && normalise(typedHandle) !== c.username.toLowerCase()
  const dash = '—'

  return (
    <div className="mt-2 space-y-3 rounded-control border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Instagram className="size-4 shrink-0 text-brand" aria-hidden />
          <a href={`https://www.instagram.com/${c.username}/`} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-semibold hover:underline">
            @{c.username}
          </a>
          {c.status === 'connected' ? (
            <Badge tone="success" size="sm">
              Verified by Instagram
            </Badge>
          ) : (
            <Badge tone="danger" size="sm">
              {c.status === 'token_expired' ? 'Connection expired' : c.status === 'revoked' ? 'Access revoked' : 'Error'}
            </Badge>
          )}
          {c.account_type && <span className="text-xs text-muted">{c.account_type === 'MEDIA_CREATOR' ? 'Creator account' : 'Business account'}</span>}
        </div>
        <Button type="button" variant="ghost" size="sm" loading={sync.isPending} onClick={() => sync.mutate(c.id)}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      {mismatch && (
        <p className="flex items-center gap-1.5 text-xs text-danger">
          <AlertTriangle className="size-3.5" aria-hidden /> The form says {typedHandle}, but the connected account is @{c.username}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Followers" value={c.followers_count != null ? formatCompact(c.followers_count) : dash} />
        <Stat label="Posts" value={c.media_count != null ? formatNumber(c.media_count) : dash} />
        <Stat
          label="Avg views"
          value={s.avg_views != null ? formatCompact(s.avg_views) : dash}
          note={s.views_sample ? `over ${s.views_sample} post${s.views_sample === 1 ? '' : 's'}` : 'not available'}
        />
        <Stat
          label="Engagement"
          value={s.engagement_rate != null ? `${s.engagement_rate}%` : dash}
          note={s.engagement_sample ? `over ${s.engagement_sample} post${s.engagement_sample === 1 ? '' : 's'}` : 'not available'}
        />
      </div>

      {s.top_media && s.top_media.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Top content</p>
          <ul className="space-y-1 text-sm">
            {s.top_media.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3">
                <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  {m.media_product_type === 'REELS' ? 'Reel' : 'Post'}
                  {m.timestamp ? ` · ${formatDate(m.timestamp)}` : ''}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
                <span className="text-xs text-muted tabular-nums">
                  {[m.views != null ? `${formatCompact(m.views)} views` : null, m.likes != null ? `${formatCompact(m.likes)} likes` : null].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-faint">
        Connected {formatDate(c.connected_at)}
        {c.last_synced_at ? ` · last read ${formatRelative(c.last_synced_at)}` : ''}
        {c.permissions.includes('instagram_business_manage_insights') ? '' : ' · insights not granted'}
        {c.last_error ? ` · ${c.last_error}` : ''}
      </p>
    </div>
  )
}
