// Instagram API with Instagram Login — what the instagram-connect function
// needs, kept free of Deno globals so it can be unit-tested with vitest.
//
// Endpoints, scopes and metrics follow Meta's "Business Login for Instagram"
// and IG Media Insights references:
//   authorize   https://www.instagram.com/oauth/authorize
//   code→token  POST https://api.instagram.com/oauth/access_token  (short-lived, ~1h)
//   long-lived  GET  https://graph.instagram.com/access_token?grant_type=ig_exchange_token  (~60 days)
//   refresh     GET  https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token
//   profile     GET  https://graph.instagram.com/{v}/me?fields=…
//   media       GET  https://graph.instagram.com/{v}/me/media?fields=…
//   insights    GET  https://graph.instagram.com/{v}/{media-id}/insights?metric=…
//
// Nothing here invents numbers: a metric Instagram didn't return stays absent,
// and averages are over the posts that actually had it.

export const INSTAGRAM_SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights'] as const
export const DEFAULT_GRAPH_VERSION = 'v26.0'

/** Insights requested per post/Reel. All apply to FEED and REELS media; albums have none. */
export const MEDIA_INSIGHT_METRICS = ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'] as const
export type InsightMetric = (typeof MEDIA_INSIGHT_METRICS)[number]

/** How many recent posts get insights fetched — each one is a request. */
export const INSIGHTS_MEDIA_LIMIT = 12
export const MEDIA_LIMIT = 25

export type InstagramConfig = {
  appId: string
  appSecret: string
  /** Exact redirect URIs registered in the Meta App Dashboard; anything else is refused. */
  redirectUris: string[]
  /** base64 of 32 random bytes; encrypts tokens at rest. */
  tokenKey: string
  graphVersion: string
}

type FetchFn = typeof fetch

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
    public subcode?: number,
    public type?: string,
  ) {
    super(message)
    this.name = 'InstagramApiError'
  }
  /** Meta's code 190: the token is invalid, expired or revoked. */
  get tokenInvalid() {
    return this.code === 190
  }
}

// ------------------------------------------------------------------ helpers --

export function base64url(bytes: Uint8Array) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** CSRF state: 32 random bytes, URL-safe. */
export function randomState() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

/** Instagram appends `#_` to the redirect; it is not part of the code. */
export function cleanCode(code: string) {
  return code.replace(/#_$/, '').trim()
}

export function isProfessionalAccount(accountType: string | null | undefined) {
  const t = (accountType ?? '').toUpperCase()
  return t === 'BUSINESS' || t === 'MEDIA_CREATOR'
}

export function profileUrl(username: string) {
  return `https://www.instagram.com/${encodeURIComponent(username)}/`
}

async function igJson(fetchFn: FetchFn, url: string, init?: RequestInit) {
  const res = await fetchFn(url, init)
  let body: Record<string, unknown> = {}
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    // non-JSON error page — handled below
  }
  const err = body.error as { message?: string; code?: number; error_subcode?: number; type?: string } | string | undefined
  if (!res.ok || err) {
    if (typeof err === 'object' && err) {
      throw new InstagramApiError(err.message ?? 'Instagram API error', res.status, err.code, err.error_subcode, err.type)
    }
    // The OAuth endpoint answers with { error_type, code, error_message }.
    const message = (body.error_message as string | undefined) ?? (typeof err === 'string' ? err : undefined) ?? `Instagram API error (${res.status})`
    throw new InstagramApiError(message, res.status, typeof body.code === 'number' ? body.code : undefined, undefined, body.error_type as string | undefined)
  }
  return body
}

// ------------------------------------------------------------------- OAuth --

