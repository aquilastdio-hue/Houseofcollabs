// Public Instagram stats for creator profiles, read with Apify's Instagram
// Profile Scraper (apify/instagram-profile-scraper).
//
//  1. Weekly refresh (pg_cron → private.request_instagram_stats_refresh):
//     header `x-webhook-secret`, body { action: 'refresh-all' }. Starts one
//     Apify run for every live creator, with a webhook back to this function.
//  2. Apify webhook (run succeeded / timed out): Apify's default payload. None
//     of it is trusted — the run is fetched again with our own token, so only a
//     run in our Apify account can write anything. Results are saved in chunks,
//     each chunk handing the next to this function, so a long list never runs
//     past the function's time limit.
//  3. Admin: Authorization Bearer <admin JWT>
//       { action: 'refresh', creator_id } — fetches that one creator now
//       { action: 'refresh-all' }         — same as the Sunday job
//
// Secrets: APIFY_TOKEN (Apify → Settings → API & Integrations) and the existing
// NOTIFICATION_WEBHOOK_SECRET. The token never leaves this function.
import { handler, HttpError, json, readJson, requireUuid } from '../_shared/http.ts'
import { adminClient, audit, requireAdmin } from '../_shared/supabase.ts'
import { safeEqual } from '../_shared/razorpay.ts'
import {
  normalizeHandle,
  notFoundRow,
  summarizeProfile,
  type ApifyProfile,
  type StatsRow,
} from '../_shared/apify-instagram.ts'

const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') ?? ''
const WEBHOOK_SECRET = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET') ?? ''
const SELF_URL = `${(Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')}/functions/v1/instagram-stats`

const APIFY = 'https://api.apify.com/v2'
const ACTOR = 'apify~instagram-profile-scraper'
const BUCKET = 'instagram-media'
/** Creators saved per invocation: keeps each one well inside the time limit. */
const CHUNK = 20
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type Target = { creator_id: string; username: string }
type ApifyRun = { id: string; status: string; defaultDatasetId: string; defaultKeyValueStoreId: string }

// --------------------------------------------------------------- Apify API --

