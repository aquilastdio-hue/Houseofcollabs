// Public Instagram stats for creator profiles, read with Apify's Instagram
// Profile Scraper (apify/instagram-profile-scraper), and average Reel views
// over each creator's latest 10 Reels from the Instagram Reel Scraper
// (apify/instagram-reel-scraper): the profile scraper only sees ~12 recent
// posts of any kind, which for many creators held a single Reel.
//
//  1. Weekly refresh (pg_cron → private.request_instagram_stats_refresh):
//     header `x-webhook-secret`, body { action: 'refresh-all' }. Starts a
//     profile run and a Reel run for every live creator, each with a webhook
//     back to this function. The Reel run only ever writes the Reel average,
//     and a profile save keeps the Reel average already stored, so the two
//     can finish in either order.
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
  REELS_AVERAGED,
  normalizeHandle,
  notFoundRow,
  reelOwner,
  summarizeProfile,
  summarizeReels,
  type ApifyProfile,
  type ApifyReel,
  type StatsRow,
} from '../_shared/apify-instagram.ts'

const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') ?? ''
const WEBHOOK_SECRET = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET') ?? ''
const SELF_URL = `${(Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')}/functions/v1/instagram-stats`

const APIFY = 'https://api.apify.com/v2'
const PROFILE_ACTOR = 'apify~instagram-profile-scraper'
const REEL_ACTOR = 'apify~instagram-reel-scraper'
const BUCKET = 'instagram-media'
/** Creators saved per invocation: keeps each one well inside the time limit. */
const CHUNK = 10
/** Creators whose images are copied at once within a chunk. */
const PARALLEL = 3
/**
 * Image copying stops after this long; the numbers are saved regardless.
 * Before this, one stalled Instagram image could run an invocation into the
 * platform's time limit, which killed it before it saved or handed on the
 * next chunk: Sunday's refresh saved nothing and a manual one stopped at 79.
 */
const CHUNK_BUDGET_MS = 90_000
/** One image download and upload. */
const IMAGE_TIMEOUT_MS = 10_000
/** How long each chunk waits before starting, so only a few run at once. */
const STAGGER_MS = 8_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type Target = { creator_id: string; username: string }
type ApifyRun = { id: string; status: string; defaultDatasetId: string; defaultKeyValueStoreId: string }

// --------------------------------------------------------------- Apify API --

async function apify(path: string, init: RequestInit = {}): Promise<Response> {
  if (!APIFY_TOKEN) throw new HttpError(500, 'Instagram stats are not configured (APIFY_TOKEN).', 'MISCONFIGURED')
  // Reads are retried after a busy or failed answer; starting a run is not, so it never starts twice.
  const attempts = (init.method ?? 'GET') === 'GET' ? 3 : 1
  for (let attempt = 1; ; attempt++) {
    let res: Response | null = null
    try {
      res = await fetch(`${APIFY}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${APIFY_TOKEN}`, 'Content-Type': 'application/json', ...init.headers },
      })
    } catch (e) {
      if (attempt >= attempts) throw e
    }
    if (res?.ok) return res
    const retryable = !res || res.status === 429 || res.status >= 500
    if (!retryable || attempt >= attempts) {
      console.error('apify', path.split('?')[0], res?.status, res ? (await res.text()).slice(0, 300) : '')
      throw new HttpError(502, 'Instagram stats could not be fetched. Please try again later.', 'APIFY_FAILED')
    }
    await sleep(1_000 * attempt)
  }
}

