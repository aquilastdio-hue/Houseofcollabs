import { BadgeCheck, Package, Sparkles, Star, Truck } from 'lucide-react'
import { formatCompact, formatDate, formatDateTime, formatDays, formatINR, formatLocation, formatNumber, formatRelative, titleCase } from '@/lib/format'
import { ADDON_TYPES, CONTENT_TYPES, GENDERS, PLATFORMS, RESPONSE_TIMES, labelFor } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/states'
import type { AdminCreatorDetail } from '@/services/admin.service'
import { ACCOUNT_STATUS_META, CREATOR_STATUS_META, StatusBadge } from './admin-status'
import { DetailCard, DetailItem, DetailList, ExternalAnchor, IdText } from './detail'

export function CreatorBadges({ creator }: { creator: AdminCreatorDetail }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusBadge meta={CREATOR_STATUS_META} value={creator.status} />
      {creator.verified && (
        <Badge tone="sky">
          <BadgeCheck /> Verified
        </Badge>
      )}
      {creator.featured && (
        <Badge tone="brand-soft">
          <Sparkles /> Featured
        </Badge>
      )}
      {creator.deleted_at && <Badge tone="dark">Removed</Badge>}
      {creator.profile && creator.profile.status !== 'active' && (
        <Badge tone="danger" dot>
          Account {ACCOUNT_STATUS_META[creator.profile.status].label.toLowerCase()}
        </Badge>
      )}
      {!creator.available && <Badge tone="outline">Not taking orders</Badge>}
    </span>
  )
}

/** Avatar + name + key facts for the page header. */
export function CreatorIdentity({ creator }: { creator: AdminCreatorDetail }) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <Avatar src={creator.profile_image_url} name={creator.display_name} size="xl" />
      <div className="min-w-0">
        <h1 className="font-display text-display-sm font-semibold sm:text-display-md">{creator.display_name}</h1>
        <p className="mt-0.5 truncate text-sm text-muted">
          @{creator.slug}
          {creator.headline ? ` · ${creator.headline}` : ''}
        </p>
        <div className="mt-2">
          <CreatorBadges creator={creator} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-control bg-subtle px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function CreatorOverview({ creator: c }: { creator: AdminCreatorDetail }) {
  const contentTypes = (c.content_types ?? []).map((t) => labelFor(CONTENT_TYPES, t))
  return (
    <DetailCard title="Profile" description="What brands see on the storefront, plus internal review data.">
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Followers" value={formatCompact(c.followers_count)} />
        <Stat
          label="Rating"
          value={
            c.review_count > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Star className="size-4" fill="currentColor" strokeWidth={0} aria-hidden />
                {Number(c.rating).toFixed(1)}
              </span>
            ) : (
              '—'
            )
          }
        />
        <Stat label="Reviews" value={formatNumber(c.review_count)} />
        <Stat label="Completed" value={formatNumber(c.completed_orders)} />
        <Stat label="Profile views" value={formatCompact(c.profile_views)} />
        <Stat label="Wishlisted" value={formatNumber(c.wishlist_count)} />
      </div>
      {c.bio && <p className="mb-6 max-w-prose text-sm leading-relaxed whitespace-pre-line text-ink-soft">{c.bio}</p>}
      <DetailList>
        <DetailItem label="Creator type">{c.creator_type_info?.name ?? (c.creator_type ? titleCase(c.creator_type) : null)}</DetailItem>
        <DetailItem label="Location">{formatLocation(c.city, c.state, c.country)}</DetailItem>
        <DetailItem label="Gender · age">{[c.gender ? labelFor(GENDERS, c.gender) : null, c.age ? `${c.age} yrs` : null].filter(Boolean).join(' · ') || null}</DetailItem>
        <DetailItem label="Response time">{c.response_time ? labelFor(RESPONSE_TIMES, c.response_time) : null}</DetailItem>
        <DetailItem label="Starting price">{c.starting_price != null ? formatINR(c.starting_price) : null}</DetailItem>
        <DetailItem label="Fastest delivery">{c.fastest_delivery_days != null ? formatDays(c.fastest_delivery_days) : null}</DetailItem>
        <DetailItem label="Engagement rate">{c.engagement_rate != null ? `${Number(c.engagement_rate)}%` : null}</DetailItem>
        <DetailItem label="Accepting orders">{c.available ? 'Yes' : 'No'}</DetailItem>
        <DetailItem label="Content types" className="sm:col-span-2">
          {contentTypes.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {contentTypes.map((t) => (
                <Badge key={t} tone="outline" size="sm">
                  {t}
                </Badge>
              ))}
            </span>
          ) : null}
        </DetailItem>
        <DetailItem label="Onboarding">Step {c.onboarding_step} of 7</DetailItem>
        <DetailItem label="Created">{formatDateTime(c.created_at)}</DetailItem>
        <DetailItem label="Approved">{c.approved_at ? formatDateTime(c.approved_at) : null}</DetailItem>
        <DetailItem label="Published">{c.published_at ? formatDateTime(c.published_at) : null}</DetailItem>
        {c.deleted_at && <DetailItem label="Removed">{formatDateTime(c.deleted_at)}</DetailItem>}
        {c.rejection_reason && (
          <DetailItem label={c.status === 'rejected' ? 'Rejection reason' : 'Last moderation note'} className="sm:col-span-2">
            <span className="whitespace-pre-line">{c.rejection_reason}</span>
          </DetailItem>
        )}
        {/* Played inline: this is what the team watches before approving. */}
        <DetailItem label="Intro video" className="sm:col-span-2">
          {c.intro_video_url ? (
            <div className="space-y-2">
              <video src={c.intro_video_url} controls playsInline preload="metadata" className="max-h-72 w-full max-w-lg rounded-control bg-night" />
              <ExternalAnchor href={c.intro_video_url}>Open in a new tab</ExternalAnchor>
            </div>
          ) : (
            <span className="text-faint">Not uploaded</span>
          )}
        </DetailItem>
      </DetailList>
    </DetailCard>
  )
}