async function apify(path: string, init: RequestInit = {}): Promise<Response> {
  if (!APIFY_TOKEN) throw new HttpError(500, 'Instagram stats are not configured (APIFY_TOKEN).', 'MISCONFIGURED')
  const res = await fetch(`${APIFY}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${APIFY_TOKEN}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) {
    console.error('apify', path.split('?')[0], res.status, (await res.text()).slice(0, 300))
    throw new HttpError(502, 'Instagram stats could not be fetched. Please try again later.', 'APIFY_FAILED')
  }
  return res
}

async function startRun(usernames: string[]): Promise<string> {
  const webhooks = btoa(
    JSON.stringify([{ eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.TIMED_OUT'], requestUrl: SELF_URL }]),
  )
  const res = await apify(`/acts/${ACTOR}/runs?webhooks=${encodeURIComponent(webhooks)}`, {
    method: 'POST',
    body: JSON.stringify({ usernames }),
  })
  return ((await res.json()) as { data: ApifyRun }).data.id
}

async function getRun(runId: string): Promise<ApifyRun> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(runId)) throw new HttpError(400, 'Invalid run.', 'BAD_REQUEST')
  return ((await (await apify(`/actor-runs/${runId}`)).json()) as { data: ApifyRun }).data
}

// ---------------------------------------------------------------- database --

async function targets(creatorId: string | null = null): Promise<Target[]> {
  const { data, error } = await adminClient().rpc('instagram_stats_targets', { p_creator_id: creatorId })
  if (error) throw error
  return (data ?? []) as Target[]
}

async function save(rows: (StatsRow & { creator_id: string })[]) {
  if (!rows.length) return 0
  const { data, error } = await adminClient().rpc('instagram_stats_upsert', { p_rows: rows })
  if (error) throw error
  return data as number
}

// --------------------------------------------------------- image mirroring --

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0
  const worker = async () => {
    while (next < items.length) await fn(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
}

/**
 * Swaps Instagram's short-lived image links for copies in our own bucket, and
 * removes copies of posts that have dropped out of the recent list. A post
 * already copied is not downloaded again. An image that can't be copied
 * becomes null, and the profile page shows a plain tile for it.
 */
async function mirrorImages(creatorId: string, row: StatsRow): Promise<StatsRow> {
  const store = adminClient().storage.from(BUCKET)
  const { data: existing } = await store.list(creatorId, { limit: 100 })
  const have = new Set((existing ?? []).map((f) => f.name))
  const publicUrl = (name: string) => store.getPublicUrl(`${creatorId}/${name}`).data.publicUrl
  const version = Date.now()

  const copy = async (source: string | null, name: string, force: boolean): Promise<string | null> => {
    if (!force && have.has(name)) return publicUrl(name)
    if (!source) return null
    try {
      const res = await fetch(source)
      const type = (res.headers.get('content-type') ?? '').split(';')[0]
      if (!res.ok) return null
      const { error } = await store.upload(`${creatorId}/${name}`, await res.arrayBuffer(), {
        contentType: IMAGE_TYPES.includes(type) ? type : 'image/jpeg',
        upsert: true,
      })
      return error ? null : publicUrl(name)
    } catch {
      return null
    }
  }

  const posts = row.recent_posts.map((p) => ({ ...p }))
  await pool(posts, 4, async (p) => {
    p.image = await copy(p.image, `${p.short_code}.jpg`, false)
  })
  // The profile picture keeps one name, so it is always replaced and the URL
  // carries a version to get past the CDN's copy of last week's.
  const pic = await copy(row.profile_pic_url, 'avatar.jpg', true)

  const keep = new Set(['avatar.jpg', ...posts.map((p) => `${p.short_code}.jpg`)])
  const stale = [...have].filter((name) => !keep.has(name)).map((name) => `${creatorId}/${name}`)
  if (stale.length) await store.remove(stale)

  return { ...row, recent_posts: posts, profile_pic_url: pic ? `${pic}?v=${version}` : null }
}

async function rowsFor(item: ApifyProfile, byUsername: Map<string, string[]>) {
  const username = normalizeHandle(item.username ?? (item as { inputUrl?: string }).inputUrl)
  if (!username) return []
  const summary = summarizeProfile(item, username)
  const rows = []
  for (const creatorId of byUsername.get(username) ?? []) {
    rows.push({ creator_id: creatorId, ...(await mirrorImages(creatorId, summary)) })
  }
  return rows
}

function groupByUsername(list: Target[]) {
  const map = new Map<string, string[]>()
  for (const t of list) map.set(t.username, [...(map.get(t.username) ?? []), t.creator_id])
  return map
}

// ------------------------------------------------------------------ flows --

async function refreshAll() {
  const list = await targets()
  const usernames = [...new Set(list.map((t) => t.username))]
  if (!usernames.length) return { started: false, profiles: 0 }
  const runId = await startRun(usernames)
  return { started: true, run_id: runId, profiles: usernames.length }
}

async function refreshOne(creatorId: string) {
  const [target] = await targets(creatorId)
  if (!target) throw new HttpError(422, 'This creator has no Instagram account on file.', 'NO_INSTAGRAM')
  const res = await apify(`/acts/${ACTOR}/run-sync-get-dataset-items?timeout=120`, {
    method: 'POST',
    body: JSON.stringify({ usernames: [target.username] }),
  })
  const items = (await res.json()) as ApifyProfile[]
  const item = items.find((i) => normalizeHandle(i.username) === target.username) ?? items[0]
  const row = item
    ? { creator_id: creatorId, ...(await mirrorImages(creatorId, summarizeProfile(item, target.username))) }
    : { creator_id: creatorId, ...notFoundRow(target.username) }
  await save([row])
  return row
}

/** Saves one chunk of a finished run, then hands the next chunk to a fresh invocation. */
async function ingest(runId: string, offset: number) {
  const run = await getRun(runId)
  if (run.status !== 'SUCCEEDED' && run.status !== 'TIMED-OUT') return { skipped: run.status }

  const input = (await (await apify(`/key-value-stores/${run.defaultKeyValueStoreId}/records/INPUT`)).json()) as {
    usernames?: unknown
  }
  if (!Array.isArray(input.usernames)) return { skipped: 'not an Instagram profile run' }
  const requested = new Set(input.usernames.map((u) => normalizeHandle(String(u))).filter(Boolean) as string[])
  const byUsername = groupByUsername((await targets()).filter((t) => requested.has(t.username)))

  const page = await apify(`/datasets/${run.defaultDatasetId}/items?clean=true&offset=${offset}&limit=${CHUNK}`)
  const total = Number(page.headers.get('x-apify-pagination-total') ?? 0)
  const items = (await page.json()) as ApifyProfile[]

  const rows = []
  for (const item of items) rows.push(...(await rowsFor(item, byUsername)))
  let saved = await save(rows)

  const next = offset + items.length
  if (items.length && next < total) {
    await handOff({ action: 'ingest', run_id: runId, offset: next })
  } else if (run.status === 'SUCCEEDED') {
    // Last chunk of a complete run: anyone Apify returned nothing for is gone
    // or renamed. A run that timed out proves nothing about the ones it missed.
    const all = (await (await apify(`/datasets/${run.defaultDatasetId}/items?clean=true&fields=username`)).json()) as {
      username?: string
    }[]
    const seen = new Set(all.map((i) => normalizeHandle(i.username)))
    const missing = [...byUsername].filter(([username]) => !seen.has(username))
    saved += await save(missing.flatMap(([username, ids]) => ids.map((id) => ({ creator_id: id, ...notFoundRow(username) }))))
  }
  return { run_id: runId, offset, saved, total }
}

/** Calls this function again with the shared secret; it answers 202 straight away. */
async function handOff(body: Record<string, unknown>) {
  const res = await fetch(SELF_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error('instagram-stats hand-off failed', res.status)
}

/** Keeps work running after the response is sent (Supabase Edge Runtime). */
function inBackground(work: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
  const logged = work.catch((e) => console.error('instagram-stats background work failed', e))
  if (runtime) runtime.waitUntil(logged)
}

// --------------------------------------------------------------- endpoint --

type Body = {
  action?: string
  creator_id?: string
  run_id?: string
  offset?: number
  // Apify's default webhook payload
  eventType?: string
  eventData?: { actorRunId?: string }
  resource?: { id?: string }
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const secret = req.headers.get('x-webhook-secret')
  const body = await readJson<Body>(req)

  // Apify's callback. Answered at once so Apify doesn't retry while we work.
  if (body.eventType && secret === null) {
    const runId = body.eventData?.actorRunId ?? body.resource?.id
    if (typeof runId !== 'string') throw new HttpError(400, 'Unexpected payload.', 'BAD_REQUEST')
    inBackground(ingest(runId, 0))
    return json({ accepted: true }, 202)
  }

  if (secret !== null) {
    if (!WEBHOOK_SECRET || !safeEqual(secret, WEBHOOK_SECRET)) throw new HttpError(401, 'Invalid webhook secret.', 'UNAUTHORIZED')
    if (body.action === 'refresh-all') return json(await refreshAll())
    if (body.action === 'ingest' && typeof body.run_id === 'string') {
      inBackground(ingest(body.run_id, Math.max(0, Math.floor(Number(body.offset) || 0))))
      return json({ accepted: true }, 202)
    }
    throw new HttpError(400, 'Unsupported request.', 'BAD_REQUEST')
  }

  const admin = await requireAdmin(req)
  if (body.action === 'refresh') {
    const creatorId = requireUuid(body.creator_id, 'creator')
    const row = await refreshOne(creatorId)
    await audit(admin.id, 'instagram_stats_refreshed', 'creator', creatorId, { status: row.status })
    return json(row)
  }
  if (body.action === 'refresh-all') {
    const result = await refreshAll()
    await audit(admin.id, 'instagram_stats_refresh_all', 'creator', null, result)
    return json(result)
  }
  throw new HttpError(400, 'Unsupported request.', 'BAD_REQUEST')
})
