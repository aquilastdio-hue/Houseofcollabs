import { supabase } from '@/lib/supabase/client'
import { unwrap } from '@/lib/errors'
import { invokeFunction } from '@/lib/supabase/functions'
import type { Tables } from '@/types/database.types'

/**
 * Public Instagram numbers per creator, written weekly by the `instagram-stats`
 * Edge Function (Apify). Readable by anyone for live creators; only the
 * function writes.
 */

export type InstagramPost = {
  short_code: string
  url: string
  /** Our own copy of the thumbnail; null when it couldn't be copied. */
  image: string | null
  is_reel: boolean
  likes: number | null
  comments: number | null
  views: number | null
  posted_at: string | null
  caption: string | null
}

export type InstagramStats = Omit<Tables<'creator_instagram_stats'>, 'recent_posts'> & { recent_posts: InstagramPost[] }

export async function getInstagramStats(creatorId: string): Promise<InstagramStats | null> {
  const row = unwrap(await supabase.from('creator_instagram_stats').select('*').eq('creator_id', creatorId).maybeSingle())
  if (!row) return null
  return { ...row, recent_posts: Array.isArray(row.recent_posts) ? (row.recent_posts as InstagramPost[]) : [] }
}

/** Admin: fetch one creator's numbers now (takes ~10–30 seconds). */
export function refreshInstagramStats(creatorId: string) {
  return invokeFunction<InstagramStats>('instagram-stats', { action: 'refresh', creator_id: creatorId })
}

/** Admin: start the weekly refresh for every live creator now. */
export function refreshAllInstagramStats() {
  return invokeFunction<{ started: boolean; profiles: number }>('instagram-stats', { action: 'refresh-all' })
}
