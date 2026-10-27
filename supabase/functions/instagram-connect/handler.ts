// POST { action: 'start' | 'exchange' | 'sync', … } — "Connect Instagram" for
// creators, through Instagram API with Instagram Login.
//
//   start     { redirect_uri }          → { authorize_url, state }
//             Issues a one-time CSRF state (stored server-side, 15 minutes) for
//             a redirect URI on the INSTAGRAM_REDIRECT_URIS allow-list.
//   exchange  { code, state }           → { connection_id, username, … }
//             Spends the state, swaps the code for a short-lived and then a
//             long-lived token, reads the profile, recent media and their
//             insights, and stores it all with the token encrypted. The token
//             never leaves this function.
//   sync      { connection_id }  admin  → refreshed profile/stats
//             Re-reads a stored connection; the hook for scheduled syncing later.
//
// Deliberately unauthenticated for start/exchange: applicants have no account
// yet. The one-time state is what ties the callback to the click that started
// it; the browser also checks it before calling exchange.
import { handler, HttpError, json, must, readJson, requireString, requireUuid } from '../_shared/http.ts'
import * as ig from '../_shared/instagram.ts'

export type Deps = {
  env: (key: string) => string | undefined
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
  fetch: typeof fetch
  requireAdmin: (req: Request) => Promise<unknown>
  now?: () => Date
}

export function readConfig(env: Deps['env']): ig.InstagramConfig | null {
  const appId = env('INSTAGRAM_APP_ID')?.trim()
  const appSecret = env('INSTAGRAM_APP_SECRET')?.trim()
  const tokenKey = env('INSTAGRAM_TOKEN_ENCRYPTION_KEY')?.trim()
  const redirectUris = (env('INSTAGRAM_REDIRECT_URIS') ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
  if (!appId || !appSecret || !tokenKey || redirectUris.length === 0) return null
  return { appId, appSecret, tokenKey, redirectUris, graphVersion: env('INSTAGRAM_GRAPH_VERSION')?.trim() || ig.DEFAULT_GRAPH_VERSION }
}

/** Instagram failures, worded for the person connecting rather than for us. */
function toHttp(e: unknown, fallback: string): never {
  if (e instanceof HttpError) throw e
  if (e instanceof ig.InstagramApiError) {
    console.error('Instagram API error', e.status, e.code, e.subcode, e.type, e.message)
    if (e.tokenInvalid) throw new HttpError(401, 'Instagram ended this session. Please connect again.', 'INSTAGRAM_TOKEN_INVALID')
    if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613) {
      throw new HttpError(429, 'Instagram is busy right now. Please try again in a few minutes.', 'INSTAGRAM_RATE_LIMITED')
    }
    throw new HttpError(502, fallback, 'INSTAGRAM_API_ERROR')
  }
  throw e
}

async function readAccount(deps: Deps, cfg: ig.InstagramConfig, token: string, withInsights: boolean) {
  const profile = await ig.fetchProfile(deps.fetch, cfg.graphVersion, token)
  let media: ig.InstagramMedia[] = []
  let mediaError: string | null = null
  try {
    media = await ig.fetchMediaWithInsights(deps.fetch, cfg.graphVersion, token, withInsights)
  } catch (e) {
    if (e instanceof ig.InstagramApiError && e.tokenInvalid) throw e
    // A connection is still worth keeping without the media list; say so.
    mediaError = e instanceof Error ? e.message : 'Could not read media.'
    console.error('Instagram media read failed', mediaError)
  }
  return { profile, media, mediaError }
}

