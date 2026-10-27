import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Deps } from './handler'

// http.ts reads Deno.env when it loads, so Deno has to exist before the import.
vi.stubGlobal('Deno', { env: { get: () => undefined } })
let createHandler: typeof import('./handler').createHandler
let decryptToken: typeof import('../_shared/instagram').decryptToken
beforeAll(async () => {
  ;({ createHandler } = await import('./handler'))
  ;({ decryptToken } = await import('../_shared/instagram'))
})

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => 255 - i)))
const REDIRECT = 'https://www.houseofcollabs.com/instagram/callback'
const ENV: Record<string, string> = {
  INSTAGRAM_APP_ID: '9876543210',
  INSTAGRAM_APP_SECRET: 'app-secret-xyz',
  INSTAGRAM_REDIRECT_URIS: `${REDIRECT}, https://preview.houseofcollabs.com/instagram/callback`,
  INSTAGRAM_TOKEN_ENCRYPTION_KEY: KEY,
}

type Scenario = {
  permissions?: string
  accountType?: string
  codeRejected?: boolean
}

/** A stand-in for Instagram's servers, recording what it was asked. */
function fakeInstagram(s: Scenario = {}) {
  const calls: { url: string; body?: string }[] = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, body: init?.body ? String(init.body) : undefined })
    const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
    const fail = (status: number, error: unknown) => new Response(JSON.stringify(error), { status })

    if (url === 'https://api.instagram.com/oauth/access_token') {
      if (s.codeRejected) return fail(400, { error_type: 'OAuthException', code: 400, error_message: 'Invalid authorization code' })
      return ok({ data: [{ access_token: 'SHORT-TOKEN', user_id: '1789', permissions: s.permissions ?? 'instagram_business_basic,instagram_business_manage_insights' }] })
    }
    if (url.startsWith('https://graph.instagram.com/access_token')) return ok({ access_token: 'LONG-TOKEN', token_type: 'bearer', expires_in: 5183944 })
    if (url.startsWith('https://graph.instagram.com/v26.0/me/media')) {
      return ok({
        data: [
          { id: 'reel1', media_type: 'VIDEO', media_product_type: 'REELS', like_count: 300, comments_count: 20, permalink: 'https://www.instagram.com/reel/1/' },
          { id: 'post1', media_type: 'IMAGE', media_product_type: 'FEED', like_count: 120, comments_count: 4, permalink: 'https://www.instagram.com/p/2/' },
          { id: 'album1', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', like_count: 80, comments_count: 3 },
        ],
      })
    }
    if (url.startsWith('https://graph.instagram.com/v26.0/me')) {
      return ok({ user_id: '1789', username: 'priya.creates', name: 'Priya', account_type: s.accountType ?? 'MEDIA_CREATOR', followers_count: 25400, media_count: 3 })
    }
    const insights = url.match(/v26\.0\/(\w+)\/insights\?metric=([^&]+)/)
    if (insights) {
      const [, id, metrics] = insights
      const list = decodeURIComponent(metrics).split(',')
      if (id === 'reel1') return ok({ data: list.map((name) => ({ name, period: 'lifetime', values: [{ value: name === 'views' ? 9000 : 100 }] })) })
      // post1: the full set is refused; on its own, only `reach` and `likes` work.
      if (list.length > 1 || !['reach', 'likes'].includes(list[0])) return fail(400, { error: { message: 'Invalid metric', code: 100 } })
      return ok({ data: [{ name: list[0], period: 'lifetime', values: [{ value: 640 }] }] })
    }
    return fail(404, { error: { message: `unexpected ${url}`, code: 1 } })
  }) as typeof fetch
  return { fetchFn, calls }
}

/** A stand-in for the database's Instagram functions. */
function fakeDb() {
  const states = new Map<string, { redirect: string; used: boolean }>()
  const saved: Record<string, unknown>[] = []
  const rpc: Deps['rpc'] = async (fn, args) => {
    if (fn === 'instagram_create_oauth_state') {
      states.set(String(args.p_state), { redirect: String(args.p_redirect_uri), used: false })
      return { data: null, error: null }
    }
    if (fn === 'instagram_consume_oauth_state') {
      const row = states.get(String(args.p_state))
      if (!row || row.used) {
        return { data: null, error: { code: 'P0001', message: 'This Instagram sign-in has expired or was already used.', hint: 'INVALID_STATE' } }
      }
      row.used = true
      return { data: row.redirect, error: null }
    }
    if (fn === 'instagram_save_connection') {
      saved.push(args.p_connection as Record<string, unknown>)
      return { data: '11111111-2222-3333-4444-555555555555', error: null }
    }
    return { data: null, error: { code: 'XX000', message: `unexpected rpc ${fn}` } }
  }
  return { rpc, states, saved }
}

function setup(s: Scenario = {}, env: Record<string, string> = ENV) {
  const ig = fakeInstagram(s)
  const db = fakeDb()
  const handle = createHandler({
    env: (k) => env[k],
    rpc: db.rpc,
    fetch: ig.fetchFn,
    // Same as the real check for a caller who isn't an admin.
    requireAdmin: async () => {
      const { HttpError } = await import('../_shared/http')
      throw new HttpError(403, 'Admin access required.', 'ADMIN_REQUIRED')
    },
    now: () => new Date('2026-10-27T10:00:00Z'),
  })
  const post = async (body: unknown) => {
    const res = await handle(new Request('https://fn.local/instagram-connect', { method: 'POST', body: JSON.stringify(body), headers: { origin: 'https://www.houseofcollabs.com' } }))
    return { status: res.status, body: (await res.json()) as Record<string, any> }
  }
  return { post, ig, db }
}

