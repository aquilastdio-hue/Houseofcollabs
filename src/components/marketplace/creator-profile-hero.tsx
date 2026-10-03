import * as React from 'react'
import { Link } from 'react-router'
import { BadgeCheck, Languages, MapPin, Timer, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact, formatDays, formatLocation, formatNumber } from '@/lib/format'
import { RESPONSE_TIMES, labelFor } from '@/lib/constants'
import type { CreatorProfile } from '@/services/creators.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { RatingLabel } from '@/components/shared/star-rating'
import { CategoryIcon } from './category-icon'
import { profileCategories, profileLanguages, type ProfileMode } from './profile-utils'

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold tabular-nums">{children}</dd>
    </div>
  )
}

export function CreatorProfileHero({ creator, mode, actions }: { creator: CreatorProfile; mode: ProfileMode; actions?: React.ReactNode }) {
  const categories = profileCategories(creator)
  const languages = profileLanguages(creator)
  const response = labelFor(RESPONSE_TIMES, creator.response_time)
  const categoryHref = (slug: string) => (mode === 'brand' ? `/brand/creators?category=${encodeURIComponent(slug)}` : `/categories/${slug}`)

  return (
    <header className="flex flex-col">
      {/* No cover banner. Not one creator has ever set `cover_image_url`, so it
          fell back to cropping a portfolio photo to a letterbox — which cut
          people off mid-torso and told a visitor nothing the portfolio below
          doesn't. The profile now opens on the person. */}
      <div className="flex flex-col gap-4 px-1 pt-2 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
        <Avatar src={creator.profile_image_url} name={creator.display_name} size="2xl" className="self-start rounded-full shadow-card ring-4 ring-canvas sm:self-center" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h1 className="font-display text-display-md font-semibold break-words">{creator.display_name}</h1>
            {creator.verified && <BadgeCheck role="img" aria-label="Verified creator" className="size-6 shrink-0 fill-brand text-ink" />}
            <Badge tone={creator.available ? 'success' : 'neutral'} dot>
              {creator.available ? 'Available' : 'Busy'}
            </Badge>
          </div>
          {creator.headline && <p className="mt-1 max-w-2xl text-ink-soft">{creator.headline}</p>}
          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <li className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {formatLocation(creator.city, creator.state, creator.country)}
            </li>
            {languages.length > 0 && (
              <li className="inline-flex items-center gap-1.5">
                <Languages className="size-4 shrink-0" aria-hidden />
                <span className="sr-only">Speaks </span>
                {languages.join(', ')}
              </li>
            )}
            {response && (
              <li className="inline-flex items-center gap-1.5">
                <Timer className="size-4 shrink-0" aria-hidden /> Replies {response.toLowerCase()}
              </li>
            )}
            {creator.creator_type_info && (
              <li className="inline-flex items-center gap-1.5">
                <UserRound className="size-4 shrink-0" aria-hidden /> {creator.creator_type_info.name}
              </li>
            )}
          </ul>
        </div>
      </div>

      {categories.length > 0 && (
        <ul aria-label="Categories" className="mt-5 flex flex-wrap gap-2 px-1 sm:px-5">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                to={categoryHref(c.slug)}
                className={cn(
                  'focus-ring inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-sm font-medium transition-colors',
                  c.is_primary ? 'bg-brand text-white hover:bg-brand-strong' : 'bg-subtle text-ink-soft hover:bg-muted-surface hover:text-ink',
                )}
              >
                <CategoryIcon icon={c.icon} className="size-3.5" />
                {c.name}
                {c.is_primary && <span className="sr-only"> (primary category)</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total followers">{formatCompact(creator.followers_count)}</Stat>
        <Stat label="Rating">
          {creator.review_count > 0 ? <RatingLabel rating={Number(creator.rating)} count={creator.review_count} className="text-xl" /> : 'New'}
        </Stat>
        <Stat label="Orders completed">{formatNumber(creator.completed_orders)}</Stat>
        <Stat label="Fastest delivery">{creator.fastest_delivery_days != null ? formatDays(creator.fastest_delivery_days) : '—'}</Stat>
      </dl>

      {actions}
    </header>
  )
}
