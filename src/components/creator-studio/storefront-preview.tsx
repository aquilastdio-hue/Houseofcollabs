import { BadgeCheck, Clock3, Eye, Images, Languages, MapPin, Tags } from 'lucide-react'
import { cn } from '@/lib/utils'
import { siteUrl } from '@/config/site'
import { formatCompact, formatDays, formatINR, formatLocation } from '@/lib/format'
import { labelFor, RESPONSE_TIMES } from '@/lib/constants'
import type { CreatorProfile } from '@/services/creators.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { SmartImage } from '@/components/shared/smart-image'
import { ServiceCard } from '@/components/creator/service-card'
import { PortfolioGrid } from '@/components/creator/portfolio-grid'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-subtle px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function Placeholder({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <p className="flex items-center gap-2.5 rounded-card border border-dashed border-line-strong px-4 py-5 text-sm text-muted [&_svg]:size-4">
      {icon}
      {text}
    </p>
  )
}

/** Storefront-like rendering of the creator's own profile (what brands will see). */
export function StorefrontPreview({ creator, className }: { creator: CreatorProfile; className?: string }) {
  const categories = [...creator.creator_categories].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
  const services = creator.creator_services
    .filter((s) => !s.archived_at && s.active)
    .map((s) => ({ ...s, service_addons: [...s.service_addons].sort((a, b) => a.sort_order - b.sort_order) }))
  const portfolio = creator.portfolio_items.filter((p) => !p.is_hidden)
  const languages = creator.creator_languages.map((l) => l.language)
  const host = siteUrl(`/creators/${creator.slug}`).replace(/^https?:\/\//, '')

  return (
    <article className={cn('overflow-hidden rounded-panel border border-line bg-surface shadow-card', className)} aria-label="Storefront preview">
      <div className="flex items-center gap-2 border-b border-line bg-subtle px-4 py-2 text-xs text-muted">
        <Eye className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">Preview · {host}</span>
      </div>

      <div className="relative h-32 sm:h-48">
        <SmartImage
          src={creator.cover_image_url}
          alt=""
          className="absolute inset-0 size-full"
          fallback={<div className="size-full bg-gradient-to-br from-brand-soft via-sand-soft to-lilac-soft" />}
        />
      </div>

      <div className="px-5 pb-6 sm:px-8">
        <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Avatar src={creator.profile_image_url} name={creator.display_name} size="2xl" className="rounded-full ring-4 ring-surface" />
          <div className="flex flex-wrap gap-1.5 sm:justify-end">
            {creator.creator_type_info && (
              <Badge tone="dark" size="md">
                {creator.creator_type_info.name}
              </Badge>
            )}
            <Badge tone={creator.available ? 'success' : 'neutral'} size="md" dot>
              {creator.available ? 'Available' : 'Busy'}
            </Badge>
          </div>
        </div>

        <div className="mt-4">
          <h2 className="flex items-center gap-2 font-display text-display-sm font-semibold">
            <span className="min-w-0 break-words">{creator.display_name}</span>
            {creator.verified && <BadgeCheck className="size-5 shrink-0 fill-brand text-ink" aria-label="Verified" />}
          </h2>
          {creator.headline && <p className="mt-1 text-ink-soft">{creator.headline}</p>}
          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            <li className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {formatLocation(creator.city, creator.state, creator.country)}
            </li>
            {languages.length > 0 && (
              <li className="inline-flex items-center gap-1.5">
                <Languages className="size-4" aria-hidden /> {languages.join(', ')}
              </li>
            )}
            {creator.response_time && (
              <li className="inline-flex items-center gap-1.5">
                <Clock3 className="size-4" aria-hidden /> Replies {labelFor(RESPONSE_TIMES, creator.response_time).toLowerCase()}
              </li>
            )}
          </ul>
          {categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <Badge key={c.category.id} tone={c.is_primary ? 'brand-soft' : 'neutral'}>
                  {c.category.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Followers" value={formatCompact(creator.followers_count)} />
          <Stat label="Rating" value={creator.review_count > 0 ? Number(creator.rating).toFixed(1) : 'New'} />
          <Stat label="Fastest delivery" value={creator.fastest_delivery_days != null ? formatDays(creator.fastest_delivery_days) : '—'} />
          <Stat label="Starting at" value={creator.starting_price != null ? formatINR(creator.starting_price) : '—'} />
        </dl>

        {creator.bio ? (
          <p className="mt-5 max-w-prose leading-relaxed whitespace-pre-line text-ink-soft">{creator.bio}</p>
        ) : (
          <div className="mt-5">
            <Placeholder icon={<Tags />} text="Your bio will appear here." />
          </div>
        )}

      </div>

      <section className="border-t border-line px-5 py-6 sm:px-8" aria-label="Services">
        <h3 className="mb-4 font-display text-lg font-semibold tracking-tight">Services</h3>
        {services.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} addons={s.service_addons} />
            ))}
          </div>
        ) : (
          <Placeholder icon={<Tags />} text="No active services yet — brands need at least one to order from you." />
        )}
      </section>

      <section className="border-t border-line px-5 py-6 sm:px-8" aria-label="Portfolio">
        <h3 className="mb-4 font-display text-lg font-semibold tracking-tight">Portfolio</h3>
        {portfolio.length > 0 ? (
          <PortfolioGrid items={portfolio} columns="compact" />
        ) : (
          <Placeholder icon={<Images />} text="No portfolio pieces yet — add a few to show brands your style." />
        )}
      </section>
    </article>
  )
}
