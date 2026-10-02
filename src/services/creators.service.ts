import type { QueryData } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { AppError, unwrap } from '@/lib/errors'
import { PAGE_SIZE } from '@/lib/constants'
import { ownerPath, uploadFile } from '@/lib/supabase/storage'
import { validateFile } from '@/lib/validation/files'
import type {
  CreatorCard,
  CreatorCompletion,
  Creator,
  CreatorStatus,
  PayoutMethodType,
  PublicReview,
  SocialAccount,
  TablesInsert,
  TablesUpdate,
} from '@/types'

/** Mirrors the `status` check on public.creator_verifications. */
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'more_info'

// ---------------------------------------------------------------------------
// Marketplace search (server-side filtering, sorting, pagination)
// ---------------------------------------------------------------------------
export type CreatorSearchParams = {
  q?: string
  category?: string
  city?: string
  state?: string
  minPrice?: number
  maxPrice?: number
  minFollowers?: number
  maxFollowers?: number
  maxDelivery?: number
  gender?: string
  minAge?: number
  maxAge?: number
  languages?: string[]
  creatorType?: string
  contentType?: string
  platform?: string
  verified?: boolean
  available?: boolean
  minRating?: number
  sort?: string
  page?: number
  pageSize?: number
}

export async function searchCreators(p: CreatorSearchParams): Promise<{ items: CreatorCard[]; total: number }> {
  const pageSize = p.pageSize ?? PAGE_SIZE
  const page = Math.max(1, p.page ?? 1)
  const data = unwrap(
    await supabase.rpc('search_creators', {
      p_query: p.q || undefined,
      p_category: p.category || undefined,
      p_city: p.city || undefined,
      p_state: p.state || undefined,
      p_min_price: p.minPrice,
      p_max_price: p.maxPrice,
      p_min_followers: p.minFollowers,
      p_max_followers: p.maxFollowers,
      p_max_delivery_days: p.maxDelivery,
      p_gender: p.gender || undefined,
      p_min_age: p.minAge,
      p_max_age: p.maxAge,
      p_languages: p.languages?.length ? p.languages : undefined,
      p_creator_type: p.creatorType || undefined,
      p_content_type: p.contentType || undefined,
      p_platform: p.platform || undefined,
      p_verified_only: p.verified || undefined,
      p_available_only: p.available || undefined,
      p_min_rating: p.minRating,
      p_sort: p.sort || 'relevance',
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
  )
  return { items: data ?? [], total: Number(data?.[0]?.total_count ?? 0) }
}

// ---------------------------------------------------------------------------
// Storefront (public profile) — RLS hides inactive services / hidden portfolio
// ---------------------------------------------------------------------------
/**
 * The storefront shows reach, not an address.
 *
 * `creator_social_accounts` is absent entirely. The page dropped the per-
 * platform chip -- the aggregate follower count on the creator row is the
 * number a brand is judging -- and with nothing left to render, fetching the
 * rows would only put handles and profile URLs in a payload anyone can read
 * from the network tab. Admin and the creator's own studio have their own
 * queries and keep them.
 *
 * Note this is a PostgREST select string parsed by supabase-js at the type
 * level -- it takes no comments, hence this one living out here.
 */
const PROFILE_SELECT = `
  *,
  creator_type_info:creator_types ( slug, name ),
  creator_categories ( is_primary, category:categories ( id, name, slug, icon, color ) ),
  creator_languages ( id, language ),
  creator_services ( *, service_addons ( * ) ),
  portfolio_items ( * )
`

/**
 * The owner's own view, which does include the handle: a creator has to be
 * able to read and edit the account they added. Only ever fetched for the
 * signed-in creator themselves.
 *
 * Written out in full rather than derived from PROFILE_SELECT, because
 * supabase-js parses this string at the type level and a value it cannot read
 * statically collapses the whole profile type to an error.
 */
const OWNER_PROFILE_SELECT = `
  *,
  creator_type_info:creator_types ( slug, name ),
  creator_categories ( is_primary, category:categories ( id, name, slug, icon, color ) ),
  creator_languages ( id, language ),
  creator_social_accounts ( id, platform, username, profile_url, followers_count, verified ),
  creator_services ( *, service_addons ( * ) ),
  portfolio_items ( * )
`

const profileQuery = () =>
  supabase
    .from('creators')
    .select(PROFILE_SELECT)
    .order('sort_order', { referencedTable: 'creator_services' })
    // Tiebreak. Ordering on sort_order alone meant that when every row shared
    // a value the grid fell back to physical row order, so simply updating a
    // service moved it on the storefront.
    .order('created_at', { referencedTable: 'creator_services' })
    .order('sort_order', { referencedTable: 'portfolio_items' })
    .order('created_at', { referencedTable: 'portfolio_items' })

export type CreatorProfile = QueryData<ReturnType<typeof profileQuery>>[number]
export type CreatorProfileService = CreatorProfile['creator_services'][number]

function normalizeProfile(p: CreatorProfile): CreatorProfile {
  // Hide archived/inactive services from storefront rendering even for owners previewing.
  return {
    ...p,
    creator_services: p.creator_services
      .filter((s) => !s.archived_at)
      .map((s) => ({ ...s, service_addons: [...s.service_addons].sort((a, b) => a.sort_order - b.sort_order) })),
  }
}

export async function getCreatorBySlug(slug: string): Promise<CreatorProfile | null> {
  const data = unwrap(await profileQuery().eq('slug', slug).maybeSingle())
  return data ? normalizeProfile(data) : null
}

export async function getCreatorById(id: string): Promise<CreatorProfile | null> {
  const data = unwrap(await profileQuery().eq('id', id).maybeSingle())
  return data ? normalizeProfile(data) : null
}

export async function getCreatorsByIds(ids: string[]): Promise<CreatorProfile[]> {
  if (ids.length === 0) return []
  const data = unwrap(await profileQuery().in('id', ids))
  return data.map(normalizeProfile).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
}

export async function getCreatorReviews(creatorId: string, page = 1, pageSize = 6): Promise<{ items: PublicReview[]; total: number }> {
  const data = unwrap(
    await supabase.rpc('get_creator_reviews', { p_creator_id: creatorId, p_limit: pageSize, p_offset: (page - 1) * pageSize }),
  )
  return { items: data ?? [], total: Number(data?.[0]?.total_count ?? 0) }
}

export async function recordProfileView(creatorId: string) {
  const key = `house-of-collabs:viewed:${creatorId}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    // storage unavailable — still record
  }
  await supabase.rpc('record_profile_view', { p_creator_id: creatorId })
}

// ---------------------------------------------------------------------------
// Owner (creator) editing
// ---------------------------------------------------------------------------
const ownerProfileQuery = () =>
  supabase
    .from('creators')
    .select(OWNER_PROFILE_SELECT)
    .order('sort_order', { referencedTable: 'creator_services' })
    // Tiebreak. Ordering on sort_order alone meant that when every row shared
    // a value the grid fell back to physical row order, so simply updating a
    // service moved it on the storefront.
    .order('created_at', { referencedTable: 'creator_services' })
    .order('sort_order', { referencedTable: 'portfolio_items' })
    .order('created_at', { referencedTable: 'portfolio_items' })

export type CreatorOwnProfile = QueryData<ReturnType<typeof ownerProfileQuery>>[number]

export async function getMyCreator(userId: string): Promise<CreatorOwnProfile | null> {
  return unwrap(await ownerProfileQuery().eq('profile_id', userId).maybeSingle())
}

export type CreatorEditable = Pick<
  TablesUpdate<'creators'>,
  | 'display_name' | 'slug' | 'headline' | 'bio' | 'profile_image_url' | 'cover_image_url' | 'intro_video_url'
  | 'gender' | 'age' | 'city' | 'state' | 'country' | 'creator_type' | 'engagement_rate' | 'available'
  | 'response_time' | 'onboarding_step'
>

export async function createMyCreator(userId: string, values: CreatorEditable & { display_name: string }): Promise<Creator> {
  const insert: TablesInsert<'creators'> = { ...values, profile_id: userId, slug: values.slug ?? '' }
  return unwrap(await supabase.from('creators').insert(insert).select('*').single())
}

export async function updateMyCreator(creatorId: string, patch: CreatorEditable): Promise<Creator> {
  return unwrap(await supabase.from('creators').update(patch).eq('id', creatorId).select('*').single())
}

export async function setCreatorCategories(categoryIds: string[], primaryId?: string) {
  unwrap(await supabase.rpc('set_creator_categories', { p_category_ids: categoryIds, p_primary_id: primaryId }))
}

export async function setCreatorLanguages(languages: string[]) {
  unwrap(await supabase.rpc('set_creator_languages', { p_languages: languages }))
}

export type SocialInput = Pick<SocialAccount, 'platform' | 'username' | 'profile_url' | 'followers_count'>

export async function addSocialAccount(creatorId: string, input: SocialInput) {
  return unwrap(await supabase.from('creator_social_accounts').insert({ ...input, creator_id: creatorId }).select('*').single())
}

export async function updateSocialAccount(id: string, input: Partial<SocialInput>) {
  return unwrap(await supabase.from('creator_social_accounts').update(input).eq('id', id).select('*').single())
}

export async function deleteSocialAccount(id: string) {
  unwrap(await supabase.from('creator_social_accounts').delete().eq('id', id))
}

export async function getCompletion(): Promise<CreatorCompletion> {
  return unwrap(await supabase.rpc('get_creator_completion')) as unknown as CreatorCompletion
}

export async function publishProfile(): Promise<Creator> {
  return unwrap(await supabase.rpc('publish_creator_profile'))
}

export async function respondToReview(reviewId: string, response: string) {
  return unwrap(await supabase.rpc('respond_to_review', { p_review_id: reviewId, p_response: response }))
}

// ---------------------------------------------------------------------------
// Progressive collection
// ---------------------------------------------------------------------------
// One read of everything a feature gate might need. Signup stays short; these
// facts decide what to ask for later, at the moment a creator reaches for a
// feature. The shape mirrors `public.get_creator_requirements()`.
export type CreatorRequirements = {
  creator_id: string | null
  status: CreatorStatus
  verified: boolean
  available: boolean
  completion: CreatorCompletion
  services: { total: number; active: number }
  addons: { active: number }
  portfolio: { visible: number }
  /** Whether a payout method exists and which kind — never the account itself. */
  payout: { configured: boolean; method_type: PayoutMethodType | null }
  verification: {
    id?: string
    status: VerificationStatus | null
    submitted_at?: string
    reviewed_at?: string | null
    review_note?: string | null
  }
  analytics: { accounts: number; followers: number; engagement_rate: number | null }
}

export async function getRequirements(): Promise<CreatorRequirements> {
  return unwrap(await supabase.rpc('get_creator_requirements')) as unknown as CreatorRequirements
}

export type VerificationInput = {
  legal_name: string
  document_type?: string | null
  /** Last four characters only — the full number is never sent or stored. */
  document_number_last4?: string | null
  document_path?: string | null
  date_of_birth?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  note?: string | null
}

export async function requestVerification(input: VerificationInput) {
  return unwrap(
    await supabase.rpc('request_creator_verification', {
      p_legal_name: input.legal_name,
      p_document_type: input.document_type || undefined,
      p_document_number_last4: input.document_number_last4 || undefined,
      p_document_path: input.document_path || undefined,
      p_date_of_birth: input.date_of_birth || undefined,
      p_address_line: input.address_line || undefined,
      p_city: input.city || undefined,
      p_state: input.state || undefined,
      p_postal_code: input.postal_code || undefined,
      p_note: input.note || undefined,
    }),
  )
}

/** Uploads an ID document to the private bucket and returns its path (never a URL). */
export async function uploadVerificationDocument(creatorId: string, file: File): Promise<string> {
  const problem = validateFile('verification-documents', file)
  if (problem) throw new AppError(problem, { kind: 'validation', code: 'INVALID_FILE' })
  const uploaded = await uploadFile('verification-documents', ownerPath(creatorId, file.name), file)
  return uploaded.path
}

export async function listMyVerifications() {
  return unwrap(
    await supabase
      .from('creator_verifications')
      .select('id, status, legal_name, document_type, document_number_last4, submitted_at, reviewed_at, review_note')
      .order('submitted_at', { ascending: false }),
  )
}
