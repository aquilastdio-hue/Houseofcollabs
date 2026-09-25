import { supabase } from '@/lib/supabase/client'
import { unwrap } from '@/lib/errors'
import type { Category, CreatorTypeRow, PublicStats } from '@/types'

export async function listCategories(): Promise<Category[]> {
  return unwrap(await supabase.from('categories').select('*').eq('active', true).order('sort_order'))
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return unwrap(await supabase.from('categories').select('*').eq('slug', slug).maybeSingle())
}

export async function listCreatorTypes(): Promise<CreatorTypeRow[]> {
  return unwrap(await supabase.from('creator_types').select('*').eq('active', true).order('sort_order'))
}

export type PublicSettings = {
  platform_fee_percentage: number
  minimum_payout_amount: number
  require_creator_approval: boolean
  max_revisions: number
  earning_hold_days: number
  creator_response_hours: number
  auto_approve_days: number
  payment_expiry_hours: number
  cancellation_rules: string
  refund_rules: string
  support_email: string
}

export async function getPublicSettings(): Promise<Partial<PublicSettings>> {
  const rows = unwrap(await supabase.from('platform_settings').select('key, value').eq('is_public', true))
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<PublicSettings>
}

export async function getPublicStats(): Promise<PublicStats> {
  return unwrap(await supabase.rpc('get_public_stats')) as unknown as PublicStats
}