export function buildAuthorizeUrl(cfg: Pick<InstagramConfig, 'appId'>, opts: { state: string; redirectUri: string }) {
  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('client_id', cfg.appId)
  url.searchParams.set('redirect_uri', opts.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', INSTAGRAM_SCOPES.join(','))
  url.searchParams.set('state', opts.state)
  return url.toString()
}

/** Authorization code → short-lived token (about an hour). Server-side only: it carries the app secret. */
export async function exchangeCode(fetchFn: FetchFn, cfg: InstagramConfig, code: string, redirectUri: string) {
  const form = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code: cleanCode(code),
  })
  const body = await igJson(fetchFn, 'https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  // Documented as wrapped in a `data` array; accept the bare shape too.
  const row = (Array.isArray(body.data) ? body.data[0] : body) as { access_token?: string; user_id?: string | number; permissions?: string | string[] }
  if (!row?.access_token) throw new InstagramApiError('Instagram did not return an access token.', 502)
  const permissions = Array.isArray(row.permissions)
    ? row.permissions
    : String(row.permissions ?? '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
  return { accessToken: row.access_token, userId: String(row.user_id ?? ''), permissions }
}

/** Short-lived → long-lived token (about 60 days). */
export async function exchangeLongLived(fetchFn: FetchFn, cfg: InstagramConfig, shortToken: string) {
  const url = new URL('https://graph.instagram.com/access_token')
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', cfg.appSecret)
  url.searchParams.set('access_token', shortToken)
  const body = await igJson(fetchFn, url.toString())
  return { accessToken: String(body.access_token), expiresIn: Number(body.expires_in ?? 0) }
}

/** Extends a long-lived token by another ~60 days. It must be at least 24 hours old and still valid. */
export async function refreshLongLived(fetchFn: FetchFn, token: string) {
  const url = new URL('https://graph.instagram.com/refresh_access_token')
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', token)
  const body = await igJson(fetchFn, url.toString())
  return { accessToken: String(body.access_token), expiresIn: Number(body.expires_in ?? 0) }
}

// -------------------------------------------------------------------- data --

export type InstagramProfile = {
  user_id: string
  username: string
  name?: string
  account_type?: string
  profile_picture_url?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
}

export type InstagramMedia = {
  id: string
  caption?: string
  media_type?: string
  media_product_type?: string
  media_url?: string
  permalink?: string
  thumbnail_url?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
  insights?: Partial<Record<InsightMetric, number>>
}

const PROFILE_FIELDS = 'user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count'
const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count'

export async function fetchProfile(fetchFn: FetchFn, version: string, token: string): Promise<InstagramProfile> {
  const url = new URL(`https://graph.instagram.com/${version}/me`)
  url.searchParams.set('fields', PROFILE_FIELDS)
  url.searchParams.set('access_token', token)
  const body = await igJson(fetchFn, url.toString())
  return { ...(body as unknown as InstagramProfile), user_id: String(body.user_id ?? body.id ?? '') }
}

export async function fetchMedia(fetchFn: FetchFn, version: string, token: string, limit = MEDIA_LIMIT): Promise<InstagramMedia[]> {
  const url = new URL(`https://graph.instagram.com/${version}/me/media`)
  url.searchParams.set('fields', MEDIA_FIELDS)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('access_token', token)
  const body = await igJson(fetchFn, url.toString())
  return Array.isArray(body.data) ? (body.data as InstagramMedia[]) : []
}

/** Reads `values[0].value` or `total_value.value`, whichever Instagram used. */
export function parseInsights(body: Record<string, unknown>) {
  const out: Partial<Record<InsightMetric, number>> = {}
  for (const row of (Array.isArray(body.data) ? body.data : []) as { name?: string; values?: { value?: unknown }[]; total_value?: { value?: unknown } }[]) {
    const raw = row.values?.[0]?.value ?? row.total_value?.value
    if (row.name && typeof raw === 'number' && Number.isFinite(raw) && (MEDIA_INSIGHT_METRICS as readonly string[]).includes(row.name)) {
      out[row.name as InsightMetric] = raw
    }
  }
  return out
}

/**
 * Insights for one post or Reel. Albums have none. If Instagram refuses the
 * whole set (one metric unsupported for this media), each metric is asked for
 * on its own and the ones that work are kept; a token error is passed up.
 */
export async function fetchMediaInsights(fetchFn: FetchFn, version: string, token: string, media: InstagramMedia) {
  if (media.media_type === 'CAROUSEL_ALBUM') return {}
  const ask = async (metrics: readonly string[]) => {
    const url = new URL(`https://graph.instagram.com/${version}/${encodeURIComponent(media.id)}/insights`)
    url.searchParams.set('metric', metrics.join(','))
    url.searchParams.set('access_token', token)
    return parseInsights(await igJson(fetchFn, url.toString()))
  }
  try {
    return await ask(MEDIA_INSIGHT_METRICS)
  } catch (e) {
    if (e instanceof InstagramApiError && e.tokenInvalid) throw e
    const merged: Partial<Record<InsightMetric, number>> = {}
    for (const metric of MEDIA_INSIGHT_METRICS) {
      try {
        Object.assign(merged, await ask([metric]))
      } catch (inner) {
        if (inner instanceof InstagramApiError && inner.tokenInvalid) throw inner
      }
    }
    return merged
  }
}

/** Recent media plus whatever insights each one has. Insights are best-effort; the media list is not. */
export async function fetchMediaWithInsights(fetchFn: FetchFn, version: string, token: string, withInsights: boolean) {
  const media = await fetchMedia(fetchFn, version, token)
  if (!withInsights) return media
  const out: InstagramMedia[] = []
  for (const [i, m] of media.entries()) {
    out.push(i < INSIGHTS_MEDIA_LIMIT ? { ...m, insights: await fetchMediaInsights(fetchFn, version, token, m) } : m)
  }
  return out
}

// ------------------------------------------------------------------- stats --

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null)
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export type InstagramStats = {
  media_analysed: number
  avg_views: number | null
  views_sample: number
  avg_reels_views: number | null
  reels_sample: number
  avg_reach: number | null
  reach_sample: number
  avg_likes: number | null
  avg_comments: number | null
  engagement_sample: number
  /** Average interactions per post ÷ followers, as a percentage. Null without both. */
  engagement_rate: number | null
  top_media: {
    id: string
    permalink?: string
    media_type?: string
    media_product_type?: string
    thumbnail_url?: string
    timestamp?: string
    views?: number
    likes?: number
    comments?: number
  }[]
  computed_at: string
}

