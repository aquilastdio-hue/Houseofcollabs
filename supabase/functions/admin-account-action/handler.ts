// POST { profile_id, action: 'suspend' | 'reactivate' | 'delete', reason? }
//
// Account-level moderation that the database alone cannot do. Suspending has
// always flipped `profiles.status`, which blocks writes and shows the suspended
// screen — but the person could still *sign in*, because their Supabase Auth
// user was untouched. These actions reach into Auth as well, so a suspended
// account genuinely cannot get through the door, and a deleted one is gone.
//
// Permanent deletion is deliberately allowed to fail. Orders, earnings and
// payout requests reference creators and brands with ON DELETE RESTRICT, so
// Postgres refuses to delete anyone who has traded. That is the right
// behaviour — financial records should outlive an account — and the caller gets
// told to suspend instead rather than being offered a way to force it.
import { handler, HttpError, json, must, readJson, requireUuid } from '../_shared/http.ts'
import { adminClient, audit, requireAdmin, userClient } from '../_shared/supabase.ts'

const ACTIONS = ['suspend', 'reactivate', 'delete'] as const
type Action = (typeof ACTIONS)[number]

/** Supabase has no "forever"; a century is the usual stand-in. */
const BAN_FOREVER = '876000h'

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const admin = await requireAdmin(req)
  const body = await readJson<Record<string, unknown>>(req)
  const profileId = requireUuid(body.profile_id, 'profile_id')
  const action = body.action as Action
  if (!ACTIONS.includes(action)) throw new HttpError(400, 'Unknown action.', 'BAD_REQUEST')
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

  // An admin locking themselves out would need another admin to undo it, and
  // there may not be one.
  if (profileId === admin.id) {
    throw new HttpError(422, 'You cannot do this to your own account.', 'SELF_ACTION')
  }

  const db = adminClient()
  const target = must(
    await db.from('profiles').select('id, email, full_name, status').eq('id', profileId).maybeSingle(),
  ) as { id: string; email: string | null; full_name: string | null; status: string } | null
  if (!target) throw new HttpError(404, 'That account no longer exists.', 'NOT_FOUND')

  // Never let the last admin be removed or locked out.
  const { count: adminCount } = await db.from('admin_users').select('profile_id', { count: 'exact', head: true })
  const { data: isAdmin } = await db.from('admin_users').select('profile_id').eq('profile_id', profileId).maybeSingle()
  if (isAdmin && (adminCount ?? 0) <= 1) {
    throw new HttpError(422, 'This is the only admin account. Make someone else an admin first.', 'LAST_ADMIN')
  }

  if (action === 'delete') {
    const { error } = await db.auth.admin.deleteUser(profileId)
    if (error) {
      // Postgres raises 23503 when orders, earnings or payouts still point at
      // them. Say what to do instead of surfacing a constraint name.
      const message = String(error.message ?? '')
      if (/foreign key|violates|23503/i.test(message)) {
        throw new HttpError(
          409,
          'This account has orders, earnings or payouts on it, so it cannot be deleted — its records are part of the platform’s financial history. Suspend it instead.',
          'HAS_FINANCIAL_HISTORY',
        )
      }
      throw new HttpError(502, 'That account could not be deleted. Please try again.', 'DELETE_FAILED')
    }
    // The profile row goes with the auth user (ON DELETE CASCADE), so this is
    // written against the id rather than a row that still exists.
    await audit(admin.id, 'account_deleted', 'profile', profileId, {
      email: target.email,
      full_name: target.full_name,
      reason,
    })
    return json({ ok: true, action, deleted: true })
  }

  const banned = action === 'suspend'
  const { error: authError } = await db.auth.admin.updateUserById(profileId, {
    ban_duration: banned ? BAN_FOREVER : 'none',
  })
  if (authError) throw new HttpError(502, 'That account could not be updated. Please try again.', 'AUTH_UPDATE_FAILED')

  // Through the caller's own JWT, not the service role: `admin_set_user_status`
  // guards itself with `require_admin()`, which reads `auth.uid()` — and the
  // service role has none, so it would be refused.
  //
  // It is also the right actor to record: the audit entry names whoever pressed
  // the button, not "the server".
  must(
    await userClient(req).rpc('admin_set_user_status', {
      p_profile_id: profileId,
      p_status: banned ? 'suspended' : 'active',
      p_reason: reason || undefined,
    }),
  )

  return json({ ok: true, action, status: banned ? 'suspended' : 'active' })
})