export function createHandler(deps: Deps) {
  const now = deps.now ?? (() => new Date())

  return handler(async (req) => {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
    const body = await readJson<Record<string, unknown>>(req)
    const cfg = readConfig(deps.env)
    if (!cfg) {
      throw new HttpError(503, 'Connecting Instagram isn’t available yet. You can fill in your details by hand for now.', 'INSTAGRAM_NOT_CONFIGURED')
    }

    switch (body.action) {
      // ------------------------------------------------------------ start --
      case 'start': {
        const redirectUri = requireString(body.redirect_uri, 'redirect_uri', 500)
        if (!cfg.redirectUris.includes(redirectUri)) {
          throw new HttpError(400, 'Instagram can’t be connected from this address.', 'REDIRECT_NOT_ALLOWED')
        }
        const state = ig.randomState()
        must(await deps.rpc('instagram_create_oauth_state', { p_state: state, p_redirect_uri: redirectUri }))
        return json({ authorize_url: ig.buildAuthorizeUrl(cfg, { state, redirectUri }), state })
      }

      // --------------------------------------------------------- exchange --
      case 'exchange': {
        const code = requireString(body.code, 'code', 2048)
        const state = requireString(body.state, 'state', 128)
        // One-time, 15 minutes, and it returns the redirect URI the code was issued for.
        const redirectUri = must(await deps.rpc('instagram_consume_oauth_state', { p_state: state })) as string

        let short: Awaited<ReturnType<typeof ig.exchangeCode>>
        try {
          short = await ig.exchangeCode(deps.fetch, cfg, code, redirectUri)
        } catch (e) {
          if (e instanceof ig.InstagramApiError) {
            console.error('Instagram code exchange failed', e.status, e.code, e.type, e.message)
            throw new HttpError(400, 'Instagram didn’t accept this sign-in — it may have expired. Please try connecting again.', 'INSTAGRAM_CODE_REJECTED')
          }
          throw e
        }
        if (!short.permissions.includes('instagram_business_basic')) {
          throw new HttpError(403, 'Instagram didn’t grant access to your profile. Please connect again and allow the requested access.', 'INSTAGRAM_PERMISSION_DENIED')
        }
        const withInsights = short.permissions.includes('instagram_business_manage_insights')

        try {
          const long = await ig.exchangeLongLived(deps.fetch, cfg, short.accessToken)
          const { profile, media, mediaError } = await readAccount(deps, cfg, long.accessToken, withInsights)
          if (!ig.isProfessionalAccount(profile.account_type)) {
            throw new HttpError(
              422,
              'Only Instagram professional accounts (Creator or Business) can be connected. Switch your account to a professional account in the Instagram app, then try again.',
              'INSTAGRAM_NOT_PROFESSIONAL',
            )
          }
          const stats = ig.computeStats(profile, media, now())
          const expiresAt = long.expiresIn > 0 ? new Date(now().getTime() + long.expiresIn * 1000).toISOString() : null
          const connectionId = must(
            await deps.rpc('instagram_save_connection', {
              p_connection: {
                ig_user_id: profile.user_id || short.userId,
                username: profile.username,
                name: profile.name ?? null,
                account_type: profile.account_type ?? null,
                profile_picture_url: profile.profile_picture_url ?? null,
                followers_count: profile.followers_count ?? null,
                follows_count: profile.follows_count ?? null,
                media_count: profile.media_count ?? null,
                permissions: short.permissions,
                access_token_encrypted: await ig.encryptToken(long.accessToken, cfg.tokenKey),
                token_expires_at: expiresAt,
                stats,
                media: ig.mediaSnapshot(media),
              },
            }),
          ) as string

          return json({
            connection_id: connectionId,
            username: profile.username,
            name: profile.name ?? null,
            account_type: profile.account_type ?? null,
            profile_url: ig.profileUrl(profile.username),
            profile_picture_url: profile.profile_picture_url ?? null,
            followers_count: profile.followers_count ?? null,
            media_count: profile.media_count ?? null,
            insights_granted: withInsights,
            media_read: mediaError === null,
            stats: {
              media_analysed: stats.media_analysed,
              avg_views: stats.avg_views,
              views_sample: stats.views_sample,
              engagement_rate: stats.engagement_rate,
            },
          })
        } catch (e) {
          toHttp(e, 'Instagram didn’t respond as expected. Please try connecting again.')
        }
      }

      // ------------------------------------------------------------- sync --
      case 'sync': {
        await deps.requireAdmin(req)
        const id = requireUuid(body.connection_id, 'connection_id')
        const rows = must(await deps.rpc('instagram_connection_for_sync', { p_id: id })) as {
          access_token_encrypted: string
          token_expires_at: string | null
          status: string
        }[]
        const row = rows[0]
        if (!row) throw new HttpError(404, 'Connection not found.', 'NOT_FOUND')
        if (row.status === 'revoked') throw new HttpError(409, 'This connection was revoked. The creator needs to connect again.', 'INSTAGRAM_REVOKED')

        let token = await ig.decryptToken(row.access_token_encrypted, cfg.tokenKey)
        const patch: Record<string, unknown> = {}
        try {
          // Within a week of expiry, refresh first (Instagram allows it once the token is a day old).
          const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0
          if (expiresAt && expiresAt - now().getTime() < 7 * 24 * 3600 * 1000) {
            const refreshed = await ig.refreshLongLived(deps.fetch, token)
            token = refreshed.accessToken
            patch.access_token_encrypted = await ig.encryptToken(token, cfg.tokenKey)
            patch.token_expires_at = new Date(now().getTime() + refreshed.expiresIn * 1000).toISOString()
          }
          const { profile, media, mediaError } = await readAccount(deps, cfg, token, true)
          Object.assign(patch, {
            username: profile.username,
            name: profile.name ?? null,
            account_type: profile.account_type ?? null,
            profile_picture_url: profile.profile_picture_url ?? null,
            followers_count: profile.followers_count ?? null,
            follows_count: profile.follows_count ?? null,
            media_count: profile.media_count ?? null,
            stats: ig.computeStats(profile, media, now()),
            media: ig.mediaSnapshot(media),
            status: 'connected',
            last_error: mediaError,
            synced: true,
          })
          must(await deps.rpc('instagram_update_connection', { p_id: id, p_patch: patch }))
          return json({ connection_id: id, username: profile.username, followers_count: profile.followers_count ?? null, synced: true })
        } catch (e) {
          if (e instanceof ig.InstagramApiError && e.tokenInvalid) {
            must(await deps.rpc('instagram_update_connection', { p_id: id, p_patch: { status: 'token_expired', last_error: e.message } }))
          }
          toHttp(e, 'Instagram didn’t respond as expected. Please try again later.')
        }
      }

      default:
        throw new HttpError(400, 'Unknown action.', 'BAD_REQUEST')
    }
  })
}
