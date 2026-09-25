import * as React from 'react'
import { Link, useLocation } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { Eye, TriangleAlert, UserX } from 'lucide-react'
import { range, truncate } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { siteUrl } from '@/config/site'
import { recordProfileView, type CreatorProfile } from '@/services/creators.service'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Seo } from '@/components/shared/seo'
import { CreatorActionCard, CreatorMobileBar, CreatorQuickActions, useCreatorAccess } from './creator-actions'
import { CreatorProfileHero } from './creator-profile-hero'
import { AboutSection, PortfolioSection, ProfileSectionNav, ServicesSection } from './creator-profile-sections'
import { ReviewsSection } from './creator-reviews'
import {
  PROFILE_SECTIONS,
  firstName,
  profileCategories,
  safeExternalUrl,
  scrollToSection,
  visiblePortfolio,
  visibleServices,
  type ProfileMode,
} from './profile-utils'

/**
 * Loading / error / not-found / content for a creator profile query. Shared by
 * the public storefront (`/creators/:slug`) and the brand app (`/brand/creators/:id`).
 */
export function CreatorProfileScreen({ mode, query }: { mode: ProfileMode; query: UseQueryResult<CreatorProfile | null> }) {
  if (query.isPending) {
    return (
      <>
        <Seo title="Creator" noindex={mode === 'brand'} />
        <CreatorProfileSkeleton />
      </>
    )
  }
  if (query.isError) {
    const kind = toAppError(query.error).kind
    // A malformed id/slug is simply "not found".
    if (kind !== 'not_found' && kind !== 'validation') {
      return (
        <>
          <Seo title="Creator" noindex />
          <h1 className="sr-only">Creator profile</h1>
          <ErrorState error={query.error} title="We couldn’t load this creator" onRetry={() => void query.refetch()} />
        </>
      )
    }
  }
  if (!query.data) return <CreatorUnavailable mode={mode} />
  return <CreatorProfileView key={query.data.id} mode={mode} creator={query.data} />
}

export function CreatorUnavailable({ mode }: { mode: ProfileMode }) {
  const back = mode === 'brand' ? { href: '/brand/creators', label: 'Back to creators' } : { href: '/discover', label: 'Browse creators' }
  return (
    <div className="py-10">
      <Seo title="Creator not available" noindex />
      <h1 className="sr-only">Creator not available</h1>
      <EmptyState
        icon={<UserX />}
        title="This creator isn’t available"
        description="The profile may have been unpublished, or the link might be mistyped."
        action={
          <Button asChild>
            <Link to={back.href}>{back.label}</Link>
          </Button>
        }
      />
    </div>
  )
}

export function CreatorProfileSkeleton() {
  return (
    <div className="flex flex-col" aria-busy>
      <p role="status" className="sr-only">
        Loading creator profile…
      </p>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-40 w-full rounded-hero sm:h-56 lg:h-72" />
      <div className="-mt-12 flex flex-col gap-4 px-1 sm:-mt-14 sm:flex-row sm:items-start sm:gap-5 sm:px-5">
        <Skeleton className="size-24 shrink-0 rounded-full bg-muted-surface ring-4 ring-canvas" />
        <div className="w-full max-w-md space-y-2 sm:pt-16">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {range(4).map((i) => (
          <Skeleton key={i} className="h-19 rounded-card" />
        ))}
      </div>
      <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Skeleton className="h-11 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {range(6).map((i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-card" />
            ))}
          </div>
        </div>
        <Skeleton className="hidden h-96 rounded-panel lg:block" />
      </div>
    </div>
  )
}

