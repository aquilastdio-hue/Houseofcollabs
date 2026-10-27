import { BarChart3, Clapperboard, ExternalLink, Eye, Heart, Instagram, Lock, MessageCircle } from 'lucide-react'
import { formatCompact, formatPercent, formatRelative } from '@/lib/format'
import { useInstagramStats } from '@/hooks/use-creators'
import type { InstagramPost, InstagramStats } from '@/services/instagram-stats.service'
import type { CreatorProfile } from '@/services/creators.service'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/states'
import { ProfileSection } from './creator-profile-sections'

/**
 * The "Stats" tab: the creator's public Instagram numbers, refreshed every
 * Sunday on the server. The tab is always there; until the first fetch (or
 * when Instagram couldn't be read) it says so rather than disappearing.
 */

/** Whether there are numbers to show, rather than the placeholder. */
export function hasInstagramStats(stats: InstagramStats | null | undefined): stats is InstagramStats {
  return !!stats && (stats.status === 'ok' || stats.status === 'private') && stats.followers_count !== null
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-faint">{hint}</dd>}
    </div>
  )
}

function PostTile({ post }: { post: InstagramPost }) {
  const label = `${post.is_reel ? 'Reel' : 'Post'} on Instagram${post.caption ? `: ${post.caption}` : ''}`
  return (
    <li>
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="focus-ring group relative block aspect-square overflow-hidden rounded-control bg-subtle"
      >
        {post.image ? (
          <img
            src={post.image}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-faint">
            <Instagram className="size-6" aria-hidden />
          </span>
        )}
        {post.is_reel && (
          <Clapperboard className="absolute top-2 right-2 size-4 text-white drop-shadow" aria-hidden />
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-linear-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-xs font-medium text-white tabular-nums">
          {post.is_reel && post.views !== null ? (
            <span className="flex items-center gap-1">
              <Eye className="size-3.5" aria-hidden /> {formatCompact(post.views)}
            </span>
          ) : null}
          {post.likes !== null && (
            <span className="flex items-center gap-1">
              <Heart className="size-3.5" aria-hidden /> {formatCompact(post.likes)}
            </span>
          )}
          {post.comments !== null && (
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3.5" aria-hidden /> {formatCompact(post.comments)}
            </span>
          )}
        </span>
      </a>
    </li>
  )
}

export function StatsSection({ creator }: { creator: CreatorProfile }) {
  const { data: stats, isPending } = useInstagramStats(creator.id)

  if (!hasInstagramStats(stats)) {
    return (
      <ProfileSection id="stats" title="Stats" description="Public Instagram numbers, updated every week.">
        {isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-card" />
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            icon={<BarChart3 />}
            title="Stats are on their way"
            description="Instagram numbers appear here after the next weekly update."
          />
        )}
      </ProfileSection>
    )
  }

  const profileUrl = `https://www.instagram.com/${stats.username}/`
  const sample = stats.posts_sampled
  return (
    <ProfileSection
      id="stats"
      title="Stats"
      description={
        <>
          Public Instagram numbers from{' '}
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            @{stats.username}
          </a>
          {stats.fetched_at ? ` · updated ${formatRelative(stats.fetched_at)}` : ''}
        </>
      }
      action={
        <Button asChild size="sm" variant="secondary">
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            <Instagram /> View on Instagram <ExternalLink className="size-3.5" />
          </a>
        </Button>
      }
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Followers" value={formatCompact(stats.followers_count)} />
        {stats.posts_count !== null && <Stat label="Posts" value={formatCompact(stats.posts_count)} />}
        {stats.engagement_rate !== null && (
          <Stat
            label="Engagement rate"
            value={formatPercent(Number(stats.engagement_rate), 2)}
            hint={`Likes + comments ÷ followers, last ${sample} posts`}
          />
        )}
        {stats.avg_reel_views !== null && (
          <Stat
            label="Avg. Reel views"
            value={formatCompact(Number(stats.avg_reel_views))}
            hint={`Last ${stats.reels_sampled} Reel${stats.reels_sampled === 1 ? '' : 's'}`}
          />
        )}
        {stats.avg_likes !== null && <Stat label="Avg. likes" value={formatCompact(Number(stats.avg_likes))} />}
        {stats.avg_comments !== null && <Stat label="Avg. comments" value={formatCompact(Number(stats.avg_comments))} />}
      </dl>

      {stats.status === 'private' ? (
        <p className="mt-5 flex items-center gap-2 rounded-card border border-line bg-subtle px-4 py-3 text-sm text-muted">
          <Lock className="size-4 shrink-0" aria-hidden /> This account is private, so posts and engagement aren’t shown.
        </p>
      ) : (
        stats.recent_posts.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold">Recent posts</h3>
            <ul className="grid grid-cols-3 gap-2 sm:gap-3">
              {stats.recent_posts.map((post) => (
                <PostTile key={post.short_code} post={post} />
              ))}
            </ul>
          </div>
        )
      )}
    </ProfileSection>
  )
}
