import type { CreatorProfile } from '@/services/creators.service'

export type ProfileMode = 'brand' | 'public'

export const PROFILE_SECTIONS = ['portfolio', 'services', 'about', 'reviews'] as const
export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]

/** Categories with the primary one first. */
export function profileCategories(creator: CreatorProfile) {
  return [...creator.creator_categories]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .flatMap((cc) => (cc.category ? [{ ...cc.category, is_primary: cc.is_primary }] : []))
}

export function profileLanguages(creator: CreatorProfile) {
  return creator.creator_languages.map((l) => l.language)
}

export function visiblePortfolio(creator: CreatorProfile) {
  return creator.portfolio_items.filter((p) => !p.is_hidden)
}

/** Non-owners only ever see bookable services (RLS may still return paused ones to past clients). */
export function visibleServices(creator: CreatorProfile, isOwner: boolean) {
  return creator.creator_services.filter((s) => isOwner || s.active)
}

// `coverImageOf` lived here to pick a banner for the storefront. No creator has
// ever set a cover image, so it only ever cropped a portfolio photo into a
// letterbox; the profile now opens on the avatar and the name, and the helper
// has no caller left.

/** Published storefronts can be hired, messaged and saved. */
export function isListed(creator: CreatorProfile) {
  return creator.status === 'published' && !creator.deleted_at
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name
}

/** Only link out to http(s) URLs. */
export function safeExternalUrl(url?: string | null) {
  return url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null
}

// `handleOf` lived here to format a creator's @handle for the storefront. The
// storefront no longer shows one, the public query no longer fetches the
// column, and RLS no longer serves it to anyone but the creator and staff — so
// the helper had no caller left. Admin formats its own, next to the link it
// still needs for verification.

/**
 * Where an unsigned visitor goes when they try to hire. Accounts aren't
 * self-serve any more — new brands apply through /get-started — so this points
 * at the login screen, keeping `redirect` so they land back on what they were
 * doing.
 */
export function signInHref(redirect: string) {
  return `/login?redirect=${encodeURIComponent(redirect)}`
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  el.querySelector<HTMLElement>('[data-section-heading]')?.focus({ preventScroll: true })
}