async function startRun(actor: string, input: Record<string, unknown>): Promise<string> {
  const webhooks = btoa(
    JSON.stringify([{ eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.TIMED_OUT'], requestUrl: SELF_URL }]),
  )
  const res = await apify(`/acts/${actor}/runs?webhooks=${encodeURIComponent(webhooks)}`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return ((await res.json()) as { data: ApifyRun }).data.id
}

/** The Reel Scraper's input: each profile's latest Reels, pinned ones skipped (they're often old hits). */
const reelInput = (usernames: string[]) => ({ username: usernames, resultsLimit: REELS_AVERAGED, skipPinnedPosts: true })

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
  const unique = [...new Map(rows.map((r) => [r.creator_id, r])).values()]
  const db = adminClient()
  const { data, error } = await db.rpc('instagram_stats_upsert', { p_rows: unique })
  if (!error) return data as number
  if (unique.length === 1) throw error

  // One row the database refuses fails the whole batch. Save the rest one at
  // a time, and note on the refused one why, so it doesn't take the others with it.
  console.error('instagram-stats: batch refused, saving one at a time', error.message)
  let saved = 0
  for (const row of unique) {
    const one = await db.rpc('instagram_stats_upsert', { p_rows: [row] })
    if (!one.error) {
      saved += one.data as number
      continue
    }
    console.error('instagram-stats: not saved', row.creator_id, one.error.message)
    const note = `Not saved: ${one.error.message}`.slice(0, 500)
    const { data: kept } = await db.from('creator_instagram_stats').update({ last_error: note }).eq('creator_id', row.creator_id).select('creator_id')
    if (!kept?.length) {
      await db.from('creator_instagram_stats').insert({ creator_id: row.creator_id, username: row.username, status: 'error', last_error: note })
    }
  }
  return saved
}

/**
 * A profile save keeps the Reel average the Reel run last stored: the profile
 * scraper's few recent posts would otherwise replace it with a worse one. A
 * creator with no stats yet keeps the profile scraper's figure until then.
 */
async function keepReelAverages<T extends { creator_id: string; avg_reel_views: number | null; reels_sampled: number }>(rows: T[]): Promise<T[]> {
  if (!rows.length) return rows
  const { data, error } = await adminClient()
    .from('creator_instagram_stats')
    .select('creator_id, avg_reel_views, reels_sampled')
    .in('creator_id', rows.map((r) => r.creator_id))
  if (error) throw error
  const stored = new Map((data ?? []).map((r) => [r.creator_id as string, r as { avg_reel_views: number | null; reels_sampled: number }]))
  return rows.map((r) => {
    const s = stored.get(r.creator_id)
    return s ? { ...r, avg_reel_views: s.avg_reel_views, reels_sampled: s.reels_sampled } : r
  })
}

/**
 * Writes each creator's Reel average, and nothing else. A creator with no
 * stats row yet gets one, which their profile run then fills in.
 */
async function saveReelAverages(entries: (Target & { avg_reel_views: number | null; reels_sampled: number })[]) {
  const db = adminClient()
  let saved = 0
  await pool(entries, 8, async (e) => {
    const values = { avg_reel_views: e.avg_reel_views, reels_sampled: e.reels_sampled, updated_at: new Date().toISOString() }
    const updated = await db.from('creator_instagram_stats').update(values).eq('creator_id', e.creator_id).select('creator_id')
    let error = updated.error
    if (!error && !updated.data?.length) {
      error = (await db.from('creator_instagram_stats').insert({ creator_id: e.creator_id, username: e.username, ...values })).error
    }
    if (error) console.error('instagram-stats: Reel average not saved', e.creator_id, error.message)
    else saved++
  })
  return saved
}

// --------------------------------------------------------- image mirroring --

/** `promise`, or `fallback` once `ms` have passed (the promise is left to settle on its own). */
function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<T>((resolve) => (timer = setTimeout(() => resolve(fallback), ms)))
  return Promise.race([promise, late]).finally(() => clearTimeout(timer))
}

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
 * becomes null, and the profile page shows a plain tile for it. Nothing new
 * is started after `deadline`.
 */
async function mirrorImages(creatorId: string, row: StatsRow, deadline: number): Promise<StatsRow> {
  const store = adminClient().storage.from(BUCKET)
  const { data: existing } = await store.list(creatorId, { limit: 100 })
  const have = new Set((existing ?? []).map((f) => f.name))
  const publicUrl = (name: string) => store.getPublicUrl(`${creatorId}/${name}`).data.publicUrl
  const version = Date.now()

  const download = async (source: string, name: string): Promise<string | null> => {
    try {
      const res = await fetch(source, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) })
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
  const copy = async (source: string | null, name: string, force: boolean): Promise<string | null> => {
    if (!force && have.has(name)) return publicUrl(name)
    if (!source || Date.now() > deadline) return have.has(name) ? publicUrl(name) : null
    return within(download(source, name), IMAGE_TIMEOUT_MS + 5_000, null)
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

async function rowsFor(item: ApifyProfile, byUsername: Map<string, string[]>, deadline: number) {
  const username = normalizeHandle(item.username ?? (item as { inputUrl?: string }).inputUrl)
  if (!username) return []
  const summary = summarizeProfile(item, username)
  const rows = []
  for (const creatorId of byUsername.get(username) ?? []) {
    rows.push({ creator_id: creatorId, ...(await mirrorImages(creatorId, summary, deadline)) })
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
  const runId = await startRun(PROFILE_ACTOR, { usernames })
  // Without the Reel run everything but the Reel average still refreshes.
  const reelRunId = await startRun(REEL_ACTOR, reelInput(usernames)).catch((e) => {
    console.error('instagram-stats: Reel run not started', e)
    return null
  })
  return { started: true, run_id: runId, reel_run_id: reelRunId, profiles: usernames.length }
}

async function refreshOne(creatorId: string) {
  const [target] = await targets(creatorId)
  if (!target) throw new HttpError(422, 'This creator has no Instagram account on file.', 'NO_INSTAGRAM')
  const sync = (actor: string, input: Record<string, unknown>) =>
    apify(`/acts/${actor}/run-sync-get-dataset-items?timeout=120`, { method: 'POST', body: JSON.stringify(input) }).then((res) => res.json())
  const [profile, reels] = await Promise.allSettled([
    sync(PROFILE_ACTOR, { usernames: [target.username] }) as Promise<ApifyProfile[]>,
    sync(REEL_ACTOR, reelInput([target.username])) as Promise<ApifyReel[]>,
  ])
  if (profile.status === 'rejected') throw profile.reason
  const items = profile.value
  const item = items.find((i) => normalizeHandle(i.username) === target.username) ?? items[0]
  let row = item
    ? { creator_id: creatorId, ...(await mirrorImages(creatorId, summarizeProfile(item, target.username), Date.now() + CHUNK_BUDGET_MS)) }
    : { creator_id: creatorId, ...notFoundRow(target.username) }
  if (row.status === 'ok') {
    // The latest 10 Reels; if that read failed, the average stored last time stays.
    row =
      reels.status === 'fulfilled'
        ? { ...row, ...summarizeReels(reels.value.filter((r) => (reelOwner(r) ?? target.username) === target.username)) }
        : (await keepReelAverages([row]))[0]!
  }
  await save([row])
  return row
}

/** Saves one chunk of a finished run, then hands the next chunk to a fresh invocation. */
async function ingest(runId: string, offset: number, delayMs = 0) {
  if (delayMs) await sleep(delayMs)
  const run = await getRun(runId)
  if (run.status !== 'SUCCEEDED' && run.status !== 'TIMED-OUT') return { skipped: run.status }

  const input = (await (await apify(`/key-value-stores/${run.defaultKeyValueStoreId}/records/INPUT`)).json()) as {
    usernames?: unknown
    username?: unknown
  }
  if (Array.isArray(input.username)) return offset ? { skipped: 'a Reel run is saved in one go' } : await ingestReels(run, input.username)
  if (!Array.isArray(input.usernames)) return { skipped: 'not an Instagram profile run' }
  const requested = new Set(input.usernames.map((u) => normalizeHandle(String(u))).filter(Boolean) as string[])
  const byUsername = groupByUsername((await targets()).filter((t) => requested.has(t.username)))

  const page = await apify(`/datasets/${run.defaultDatasetId}/items?clean=true&offset=${offset}&limit=${CHUNK}`)
  const total = Number(page.headers.get('x-apify-pagination-total') ?? 0)
  const items = (await page.json()) as ApifyProfile[]

  const next = offset + items.length
  const more = items.length > 0 && next < total
  // The next chunk is sent on before this one does its work, so a chunk that
  // fails or is cut short loses only its own creators, not the rest of the
  // run. It waits STAGGER_MS before starting, which keeps only a few going.
  if (more) await handOff({ action: 'ingest', run_id: runId, offset: next, delay: STAGGER_MS })

  const deadline = Date.now() + CHUNK_BUDGET_MS
  const rows: (StatsRow & { creator_id: string })[] = []
  await pool(items, PARALLEL, async (item) => {
    try {
      rows.push(...(await rowsFor(item, byUsername, deadline)))
    } catch (e) {
      console.error('instagram-stats: skipped a profile', item.username, e)
    }
  })
  let saved = await save(await keepReelAverages(rows))

  if (!more && run.status === 'SUCCEEDED') {
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

/**
 * A finished Reel run: every creator's latest Reels, averaged and saved in one
 * go (they're small, and there are no images to copy).
 */
async function ingestReels(run: ApifyRun, requestedRaw: unknown[]) {
  const requested = new Set(requestedRaw.map((u) => normalizeHandle(String(u))).filter(Boolean) as string[])
  const list = (await targets()).filter((t) => requested.has(t.username))
  const fields = 'ownerUsername,inputUrl,shortCode,timestamp,videoPlayCount,videoViewCount,isPinned'
  const reels = (await (await apify(`/datasets/${run.defaultDatasetId}/items?clean=true&fields=${fields}`)).json()) as ApifyReel[]
  const byOwner = new Map<string, ApifyReel[]>()
  for (const r of reels) {
    const owner = reelOwner(r)
    if (owner) byOwner.set(owner, [...(byOwner.get(owner) ?? []), r])
  }
  // A run that timed out proves nothing about a creator it returned no Reels for.
  const complete = run.status === 'SUCCEEDED'
  const entries = list.filter((t) => complete || byOwner.has(t.username)).map((t) => ({ ...t, ...summarizeReels(byOwner.get(t.username) ?? []) }))
  return { run_id: run.id, reels: reels.length, saved: await saveReelAverages(entries) }
}

/** Calls this function again with the shared secret; it answers 202 straight away. */
async function handOff(body: Record<string, unknown>) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(SELF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
        body: JSON.stringify(body),
      })
      if (res.ok) return
      console.error('instagram-stats hand-off failed', res.status, `attempt ${attempt}`)
    } catch (e) {
      console.error('instagram-stats hand-off failed', e, `attempt ${attempt}`)
    }
    await sleep(2_000 * attempt)
  }
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
  delay?: number
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
      const delay = Math.min(Math.max(0, Number(body.delay) || 0), 30_000)
      inBackground(ingest(body.run_id, Math.max(0, Math.floor(Number(body.offset) || 0)), delay))
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