/** Averages and top content from the media Instagram returned. Each average says how many posts it covers. */
export function computeStats(profile: Pick<InstagramProfile, 'followers_count'>, media: InstagramMedia[], now = new Date()): InstagramStats {
  const views = media.map((m) => m.insights?.views).filter(num)
  const reelsViews = media.filter((m) => m.media_product_type === 'REELS').map((m) => m.insights?.views).filter(num)
  const reach = media.map((m) => m.insights?.reach).filter(num)
  const likes = media.map((m) => (num(m.like_count) ? m.like_count : m.insights?.likes)).filter(num)
  const comments = media.map((m) => (num(m.comments_count) ? m.comments_count : m.insights?.comments)).filter(num)
  const interactions = media
    .map((m) => {
      if (num(m.insights?.total_interactions)) return m.insights!.total_interactions
      const l = num(m.like_count) ? m.like_count : m.insights?.likes
      const c = num(m.comments_count) ? m.comments_count : m.insights?.comments
      return num(l) && num(c) ? l + c : undefined
    })
    .filter(num)
  const followers = profile.followers_count
  const avgInteractions = avg(interactions)
  const engagement = num(followers) && followers > 0 && avgInteractions !== null ? Math.round((avgInteractions / followers) * 10000) / 100 : null

  const score = (m: InstagramMedia) => m.insights?.views ?? (num(m.like_count) ? m.like_count : (m.insights?.likes ?? -1))
  const top = [...media]
    .filter((m) => num(m.insights?.views) || num(m.like_count) || num(m.insights?.likes))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3)
    .map((m) => ({
      id: m.id,
      permalink: m.permalink,
      media_type: m.media_type,
      media_product_type: m.media_product_type,
      thumbnail_url: m.thumbnail_url ?? (m.media_type === 'VIDEO' ? undefined : m.media_url),
      timestamp: m.timestamp,
      views: m.insights?.views,
      likes: num(m.like_count) ? m.like_count : m.insights?.likes,
      comments: num(m.comments_count) ? m.comments_count : m.insights?.comments,
    }))

  return {
    media_analysed: media.length,
    avg_views: avg(views),
    views_sample: views.length,
    avg_reels_views: avg(reelsViews),
    reels_sample: reelsViews.length,
    avg_reach: avg(reach),
    reach_sample: reach.length,
    avg_likes: avg(likes),
    avg_comments: avg(comments),
    engagement_sample: interactions.length,
    engagement_rate: engagement,
    top_media: top,
    computed_at: now.toISOString(),
  }
}

/** The media snapshot kept in the database: no captions beyond a preview, no media bytes. */
export function mediaSnapshot(media: InstagramMedia[]) {
  return media.map((m) => ({
    id: m.id,
    caption: m.caption ? m.caption.slice(0, 280) : undefined,
    media_type: m.media_type,
    media_product_type: m.media_product_type,
    media_url: m.media_url,
    permalink: m.permalink,
    thumbnail_url: m.thumbnail_url,
    timestamp: m.timestamp,
    like_count: m.like_count,
    comments_count: m.comments_count,
    insights: m.insights,
  }))
}

// ---------------------------------------------------------- token at rest --

async function importKey(keyB64: string) {
  const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0))
  if (raw.length !== 32) throw new Error('INSTAGRAM_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** `v1:<iv>:<ciphertext>`, AES-256-GCM. The key never leaves the Edge Function. */
export async function encryptToken(token: string, keyB64: string) {
  const key = await importKey(keyB64)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token)))
  return `v1:${base64url(iv)}:${base64url(cipher)}`
}

export async function decryptToken(blob: string, keyB64: string) {
  const [version, ivPart, cipherPart] = blob.split(':')
  if (version !== 'v1' || !ivPart || !cipherPart) throw new Error('Unrecognised token format.')
  const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
  const key = await importKey(keyB64)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(ivPart) }, key, fromB64url(cipherPart))
  return new TextDecoder().decode(plain)
}
