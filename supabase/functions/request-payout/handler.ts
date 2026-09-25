// POST { notes? } — creator requests a payout of their full available balance.
// Balance, minimum amount, payout method and one-open-request rules are all
// enforced atomically in `create_payout_request` (service-only).
import { handler, HttpError, json, must, readJson } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const user = await requireUser(req)
  const body = await readJson<{ notes?: unknown }>(req).catch(() => ({ notes: undefined }))
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null

  const db = adminClient()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'creator') throw new HttpError(403, 'Only creators can request payouts.', 'CREATOR_REQUIRED')

  const request = must(await db.rpc('create_payout_request', { p_profile_id: user.id, p_notes: notes }))
  return json({ payout_request: request }, 201)
})
