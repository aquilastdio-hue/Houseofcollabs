import { parseSmartQuery, type SmartSearchFilters, type SmartSearchResult } from '@shared/smart-search-parser'
import { invokeFunction } from '@/lib/supabase/functions'
import type { CreatorSearchParams } from './creators.service'

export type { SmartSearchFilters, SmartSearchResult }

/**
 * Natural-language search → structured filters. Uses the `smart-search`
 * Edge Function (where an AI parser can be enabled server-side) with a short
 * timeout, falling back to the identical rule-based parser locally.
 */
export async function smartSearch(query: string): Promise<SmartSearchResult> {
  const trimmed = query.trim()
  if (!trimmed) return parseSmartQuery('')
  try {
    const remote = await Promise.race([
      invokeFunction<SmartSearchResult>('smart-search', { query: trimmed }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
    ])
    if (remote && typeof remote === 'object' && 'filters' in remote) return remote
  } catch {
    // fall through to local parsing
  }
  return parseSmartQuery(trimmed)
}

export function smartFiltersToParams(f: SmartSearchFilters): CreatorSearchParams {
  return {
    q: f.q,
    category: f.category,
    city: f.city,
    state: f.state,
    gender: f.gender,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    maxDelivery: f.maxDelivery,
    minFollowers: f.minFollowers,
    maxFollowers: f.maxFollowers,
    minAge: f.minAge,
    maxAge: f.maxAge,
    languages: f.languages,
    creatorType: f.creatorType,
    contentType: f.contentType,
    platform: f.platform,
    verified: f.verified,
    available: f.available,
    minRating: f.minRating,
    sort: f.sort,
  }
}