function ProfileSeo({ creator, mode }: { creator: CreatorProfile; mode: ProfileMode }) {
  if (mode === 'brand') return <Seo title={creator.display_name} noindex />
  const primary = profileCategories(creator)[0]
  const role = primary ? `${primary.name} creator` : 'Creator'
  const title = `${creator.display_name} — ${role}${creator.city ? ` in ${creator.city}` : ''}`
  const description = truncate(
    (creator.headline || creator.bio || `Hire ${creator.display_name} on House of Collabs — fixed prices, clear delivery times and secure payments.`).replace(/\s+/g, ' ').trim(),
    160,
  )
  const sameAs = creator.creator_social_accounts.map((s) => safeExternalUrl(s.profile_url)).filter((u): u is string => !!u)
  return (
    <Seo
      title={title}
      description={description}
      image={creator.profile_image_url}
      type="profile"
      canonical={`/creators/${creator.slug}`}
      jsonLd={{
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url: siteUrl(`/creators/${creator.slug}`),
        mainEntity: {
          '@type': 'Person',
          name: creator.display_name,
          description,
          image: creator.profile_image_url ?? undefined,
          address: {
            '@type': 'PostalAddress',
            addressLocality: creator.city ?? undefined,
            addressRegion: creator.state ?? undefined,
            addressCountry: creator.country,
          },
          sameAs: sameAs.length > 0 ? sameAs : undefined,
        },
      }}
    />
  )
}

export function CreatorProfileView({ mode, creator }: { mode: ProfileMode; creator: CreatorProfile }) {
  const access = useCreatorAccess(creator)
  const { hash } = useLocation()
  const primary = profileCategories(creator)[0]

  React.useEffect(() => {
    recordProfileView(creator.id).catch(() => undefined)
  }, [creator.id])

  // Deep links such as `/brand/creators/:id#services` (the compare page's Hire button).
  React.useEffect(() => {
    const id = decodeURIComponent(hash.slice(1))
    if (!(PROFILE_SECTIONS as readonly string[]).includes(id)) return
    const frame = window.requestAnimationFrame(() => scrollToSection(id))
    return () => window.cancelAnimationFrame(frame)
  }, [hash])

  const crumbs =
    mode === 'brand'
      ? [{ label: 'Creators', href: '/brand/creators' }, { label: creator.display_name }]
      : [
          { label: 'Discover', href: '/discover' },
          ...(primary ? [{ label: primary.name, href: `/categories/${primary.slug}` }] : []),
          { label: creator.display_name },
        ]

  const sections = [
    { id: 'portfolio' as const, label: 'Portfolio', count: visiblePortfolio(creator).length },
    { id: 'services' as const, label: 'Services', count: visibleServices(creator, access.isOwner).length },
    { id: 'about' as const, label: 'About' },
    { id: 'reviews' as const, label: 'Reviews', count: creator.review_count },
  ]

  return (
    <article className="flex flex-col">
      <ProfileSeo creator={creator} mode={mode} />
      <Breadcrumb items={crumbs} />

      {access.isOwner && (
        <div className="mb-5 flex flex-col gap-3 rounded-card border border-line bg-brand-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-ink-soft">
            <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
            {access.listed ? 'This is how brands see your storefront.' : 'Preview — brands will see your storefront like this once it’s published.'}
          </p>
          <Button asChild size="sm" variant="secondary">
            <Link to="/creator/profile">Edit profile</Link>
          </Button>
        </div>
      )}
      {!access.listed && !access.isOwner && (
        <p className="mb-5 flex items-start gap-2 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {firstName(creator.display_name)}’s storefront isn’t live right now. Your existing orders and messages are still available.
        </p>
      )}

      <CreatorProfileHero creator={creator} mode={mode} actions={<CreatorQuickActions creator={creator} />} />

      <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <ProfileSectionNav items={sections} />
          <div className="space-y-16">
            <PortfolioSection creator={creator} />
            <ServicesSection creator={creator} />
            <AboutSection creator={creator} />
            <ReviewsSection creator={creator} />
          </div>
        </div>
        <aside aria-label={`Hire ${creator.display_name}`} className="hidden lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:block">
          <CreatorActionCard creator={creator} />
        </aside>
      </div>

      <CreatorMobileBar creator={creator} mode={mode} />
    </article>
  )
}
