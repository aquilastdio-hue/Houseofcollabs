// Admin payout processing.
// POST { payout_request_id, action: 'processing'|'paid'|'failed'|'rejected'|'razorpayx', reference?, note? }
//  - manual: admin transfers via bank/UPI and records the UTR/reference
//  - razorpayx: initiates a RazorpayX payout; the webhook marks it paid/failed
import { handler, HttpError, json, must, readJson, requireUuid } from '../_shared/http.ts'
import { adminClient, requireAdmin } from '../_shared/supabase.ts'
import { razorpay, razorpayXConfigured } from '../_shared/razorpay.ts'

const ACTIONS = ['processing', 'paid', 'failed', 'rejected', 'razorpayx'] as const
type Action = (typeof ACTIONS)[number]

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const admin = await requireAdmin(req)
  const body = await readJson<Record<string, unknown>>(req)
  const id = requireUuid(body.payout_request_id, 'payout_request_id')
  const action = body.action as Action
  if (!ACTIONS.includes(action)) throw new HttpError(400, 'Unknown action.', 'BAD_REQUEST')
  const reference = typeof body.reference === 'string' ? body.reference.trim().slice(0, 120) : null
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null
  const db = adminClient()

  if (action !== 'razorpayx') {
    const result = must(
      await db.rpc('complete_payout', {
        p_payout_request_id: id,
        p_actor_id: admin.id,
        p_action: action,
        p_provider: 'manual',
        p_reference: reference,
        p_note: note,
        p_metadata: {},
      }),
    )
    return json({ ok: true, payout_request: result })
  }

  if (!razorpayXConfigured()) throw new HttpError(503, 'RazorpayX is not configured. Set RAZORPAYX_ACCOUNT_NUMBER and Razorpay keys.', 'RAZORPAYX_NOT_CONFIGURED')

  const request = must(
    await db.from('payout_requests').select('id, creator_id, amount, status, creator:creators(display_name)').eq('id', id).maybeSingle(),
  ) as { id: string; creator_id: string; amount: number; status: string; creator: { display_name: string } | null } | null
  if (!request) throw new HttpError(404, 'Payout request not found.', 'PAYOUT_NOT_FOUND')
  if (request.status !== 'pending') throw new HttpError(409, 'Only pending payouts can be sent.', 'INVALID_PAYOUT_STATE')

  // Service role can read the full account number (column is hidden from clients).
  const method = must(
    await db
      .from('payout_methods')
      .select('method_type, account_holder_name, upi_id, bank_account_number, ifsc_code')
      .eq('creator_id', request.creator_id)
      .maybeSingle(),
  ) as { method_type: 'upi' | 'bank_transfer'; account_holder_name: string; upi_id: string | null; bank_account_number: string | null; ifsc_code: string | null } | null
  if (!method) throw new HttpError(422, 'The creator has no payout method.', 'PAYOUT_METHOD_REQUIRED')

  const payout = await razorpay.createPayout({
    referenceId: request.id,
    amountPaise: Math.round(Number(request.amount) * 100),
    name: method.account_holder_name,
    method: method.method_type,
    upi: method.upi_id,
    accountNumber: method.bank_account_number,
    ifsc: method.ifsc_code,
    narration: 'House of Collabs creator payout',
  })

  const result = must(
    await db.rpc('complete_payout', {
      p_payout_request_id: id,
      p_actor_id: admin.id,
      p_action: 'processing',
      p_provider: 'razorpayx',
      p_reference: payout.id,
      p_note: note ?? `RazorpayX payout ${payout.id} (${payout.status})`,
      p_metadata: { razorpayx: { id: payout.id, status: payout.status } },
    }),
  )
  return json({ ok: true, payout_request: result, razorpayx: { id: payout.id, status: payout.status } })
})