async function startAndGetState(post: ReturnType<typeof setup>['post']) {
  const res = await post({ action: 'start', redirect_uri: REDIRECT })
  expect(res.status).toBe(200)
  return res.body.state as string
}

describe('instagram-connect', () => {
  it('says plainly when Instagram is not configured', async () => {
    const { post } = setup({}, {})
    const res = await post({ action: 'start', redirect_uri: REDIRECT })
    expect(res.status).toBe(503)
    expect(res.body.code).toBe('INSTAGRAM_NOT_CONFIGURED')
  })

  it('only starts for an allow-listed redirect URI', async () => {
    const { post } = setup()
    const res = await post({ action: 'start', redirect_uri: 'https://evil.example/instagram/callback' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('REDIRECT_NOT_ALLOWED')
  })

  it('starts the official authorize flow and remembers the state server-side', async () => {
    const { post, db } = setup()
    const res = await post({ action: 'start', redirect_uri: REDIRECT })
    const url = new URL(res.body.authorize_url)
    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('9876543210')
    expect(url.searchParams.get('state')).toBe(res.body.state)
    expect(db.states.get(res.body.state)?.redirect).toBe(REDIRECT)
    expect(res.body.authorize_url).not.toContain('app-secret-xyz')
  })

  it('exchanges the code server-side, stores the token encrypted, and never returns it', async () => {
    const { post, ig, db } = setup()
    const state = await startAndGetState(post)
    const res = await post({ action: 'exchange', code: 'AQB-code#_', state })
    expect(res.status).toBe(200)

    // The app secret and the code went to Instagram's token endpoint, with the original redirect.
    const tokenCall = ig.calls.find((c) => c.url === 'https://api.instagram.com/oauth/access_token')!
    const form = new URLSearchParams(tokenCall.body)
    expect(form.get('client_secret')).toBe('app-secret-xyz')
    expect(form.get('code')).toBe('AQB-code')
    expect(form.get('redirect_uri')).toBe(REDIRECT)
    expect(form.get('grant_type')).toBe('authorization_code')

    // Nothing secret reaches the browser.
    const out = JSON.stringify(res.body)
    for (const secret of ['SHORT-TOKEN', 'LONG-TOKEN', 'app-secret-xyz']) expect(out).not.toContain(secret)
    expect(res.body).toMatchObject({
      connection_id: '11111111-2222-3333-4444-555555555555',
      username: 'priya.creates',
      profile_url: 'https://www.instagram.com/priya.creates/',
      followers_count: 25400,
      insights_granted: true,
      media_read: true,
    })

    // Stored: the long-lived token, encrypted; expiry ~60 days out; real stats only.
    const row = db.saved[0]
    expect(String(row.access_token_encrypted)).not.toContain('LONG-TOKEN')
    expect(await decryptToken(String(row.access_token_encrypted), KEY)).toBe('LONG-TOKEN')
    expect(row.token_expires_at).toBe(new Date(Date.parse('2026-10-27T10:00:00Z') + 5183944 * 1000).toISOString())
    const media = row.media as { id: string; insights?: Record<string, number> }[]
    expect(media.find((m) => m.id === 'reel1')?.insights?.views).toBe(9000)
    expect(media.find((m) => m.id === 'post1')?.insights).toEqual({ reach: 640, likes: 640 })
    expect(media.find((m) => m.id === 'album1')?.insights).toEqual({})
    expect((row.stats as { avg_views: number; views_sample: number }).avg_views).toBe(9000)
    expect((row.stats as { views_sample: number }).views_sample).toBe(1)
  })

  it('refuses a state that was already used', async () => {
    const { post } = setup()
    const state = await startAndGetState(post)
    expect((await post({ action: 'exchange', code: 'c1', state })).status).toBe(200)
    const again = await post({ action: 'exchange', code: 'c2', state })
    expect(again.status).toBe(422)
    expect(again.body.code).toBe('INVALID_STATE')
  })

  it('refuses a state it never issued', async () => {
    const { post } = setup()
    const res = await post({ action: 'exchange', code: 'c1', state: 'x'.repeat(43) })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('INVALID_STATE')
  })

  it('reports a code Instagram rejects, without saving anything', async () => {
    const { post, db } = setup({ codeRejected: true })
    const res = await post({ action: 'exchange', code: 'stale', state: await startAndGetState(post) })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INSTAGRAM_CODE_REJECTED')
    expect(db.saved).toHaveLength(0)
  })

  it('needs profile access to be granted', async () => {
    const { post, db } = setup({ permissions: 'instagram_business_manage_insights' })
    const res = await post({ action: 'exchange', code: 'c', state: await startAndGetState(post) })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('INSTAGRAM_PERMISSION_DENIED')
    expect(db.saved).toHaveLength(0)
  })

  it('connects without insights when only basic access was granted, and fetches none', async () => {
    const { post, ig, db } = setup({ permissions: 'instagram_business_basic' })
    const res = await post({ action: 'exchange', code: 'c', state: await startAndGetState(post) })
    expect(res.status).toBe(200)
    expect(res.body.insights_granted).toBe(false)
    expect(ig.calls.some((c) => c.url.includes('/insights'))).toBe(false)
    expect((db.saved[0].stats as { avg_views: unknown }).avg_views).toBeNull()
  })

  it('turns away personal accounts and keeps nothing', async () => {
    const { post, db } = setup({ accountType: 'PERSONAL' })
    const res = await post({ action: 'exchange', code: 'c', state: await startAndGetState(post) })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('INSTAGRAM_NOT_PROFESSIONAL')
    expect(db.saved).toHaveLength(0)
  })

  it('keeps sync for admins', async () => {
    const { post } = setup()
    const res = await post({ action: 'sync', connection_id: '11111111-2222-3333-4444-555555555555' })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('ADMIN_REQUIRED')
  })
})
