// Automatic creator payouts through RazorpayX (migration 0041).
//
//   pg_cron every 15 min → private.request_auto_payouts → POST here with
//   header `x-webhook-secret: <NOTIFICATION_WEBHOOK_SECRET>`, body { action: 'run' }.
//   Admin → Payouts → "Run now": Authorization Bearer <admin JWT>, { action: 'run' }.
//   Admin → Payouts (status line): admin JWT, { action: 'status' }.
//
// Each run:
//  1. Checks payouts already sent to RazorpayX and records the outcome, so a
//     missed webhook never leaves one stuck in "processing".
//  2. Claims what has matured (`claim_auto_payouts`, one request per creator,
//     only when `auto_payouts_enabled` is on) and sends each one. A payout
//     RazorpayX refuses is marked failed, which pauses automatic payouts for
//     that creator until they update their details.
//
// Live creators are paid with the live keys and RAZORPAYX_ACCOUNT_NUMBER;
// test creators in RazorpayX test mode with RAZORPAYX_TEST_ACCOUNT_NUMBER.
// A mode without its account number is skipped, never guessed.
import { handler, HttpError, json, readJson } from '../_shared/http.ts'
import { adminClient, requireAdmin } from '../_shared/supabase.ts'
import { razorpayXConfigured, razorpayXFor, safeEqual, type RazorpayMode, type RzpPayout } from '../_shared/razorpay.ts'

const WEBHOOK_SECRET = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET') ?? ''
const CLAIM_LIMIT = 25
const SYNC_LIMIT = 50
const DONE = ['processed']
const FAILED = ['reversed', 'cancelled', 'rejected', 'failed']

type Db = ReturnType<typeof adminClient>

type Claimed = {
  payout_request_id: string
  creator_id: string
  display_name: string
  amount: number
  mode: RazorpayMode
  method_type: 'upi' | 'bank_transfer'
  name: string
  upi: string | null
  account_number: string | null
  ifsc: string | null
}

const reasonOf = (p: RzpPayout) => p.status_details?.description || p.failure_reason || `RazorpayX payout ${p.status}`

async function complete(db: Db, requestId: string, action: 'processing' | 'paid' | 'failed', reference: string | null, note: string | null, payout?: RzpPayout) {
  const { error } = await db.rpc('complete_payout', {
    p_payout_request_id: requestId,
    p_actor_id: null,
    p_action: action,
    p_provider: 'razorpayx',
    p_reference: reference,
    p_note: note,
    p_metadata: payout ? { razorpayx: { id: payout.id, status: payout.status, utr: payout.utr ?? null } } : {},
  })
  if (error) throw error
}

/** Payouts sent earlier: ask RazorpayX how they went. */
async function sync(db: Db) {
  const { data, error } = await db
    .from('payout_requests')
    .select('id, creator:creators(profile:profiles(is_test)), payout_transactions(provider, provider_reference, status, created_at)')
    .eq('status', 'processing')
    .order('updated_at', { ascending: true })
    .limit(SYNC_LIMIT)
  if (error) throw error
  let paid = 0
  let failed = 0
  for (const row of (data ?? []) as unknown as {
    id: string
    creator: { profile: { is_test: boolean } | null } | null
    payout_transactions: { provider: string; provider_reference: string | null; status: string; created_at: string }[]
  }[]) {
    const txn = row.payout_transactions
      .filter((t) => t.provider === 'razorpayx' && t.status === 'processing' && t.provider_reference)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    if (!txn) continue
    const mode: RazorpayMode = row.creator?.profile?.is_test ? 'test' : 'live'
    if (!razorpayXConfigured(mode)) continue
    try {
      const payout = await razorpayXFor(mode).fetchPayout(txn.provider_reference!)
      if (DONE.includes(payout.status)) {
        await complete(db, row.id, 'paid', payout.utr || payout.id, 'Paid via RazorpayX', payout)
        paid++
      } else if (FAILED.includes(payout.status)) {
        await complete(db, row.id, 'failed', payout.id, reasonOf(payout), payout)
        failed++
      }
    } catch (e) {
      console.error('auto-payouts: sync failed', row.id, e instanceof Error ? e.message : e)
    }
  }
  return { paid, failed }
}

/** Matured earnings: claim and send. */
async function send(db: Db) {
  const modes = (['live', 'test'] as RazorpayMode[]).filter((m) => razorpayXConfigured(m))
  if (modes.length === 0) return { claimed: 0, sent: 0, failed: 0, skipped: 'RAZORPAYX_NOT_CONFIGURED' }
  const { data, error } = await db.rpc('claim_auto_payouts', { p_modes: modes, p_limit: CLAIM_LIMIT })
  if (error) throw error
  const claimed = (data ?? []) as Claimed[]
  let sent = 0
  let failed = 0
  for (const c of claimed) {
    try {
      const payout = await razorpayXFor(c.mode).createPayout({
        referenceId: c.payout_request_id,
        contactReference: c.creator_id,
        amountPaise: Math.round(Number(c.amount) * 100),
        name: c.name,
        method: c.method_type,
        upi: c.upi,
        accountNumber: c.account_number,
        ifsc: c.ifsc,
        narration: 'House of Collabs payout',
      })
      if (FAILED.includes(payout.status)) {
        await complete(db, c.payout_request_id, 'failed', payout.id, reasonOf(payout), payout)
        failed++
        continue
      }
      await complete(db, c.payout_request_id, 'processing', payout.id, `Automatic payout via RazorpayX (${payout.status})`, payout)
      if (DONE.includes(payout.status)) await complete(db, c.payout_request_id, 'paid', payout.utr || payout.id, 'Paid via RazorpayX', payout)
      sent++
    } catch (e) {
      // Refused outright (bad IFSC, invalid UPI, provider error): fail it so
      // the money goes back to available and these details stop being retried.
      const message = e instanceof HttpError ? e.message.replace(/^Payment provider error: /, '') : 'RazorpayX could not be reached'
      console.error('auto-payouts: send failed', c.payout_request_id, message)
      try {
        await complete(db, c.payout_request_id, 'failed', null, message)
      } catch (inner) {
        console.error('auto-payouts: could not record failure', c.payout_request_id, inner)
      }
      failed++
    }
  }
  return { claimed: claimed.length, sent, failed }
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const secret = req.headers.get('x-webhook-secret') ?? ''
  const fromCron = !!WEBHOOK_SECRET && !!secret && safeEqual(secret, WEBHOOK_SECRET)
  if (!fromCron) await requireAdmin(req)
  const body = await readJson<{ action?: string }>(req).catch(() => ({ action: 'run' }))
  const db = adminClient()

  if (body.action === 'status') {
    const { data } = await db.from('platform_settings').select('key, value').in('key', ['auto_payouts_enabled', 'earning_hold_hours'])
    const setting = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
    return json({
      enabled: setting.auto_payouts_enabled === true,
      hold_hours: Number(setting.earning_hold_hours ?? 24),
      live_configured: razorpayXConfigured('live'),
      test_configured: razorpayXConfigured('test'),
    })
  }

  const synced = await sync(db)
  const result = await send(db)
  return json({ ok: true, synced, ...result })
})
