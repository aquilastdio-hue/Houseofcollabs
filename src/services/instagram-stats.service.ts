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
  /** Our own copy of the thumbnail; null when it couldn't be copied. */
  image: string | null
  is_reel: boolean
  likes: number | null
  comments: number | null
  views: number | null
  posted_at: string | null
  caption: string | null
}

/** Everything except the Instagram username: profiles show the numbers, never the handle. */
const STATS_COLUMNS =
  'creator_id, status, followers_count, follows_count, posts_count, is_verified, profile_pic_url, avg_likes, avg_comments, engagement_rate, avg_reel_views, posts_sampled, reels_sampled, recent_posts, last_error, fetched_at, updated_at'

export type InstagramStats = Omit<Tables<'creator_instagram_stats'>, 'recent_posts' | 'username'> & { recent_posts: InstagramPost[] }

export async function getInstagramStats(creatorId: string): Promise<InstagramStats | null> {
  const row = unwrap(await supabase.from('creator_instagram_stats').select(STATS_COLUMNS).eq('creator_id', creatorId).maybeSingle())
  if (!row) return null
  const posts = Array.isArray(row.recent_posts) ? (row.recent_posts as (InstagramPost & { url?: string })[]) : []
  // Post links lead straight to the account, so they're dropped here too.
  return { ...row, recent_posts: posts.map(({ url: _url, ...post }) => post) }
}

/** Admin: fetch one creator's numbers now (takes ~10–30 seconds). */
export function refreshInstagramStats(creatorId: string) {
  return invokeFunction<InstagramStats>('instagram-stats', { action: 'refresh', creator_id: creatorId })
}

/** Admin: start the weekly refresh for every live creator now. */
export function refreshAllInstagramStats() {
  return invokeFunction<{ started: boolean; profiles: number }>('instagram-stats', { action: 'refresh-all' })
}
