// Turns one item from Apify's Instagram Profile Scraper (apify/instagram-profile-scraper)
// into the row stored in public.creator_instagram_stats. Pure: no Deno, no
// network — the Edge Function does the fetching and image mirroring.
//
// Public numbers only. Instagram hides like counts on some posts; Apify then
// reports -1 or nothing, and those posts are left out of the averages rather
// than counted as zero.

export const RECENT_POSTS_SHOWN = 6

export type ApifyPost = {
  type?: string
  shortCode?: string
  url?: string
  displayUrl?: string
  likesCount?: number | null
  commentsCount?: number | null
  videoViewCount?: number | null
  videoPlayCount?: number | null
  timestamp?: string
  caption?: string | null
  productType?: string
  isPinned?: boolean
}

export type ApifyProfile = {
  username?: string
  followersCount?: number | null
  followsCount?: number | null
  postsCount?: number | null
  verified?: boolean
  private?: boolean
  profilePicUrl?: string
  profilePicUrlHD?: string
  latestPosts?: ApifyPost[]
  error?: string
  errorDescription?: string
}

export type RecentPost = {
  short_code: string
  url: string
  /** Instagram CDN link until the function swaps in its own copy. */
  image: string | null
  is_reel: boolean
  likes: number | null
  comments: number | null
  views: number | null
  posted_at: string | null
  caption: string | null
}

export type StatsRow = {
  username: string
  status: 'ok' | 'private' | 'not_found' | 'error'
  followers_count: number | null
  follows_count: number | null
  posts_count: number | null
  is_verified: boolean | null
  profile_pic_url: string | null
  avg_likes: number | null
  avg_comments: number | null
  engagement_rate: number | null
  avg_reel_views: number | null
  posts_sampled: number
  reels_sampled: number
  recent_posts: RecentPost[]
  last_error: string | null
}

/** '@Name', 'name', 'https://instagram.com/name?igsh=…' → 'name' (mirrors private.normalize_instagram). */
export function normalizeHandle(raw: string | null | undefined): string | null {
  let v = (raw ?? '').trim().toLowerCase()
  if (/instagram\.com\//.test(v)) v = v.replace(/^.*instagram\.com\//, '')
  v = v.split('?')[0].split('/')[0].replace(/^@+/, '').replace(/\s/g, '')
  return v || null
}

const count = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null)

function mean(values: (number | null)[]): number | null {
  const xs = values.filter((v): v is number => v !== null)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

const round = (n: number | null, places = 0) => (n === null ? null : Math.round(n * 10 ** places) / 10 ** places)

export const isReel = (p: ApifyPost) => p.productType === 'clips' || (p.type === 'Video' && p.productType !== 'feed')

const views = (p: ApifyPost) => count(p.videoPlayCount) ?? count(p.videoViewCount)

function empty(username: string, status: StatsRow['status'], lastError: string | null = null): StatsRow {
  return {
    username,
    status,
    followers_count: null,
    follows_count: null,
    posts_count: null,
    is_verified: null,
    profile_pic_url: null,
    avg_likes: null,
    avg_comments: null,
    engagement_rate: null,
    avg_reel_views: null,
    posts_sampled: 0,
    reels_sampled: 0,
    recent_posts: [],
    last_error: lastError,
  }
}

/** A username Apify returned nothing for. */
export const notFoundRow = (username: string) => empty(username, 'not_found', 'Instagram profile not found.')

export function summarizeProfile(item: ApifyProfile, username = normalizeHandle(item.username) ?? ''): StatsRow {
  if (item.error) return empty(username, 'not_found', item.errorDescription ?? item.error)

  const base: StatsRow = {
    ...empty(username, item.private ? 'private' : 'ok'),
    followers_count: count(item.followersCount),
    follows_count: count(item.followsCount),
    posts_count: count(item.postsCount),
    is_verified: typeof item.verified === 'boolean' ? item.verified : null,
    profile_pic_url: item.profilePicUrlHD || item.profilePicUrl || null,
  }
  if (item.private) return base

  const posts = (item.latestPosts ?? []).filter((p) => p.shortCode)
  // Pinned posts are often old hits; they'd flatter every average.
  const unpinned = posts.filter((p) => !p.isPinned)
  const sample = unpinned.length ? unpinned : posts
  const reels = sample.filter(isReel)

  const avgLikes = mean(sample.map((p) => count(p.likesCount)))
  const avgComments = mean(sample.map((p) => count(p.commentsCount)))
  const followers = base.followers_count
  const engagement =
    followers && avgLikes !== null ? ((avgLikes + (avgComments ?? 0)) / followers) * 100 : null

  const recent = [...posts]
    .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
    .slice(0, RECENT_POSTS_SHOWN)
    .map<RecentPost>((p) => ({
      short_code: p.shortCode!,
      url: p.url || `https://www.instagram.com/p/${p.shortCode}/`,
      image: p.displayUrl || null,
      is_reel: isReel(p),
      likes: count(p.likesCount),
      comments: count(p.commentsCount),
      views: isReel(p) ? views(p) : null,
      posted_at: p.timestamp ?? null,
      caption: p.caption ? p.caption.slice(0, 140) : null,
    }))

  return {
    ...base,
    avg_likes: round(avgLikes),
    avg_comments: round(avgComments),
    engagement_rate: round(engagement, 2),
    avg_reel_views: round(mean(reels.map(views))),
    posts_sampled: sample.length,
    reels_sampled: reels.length,
    recent_posts: recent,
  }
}
