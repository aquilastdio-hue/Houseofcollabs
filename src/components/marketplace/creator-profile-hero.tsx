import * as React from 'react'
import { Link } from 'react-router'
import { BadgeCheck, Languages, MapPin, Timer, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact, formatDays, formatLocation, formatNumber } from '@/lib/format'
import { PLATFORMS, RESPONSE_TIMES, labelFor } from '@/lib/constants'
import type { CreatorProfile } from '@/services/creators.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { SmartImage } from '@/components/shared/smart-image'
import { RatingLabel } from '@/components/shared/star-rating'
import { CategoryIcon } from './category-icon'
import { PlatformIcon } from './platform-icon'
import { coverImageOf, handleOf, profileCategories, profileLanguages, safeExternalUrl, type ProfileMode } from './profile-utils'

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
  const socials = [...creator.creator_social_accounts].sort((a, b) => b.followers_count - a.followers_count)
  const response = labelFor(RESPONSE_TIMES, creator.response_time)
  const categoryHref = (slug: string) => (mode === 'brand' ? `/brand/creators?category=${encodeURIComponent(slug)}` : `/categories/${slug}`)

  return (
    <header className="flex flex-col">
      <div className="relative">
        <SmartImage
          src={coverImageOf(creator)}
          alt=""
          eager
          className="h-40 w-full rounded-hero sm:h-56 lg:h-72"
          fallback={<div className="size-full bg-gradient-to-br from-brand-soft via-sand-soft to-lilac-soft" />}
        />
        <div className="pointer-events-none absolute inset-0 rounded-hero bg-gradient-to-t from-night/25 via-transparent to-transparent" />
      </div>

      {/* The avatar overlaps the cover; the text column starts just below the cover edge. */}
      <div className="relative -mt-12 flex flex-col gap-4 px-1 sm:-mt-14 sm:flex-row sm:items-start sm:gap-5 sm:px-5">
        <Avatar src={creator.profile_image_url} name={creator.display_name} size="2xl" className="self-start rounded-full shadow-card ring-4 ring-canvas" />
        <div className="min-w-0 sm:pt-16">
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

      {socials.length > 0 && (
        <ul aria-label="Social accounts" className="mt-4 flex flex-wrap gap-2">
          {socials.map((s) => {
            const url = safeExternalUrl(s.profile_url)
            const platform = labelFor(PLATFORMS, s.platform)
            const inner = (
              <>
                <PlatformIcon platform={s.platform} />
                <span className="font-medium text-ink">{handleOf(s.username)}</span>
                <span className="text-muted">{formatCompact(s.followers_count)}</span>
                {s.verified && <BadgeCheck role="img" aria-label="Verified account" className="size-3.5 fill-brand text-ink" />}
              </>
            )
            const chip = 'inline-flex h-9 max-w-full items-center gap-2 rounded-pill border border-line bg-surface px-3.5 text-sm'
            return (
              <li key={s.id}>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={cn(chip, 'focus-ring transition-colors hover:border-line-strong')}>
                    {inner}
                    <span className="sr-only">
                      {' '}
                      on {platform}, {formatCompact(s.followers_count)} followers (opens in a new tab)
                    </span>
                  </a>
                ) : (
                  <span className={chip}>
                    {inner}
                    <span className="sr-only"> on {platform}</span>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {actions}
    </header>
  )
}
