import * as React from 'react'
import { Link } from 'react-router'
import { BadgeCheck, Clock3, GitCompareArrows, MapPin, Sparkles, Star, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact, formatDays, formatINR, formatLocation } from '@/lib/format'
import { isVideoUrl } from '@/utils/media'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SmartImage } from '@/components/shared/smart-image'
import { useCompare } from '@/contexts/compare-context'
import type { CategoryRef, CreatorCard as CreatorCardData, PortfolioPreview } from '@/types'
import { SaveButton } from './save-button'

export function isOnline(lastSeen?: string | null) {
  return !!lastSeen && Date.now() - new Date(lastSeen).getTime() < 5 * 60_000
}

/**
 * The still a card sits at, and the clip it plays when hovered.
 *
 * These are chosen separately on purpose. The still is simply the first
 * portfolio item, but the video used to be *also* the first item — so a card
 * played only when that first piece happened to be a video, and stayed frozen
 * for everyone whose portfolio opens with a photo. Of the creators published
 * today, most have no portfolio video at the front and every single one has an
 * intro video, so almost nothing ever moved.
 *
 * Now the clip is the first video anywhere in the preview, and the creator's
 * intro video if the portfolio has none.
 */
function coverOf(c: CreatorCardData) {
  const previews = (c.portfolio_preview as unknown as PortfolioPreview[]) ?? []
  const first = previews[0]
  const portfolioVideo = previews.find((p) => p.type === 'video')?.media_url ?? null
  const intro = c.intro_video_url && isVideoUrl(c.intro_video_url) ? c.intro_video_url : null
  const image = first ? (first.thumbnail_url ?? (first.type === 'image' ? first.media_url : null)) : (c.cover_image_url ?? c.profile_image_url)
  return { image, video: portfolioVideo ?? intro }
}

export function CreatorCard({
  creator,
  href,
  showCompare,
  className,
  priority,
}: {
  creator: CreatorCardData
  href: string
  showCompare?: boolean
  className?: string
  priority?: boolean
}) {
  const categories = (creator.categories as unknown as CategoryRef[]) ?? []
  const primary = categories.find((c) => c.is_primary) ?? categories[0]
  const cover = coverOf(creator)
  const [hovered, setHovered] = React.useState(false)
  const online = isOnline(creator.last_seen_at)

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-[box-shadow,transform,border-color] duration-300 ease-spring hover:-translate-y-1 hover:border-line-strong hover:shadow-card-hover',
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link to={href} className="focus-ring relative block aspect-[4/5] overflow-hidden rounded-t-card" aria-label={`View ${creator.display_name}`}>
        <SmartImage
          src={cover.image}
          alt=""
          eager={priority}
          className="absolute inset-0 size-full"
          imgClassName="transition-transform duration-700 ease-spring group-hover:scale-[1.04]"
          fallback={<div className="size-full bg-gradient-to-br from-brand-soft via-sand-soft to-lilac-soft" />}
        />
        {cover.video && hovered && (
          <video src={cover.video} className="absolute inset-0 size-full object-cover" autoPlay muted loop playsInline aria-hidden />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-night/80 via-night/30 to-transparent" />
        {/* No "Video" badge. It marked cards that had a clip to play, which
            was useful when only a few did; every creator has an intro video, so
            it appeared on all of them and told the viewer nothing. */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {creator.featured && (
            <Badge tone="brand" size="sm">
              <Sparkles /> Featured
            </Badge>
          )}
          {!creator.available && (
            <Badge tone="glass" size="sm">
              Busy
            </Badge>
          )}
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2.5 text-white">
          <Avatar src={creator.profile_image_url} name={creator.display_name} size="md" online={online} className="ring-2 ring-white/70 rounded-full" />
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate font-display text-[1.05rem] font-semibold leading-tight">
              <span className="truncate">{creator.display_name}</span>
              {creator.verified && <BadgeCheck className="size-4 shrink-0 fill-brand text-ink" aria-label="Verified" />}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-white/80">
              <MapPin className="size-3 shrink-0" /> {formatLocation(creator.city, creator.state)}
            </p>
          </div>
        </div>
      </Link>

      <div className="absolute top-3 right-3 flex flex-col gap-2">
        <SaveButton creatorId={creator.id} />
        {showCompare && <CompareToggle id={creator.id} name={creator.display_name} image={creator.profile_image_url} />}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {primary && (
            <Badge tone="brand-soft" size="sm">
              {primary.name}
            </Badge>
          )}
          {categories
            .filter((c) => c.id !== primary?.id)
            .slice(0, 1)
            .map((c) => (
              <Badge key={c.id} tone="neutral" size="sm">
                {c.name}
              </Badge>
            ))}
          {creator.languages.length > 0 && <span className="truncate text-xs text-muted">{creator.languages.slice(0, 3).join(' · ')}</span>}
        </div>
        {creator.headline && <p className="line-clamp-2 text-sm text-ink-soft">{creator.headline}</p>}
        {/* Two cards fit across a 375px phone, which leaves each about 166px.
            Three stats do not fit on one line there: the row either clipped
            the clock or dropped "2 d" onto a line of its own. `gap-x`/`gap-y`
            with wrapping lets it fall to two tidy lines instead, and the gap
            widens once there is room for all three side by side. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted sm:gap-x-4">
          <span className="inline-flex items-center gap-1 whitespace-nowrap" title="Followers">
            <Users className="size-3.5 shrink-0" /> <span className="font-medium text-ink">{formatCompact(creator.followers_count)}</span>
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap" title="Rating">
            <Star className="size-3.5 shrink-0 fill-ink text-ink" strokeWidth={0} />
            {creator.review_count > 0 ? (
              <>
                <span className="font-medium text-ink">{Number(creator.rating).toFixed(1)}</span>({creator.review_count})
              </>
            ) : (
              'New'
            )}
          </span>
          {creator.fastest_delivery_days != null && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap" title="Fastest delivery">
              <Clock3 className="size-3.5 shrink-0" /> {formatDays(creator.fastest_delivery_days)}
            </span>
          )}
        </div>
        <div className="mt-auto flex items-end justify-between border-t border-line pt-3">
          <div>
            <p className="text-xs text-muted">Starting at</p>
            <p className="font-display text-xl font-semibold tabular-nums">{creator.starting_price != null ? formatINR(creator.starting_price) : '—'}</p>
          </div>
          <Link
            to={href}
            className="focus-ring rounded-pill bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-soft"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  )
}

function CompareToggle({ id, name, image }: { id: string; name: string; image?: string | null }) {
  const { has, toggle } = useCompare()
  const active = has(id)
  return (
    <button
      type="button"
      onClick={() => toggle({ id, name, image })}
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from compare` : `Add ${name} to compare`}
      className={cn(
        'focus-ring flex size-9 items-center justify-center rounded-full shadow-card backdrop-blur-sm transition-colors',
        active ? 'bg-brand text-white' : 'bg-white/90 text-ink hover:bg-white',
      )}
    >
      <GitCompareArrows className="size-4" />
    </button>
  )
}

export function CreatorCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <Skeleton className="aspect-[4/5] rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}

export function CreatorGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  // Two columns from the smallest phone up. A single column meant one card
  // filled the screen and browsing 19 creators was 19 screens of scrolling —
  // the grid is for comparing people, which needs more than one on screen.
  // The gap tightens on narrow widths so two cards still have room to breathe.
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5', className)}>
      {children}
    </div>
  )
}
