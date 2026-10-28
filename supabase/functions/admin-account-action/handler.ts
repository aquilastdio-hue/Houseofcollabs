// POST { profile_id, action: 'suspend' | 'reactivate' | 'delete', reason? }
//
// Account-level moderation that the database alone cannot do. Suspending has
// always flipped `profiles.status`, which blocks writes and shows the suspended
// screen — but the person could still *sign in*, because their Supabase Auth
// user was untouched. These actions reach into Auth as well, so a suspended
// account genuinely cannot get through the door, and a deleted one is gone.
//
// Permanent deletion erases the person entirely -- login, profile, storefront,
// applications, phone checks, email log, contact messages and every uploaded
// file -- and is deliberately allowed to fail. Orders, earnings and
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
    // Gather what to erase before the login goes: applications are only
    // unlinked by the cascade, and files live in storage, not the database.
    const leftovers = await collectLeftovers(profileId, target.email)

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
    // The login is gone, so it's safe to erase the rest: applications, phone
    // checks, email log, contact messages, and every uploaded file.
    const { data: records, error: purgeError } = await db.rpc('purge_account_records', {
      p_profile_id: profileId,
      p_email: target.email ?? '',
      p_application_ids: leftovers.applicationIds,
    })
    if (purgeError) console.error('purge_account_records failed', purgeError.message)
    const files = await removeFiles(leftovers)

    // The profile row goes with the auth user (ON DELETE CASCADE), so this is
    // written against the id rather than a row that still exists.
    await audit(admin.id, 'account_deleted', 'profile', profileId, {
      email: target.email,
      full_name: target.full_name,
      reason,
      records: records ?? null,
      files,
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

// ------------------------------------------------------- permanent delete --

type Leftovers = {
  applicationIds: string[]
  /** Files in the private applications bucket (photos, videos, selfie, ID documents). */
  applicationFiles: string[]
  /** Per-person folders: bucket → folder name. */
  folders: { bucket: string; folder: string }[]
}

/** Application uploads are stored as `<uuid>.<ext>` at the bucket root. */
const APPLICATION_FILE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}\b/gi

async function collectLeftovers(profileId: string, email: string | null): Promise<Leftovers> {
  const db = adminClient()
  const filters = [`profile_id.eq.${profileId}`]
  // Exact match (sign-up forms store emails lower-cased); never a pattern, so an
  // underscore in an address can't match somebody else's application.
  if (email) filters.push(`email.eq."${email.trim().toLowerCase().replace(/"/g, '')}"`)
  const { data: apps } = await db.from('applications').select('id, video_path, image_path, profile').or(filters.join(','))
  const applicationFiles = new Set<string>()
  for (const a of apps ?? []) {
    for (const match of JSON.stringify([a.video_path, a.image_path, a.profile]).matchAll(APPLICATION_FILE)) {
      applicationFiles.add(match[0])
    }
  }

  const { data: creator } = await db.from('creators').select('id').eq('profile_id', profileId).maybeSingle()
  const folders = [
    { bucket: 'avatars', folder: profileId },
    { bucket: 'creator-portfolio', folder: profileId },
    { bucket: 'brand-assets', folder: profileId },
    ...(creator ? [{ bucket: 'instagram-media', folder: creator.id as string }] : []),
  ]
  return { applicationIds: (apps ?? []).map((a) => a.id as string), applicationFiles: [...applicationFiles], folders }
}

/** Best effort: a file that can't be removed is logged, never blocks the delete. */
async function removeFiles(leftovers: Leftovers): Promise<number> {
  const storage = adminClient().storage
  let removed = 0
  const remove = async (bucket: string, paths: string[]) => {
    for (let i = 0; i < paths.length; i += 100) {
      const { data, error } = await storage.from(bucket).remove(paths.slice(i, i + 100))
      if (error) console.error('remove files failed', bucket, error.message)
      removed += data?.length ?? 0
    }
  }
  // One level of subfolders is as deep as any of these buckets go.
  const listAll = async (bucket: string, folder: string): Promise<string[]> => {
    const { data } = await storage.from(bucket).list(folder, { limit: 1000 })
    const paths: string[] = []
    for (const entry of data ?? []) {
      if (entry.id) paths.push(`${folder}/${entry.name}`)
      else paths.push(...(await listAll(bucket, `${folder}/${entry.name}`)))
    }
    return paths
  }

  await remove('applications', leftovers.applicationFiles)
  for (const { bucket, folder } of leftovers.folders) await remove(bucket, await listAll(bucket, folder))
  return removed
}