export function CreatorAccountCard({ creator: c }: { creator: AdminCreatorDetail }) {
  const p = c.profile
  return (
    <DetailCard title="Account" description="Login identity behind this storefront.">
      <DetailList className="sm:grid-cols-1">
        <DetailItem label="Email">{p?.email ? <a href={`mailto:${p.email}`} className="focus-ring rounded-sm underline decoration-ink/25 underline-offset-2 hover:decoration-ink">{p.email}</a> : null}</DetailItem>
        <DetailItem label="Full name">{p?.full_name}</DetailItem>
        <DetailItem label="Account status">{p ? <StatusBadge meta={ACCOUNT_STATUS_META} value={p.status} size="sm" /> : null}</DetailItem>
        <DetailItem label="Last seen">{p?.last_seen_at ? <span title={formatDateTime(p.last_seen_at)}>{formatRelative(p.last_seen_at)}</span> : 'Never'}</DetailItem>
        <DetailItem label="Signed up">{p ? formatDate(p.created_at) : null}</DetailItem>
        <DetailItem label="Creator id">
          <IdText value={c.id} />
        </DetailItem>
        <DetailItem label="Profile id">
          <IdText value={c.profile_id} />
        </DetailItem>
      </DetailList>
    </DetailCard>
  )
}

export function CreatorStorefront({ creator: c }: { creator: AdminCreatorDetail }) {
  const categories = [...(c.creator_categories ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
  const socials = c.creator_social_accounts ?? []
  const languages = c.creator_languages ?? []
  const services = [...(c.creator_services ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <>
      <DetailCard title="Storefront" description="Categories, languages and social accounts.">
        <DetailList>
          <DetailItem label="Categories" className="sm:col-span-2">
            {categories.length > 0 ? (
              <span className="flex flex-wrap gap-1.5">
                {categories.map((cc) =>
                  cc.category ? (
                    <Badge key={cc.category.id} tone={cc.is_primary ? 'dark' : 'neutral'} size="sm">
                      {cc.category.name}
                      {cc.is_primary && <span className="text-brand">· primary</span>}
                    </Badge>
                  ) : null,
                )}
              </span>
            ) : null}
          </DetailItem>
          <DetailItem label="Languages" className="sm:col-span-2">
            {languages.length > 0 ? languages.map((l) => l.language).join(', ') : null}
          </DetailItem>
        </DetailList>

        <h3 className="mt-6 mb-3 text-sm font-semibold">Social accounts</h3>
        {socials.length === 0 ? (
          <p className="text-sm text-muted">No social accounts connected.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {socials.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {labelFor(PLATFORMS, s.platform)} · @{s.username}
                    {s.verified && <BadgeCheck className="ml-1 inline size-4 text-sky" aria-label="Verified account" />}
                  </p>
                  {s.profile_url && <ExternalAnchor href={s.profile_url} className="text-xs">{s.profile_url}</ExternalAnchor>}
                </div>
                <span className="tabular-nums text-muted">{formatCompact(s.followers_count)} followers</span>
              </li>
            ))}
          </ul>
        )}
      </DetailCard>

      <DetailCard title="Services" description={`${services.length} service${services.length === 1 ? '' : 's'} with their add-ons.`}>
        {services.length === 0 ? (
          <EmptyState compact icon={<Package />} title="No services yet" description="The creator hasn’t added any packages." />
        ) : (
          <ul className="space-y-3">
            {services.map((s) => {
              const addons = [...(s.service_addons ?? [])].sort((a, b) => a.sort_order - b.sort_order)
              return (
                <li key={s.id} className={cn('rounded-control border border-line p-4', (!s.active || s.archived_at) && 'bg-subtle/60')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{s.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {labelFor(CONTENT_TYPES, s.content_type)}
                        {s.platform ? ` · ${labelFor(PLATFORMS, s.platform)}` : ''} · {formatDays(s.delivery_days)} delivery · {s.revisions_included} revision
                        {s.revisions_included === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.requires_shipping && (
                        <Badge tone="outline" size="sm">
                          <Truck /> Product
                        </Badge>
                      )}
                      {s.archived_at ? (
                        <Badge size="sm">Archived</Badge>
                      ) : !s.active ? (
                        <Badge size="sm" tone="warning">
                          Paused
                        </Badge>
                      ) : null}
                      <span className="font-display text-lg font-semibold tabular-nums">{formatINR(s.price)}</span>
                    </div>
                  </div>
                  {s.description && <p className="mt-2 text-sm text-ink-soft">{s.description}</p>}
                  {(s.includes ?? []).length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {s.includes.map((inc) => (
                        <li key={inc}>
                          <Badge tone="neutral" size="sm">
                            {inc}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  {addons.length > 0 && (
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="mb-2 text-xs font-medium text-faint">Add-ons</p>
                      <ul className="space-y-1.5">
                        {addons.map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className={cn('min-w-0 truncate', !a.active && 'text-faint line-through')}>
                              {a.name} <span className="text-xs text-muted">· {labelFor(ADDON_TYPES, a.addon_type)}</span>
                            </span>
                            <span className="shrink-0 tabular-nums">+{formatINR(a.price)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </DetailCard>
    </>
  )
}
