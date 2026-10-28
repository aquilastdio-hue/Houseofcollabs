import { supabase } from '@/lib/supabase/client'
import { unwrap } from '@/lib/errors'
import type { Json } from '@/types/database.types'

/**
 * Campaigns: open calls a brand posts, an admin approves, and creators apply
 * to. Every read and write goes through database functions (migration 0019),
 * which check who is asking and shape the result for them.
 */

export type CampaignStatus = 'draft' | 'pending_review' | 'live' | 'rejected' | 'closed'
export type Compensation = 'paid' | 'barter' | 'both'
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

export type CampaignMatch = { category: boolean; followers: boolean; city: boolean; matches: boolean }

export type Campaign = {
  id: string
  brand_id: string
  title: string
  brief: string
  deliverables: string
  platforms: string[]
  reference_links: string[]
  compensation: Compensation
  fee_per_creator: number | null
  barter_details: string | null
  creators_needed: number
  category_ids: string[]
  min_followers: number | null
  max_followers: number | null
  cities: string[]
  apply_by: string | null
  status: CampaignStatus
  /** Why an admin sent it back. Never sent to creators. */
  review_note?: string | null
  submitted_at: string | null
  reviewed_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  brand: { id: string; name: string; logo: string | null; website: string | null }
  categories: { id: string; name: string }[]
  applications: { total: number; pending: number; accepted: number }
}

export type MyApplication = {
  id: string
  status: ApplicationStatus
  pitch: string
  proposed_fee: number | null
  sample_url: string | null
  brand_note: string | null
  created_at: string
}

/** A campaign as a creator sees it. */
export type CreatorCampaign = Campaign & {
  invited: boolean
  match: CampaignMatch | null
  my_application: MyApplication | null
  viewer?: 'creator'
}

export type InvitedCreator = { id: string; name: string; slug: string; photo: string | null; city: string | null; followers: number }

/** A campaign as its brand (or an admin) sees it. */
export type ManagedCampaign = Campaign & { viewer: 'brand' | 'admin'; invites: InvitedCreator[] }

export type CampaignApplicant = {
  id: string
  status: ApplicationStatus
  pitch: string
  proposed_fee: number | null
  sample_url: string | null
  brand_note: string | null
  created_at: string
  decided_at: string | null
  invited: boolean
  match: CampaignMatch | null
  creator: InvitedCreator & { categories: string[] }
}

/** What the brand's form sends. Numbers travel as numbers or null. */
export type CampaignInput = {
  title: string
  brief: string
  deliverables: string
  platforms: string[]
  reference_links: string[]
  compensation: Compensation
  fee_per_creator: number | null
  barter_details: string | null
  creators_needed: number
  category_ids: string[]
  min_followers: number | null
  max_followers: number | null
  cities: string[]
  apply_by: string | null
  invite_creator_ids: string[]
}

const as = <T>(data: unknown) => data as T

// ------------------------------------------------------------------ reads --

export async function listCreatorCampaigns(): Promise<CreatorCampaign[]> {
  return as<CreatorCampaign[]>(unwrap(await supabase.rpc('creator_campaigns')) ?? [])
}

export async function listBrandCampaigns(): Promise<Campaign[]> {
  return as<Campaign[]>(unwrap(await supabase.rpc('brand_campaigns')) ?? [])
}

export async function adminListCampaigns(status?: CampaignStatus | ''): Promise<Campaign[]> {
  return as<Campaign[]>(unwrap(await supabase.rpc('admin_list_campaigns', { p_status: status || undefined })) ?? [])
}

/** Shaped for the caller: `viewer` says whether it came back as creator, brand or admin. */
export async function getCampaign(id: string): Promise<CreatorCampaign | ManagedCampaign> {
  return as<CreatorCampaign | ManagedCampaign>(unwrap(await supabase.rpc('campaign_detail', { p_campaign_id: id })))
}

export async function listCampaignApplicants(id: string): Promise<CampaignApplicant[]> {
  return as<CampaignApplicant[]>(unwrap(await supabase.rpc('campaign_applicants', { p_campaign_id: id })) ?? [])
}

/** Live creators to invite, by name. Public storefront data only. */
export async function searchInvitableCreators(q: string): Promise<InvitedCreator[]> {
  const term = q.trim().replace(/[%_,()]/g, ' ')
  if (term.length < 2) return []
  const rows = unwrap(
    await supabase
      .from('creators')
      .select('id, display_name, slug, profile_image_url, city, followers_count')
      .eq('status', 'published')
      .is('deleted_at', null)
      .ilike('display_name', `%${term}%`)
      .order('followers_count', { ascending: false })
      .limit(12),
  )
  return (rows ?? []).map((r) => ({
    id: r.id,
    name: r.display_name,
    slug: r.slug,
    photo: r.profile_image_url,
    city: r.city,
    followers: r.followers_count,
  }))
}

// ----------------------------------------------------------- brand writes --

export async function saveCampaign(id: string | null, input: CampaignInput): Promise<string> {
  return unwrap(await supabase.rpc('save_campaign', { p_campaign_id: id, p_data: input as unknown as Json }))
}

export async function submitCampaign(id: string) {
  return unwrap(await supabase.rpc('submit_campaign', { p_campaign_id: id }))
}

export async function closeCampaign(id: string) {
  return unwrap(await supabase.rpc('close_campaign', { p_campaign_id: id }))
}

export async function deleteCampaign(id: string) {
  return unwrap(await supabase.rpc('delete_campaign', { p_campaign_id: id }))
}

export async function decideApplication(applicationId: string, accept: boolean, note?: string) {
  return unwrap(
    await supabase.rpc('decide_campaign_application', { p_application_id: applicationId, p_accept: accept, p_note: note || undefined }),
  )
}

// --------------------------------------------------------- creator writes --

export async function applyToCampaign(id: string, a: { pitch: string; proposed_fee: number | null; sample_url: string | null }) {
  return unwrap(
    await supabase.rpc('apply_to_campaign', {
      p_campaign_id: id,
      p_pitch: a.pitch,
      p_proposed_fee: a.proposed_fee ?? undefined,
      p_sample_url: a.sample_url ?? undefined,
    }),
  )
}

export async function withdrawApplication(id: string) {
  return unwrap(await supabase.rpc('withdraw_campaign_application', { p_campaign_id: id }))
}

// ------------------------------------------------------------ admin write --

export async function reviewCampaign(id: string, approve: boolean, note?: string) {
  return unwrap(await supabase.rpc('admin_review_campaign', { p_campaign_id: id, p_approve: approve, p_note: note || undefined }))
}
