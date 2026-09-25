import { supabase } from '@/lib/supabase/client'
import { unwrap } from '@/lib/errors'
import type { BrandDashboardStats, CreatorDashboardStats } from '@/types'

export async function getCreatorDashboardStats(): Promise<CreatorDashboardStats> {
  return unwrap(await supabase.rpc('get_creator_dashboard_stats')) as unknown as CreatorDashboardStats
}

export async function getBrandDashboardStats(): Promise<BrandDashboardStats> {
  return unwrap(await supabase.rpc('get_brand_dashboard_stats')) as unknown as BrandDashboardStats
}

/** Fire-and-forget: powers the brand's "creator searches" metric. */
export async function recordSearchEvent(query: string | undefined, filters: Record<string, unknown>, resultsCount: number) {
  try {
    await supabase.rpc('record_search_event', { p_query: query ?? '', p_filters: filters as never, p_results_count: resultsCount })
  } catch {
    // analytics must never break search
  }
}
