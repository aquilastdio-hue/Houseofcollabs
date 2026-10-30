// POST { role: 'creator' | 'brand', rows: ImportRow[], invite: boolean } — admin only.
//
// Admin → Creators / Brands → More → Upload CSV sends the spreadsheet here a
// few rows at a time. Each row gets a login, then `admin_import_account`
// (migration 0026) sets the account up exactly as approving its application
// would: active, onboarded, a creator's storefront published.
//
// ORDER. The login comes first (with Supabase's invite email when `invite`),
// then the database. If the database refuses the row, a login this request
// made is deleted again, so a bad row leaves nothing behind.
//
// EMAILS. Invites go through Supabase Auth's SMTP and count against its email
// rate limit. When an invite can't be sent the account is still made, without
// the email, and the row says so; that person can use "Forgot password".
import { handler, HttpError, json, readJson } from '../_shared/http.ts'
import { adminClient, requireAdmin, userClient } from '../_shared/supabase.ts'

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SET_PASSWORD_URL = `${SITE_URL}/set-password`

/** Rows per request: each one can wait on an email, and functions have a time limit. */
const MAX_ROWS = 10
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type Role = 'creator' | 'brand'
type Db = ReturnType<typeof adminClient>

export type ImportResult = {
  email: string
  status: 'created' | 'skipped' | 'failed'
  message?: string
  emailed: boolean
}

const looksAlreadyRegistered = (msg: string) => /already (been )?registered|already exists|email_exists|user already/i.test(msg)

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Only the fields the database reads, each a string of sensible length. */
function clean(raw: Record<string, unknown>) {
  return {
    email: String(raw.email ?? '')
      .trim()
      .toLowerCase(),
    name: text(raw.name, 120),
    brand_name: text(raw.brand_name, 80),
    phone: text(raw.phone, 30),
    instagram: text(raw.instagram, 200),
    followers: typeof raw.followers === 'number' && Number.isFinite(raw.followers) && raw.followers >= 0 ? String(Math.round(raw.followers)) : null,
    categories: Array.isArray(raw.categories) ? raw.categories.filter((c): c is string => typeof c === 'string').slice(0, 5) : [],
    city: text(raw.city, 80),
    state: text(raw.state, 80),
    bio: text(raw.bio, 1500),
    website: text(raw.website, 300),
    industry: text(raw.industry, 80),
  }
}

async function findAuthUserIdByEmail(db: Db, email: string): Promise<string | null> {
  // Paginate — listUsers alone is capped and can miss older accounts.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (error) {
      console.error('import: listUsers failed', error.message)
      return null
    }
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (found) return found.id
    if (data.users.length < 200) break
  }
  return null
}

/** A set-password email for a login that already existed (no invite possible). */
async function sendPasswordReset(email: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(SET_PASSWORD_URL)}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) console.error('import: reset email failed', res.status, (await res.text()).slice(0, 200))
    return res.ok
  } catch (e) {
    console.error('import: reset email threw', e instanceof Error ? e.message : String(e))
    return false
  }
}

const NOT_EMAILED =
  'Added, but the set-password email couldn’t be sent (the email limit may be reached). They can use “Forgot password” on the login page.'

async function importOne(db: Db, asAdmin: Db, role: Role, raw: Record<string, unknown>, invite: boolean): Promise<ImportResult> {
  const row = clean(raw)
  const { email } = row
  const result = (status: ImportResult['status'], message?: string, emailed = false): ImportResult => ({ email, status, message, emailed })
  if (!EMAIL_RE.test(email)) return result('failed', 'That email address doesn’t look right.')

  const { data: profile } = await db.from('profiles').select('id, role').eq('email', email).maybeSingle()
  if (profile?.role) return result('skipped', `Already has a ${profile.role} account.`)

  // One email is a creator or a brand (0024): a waiting application for the other kind would collide later.
  const other: Role = role === 'creator' ? 'brand' : 'creator'
  const { data: pending } = await db
    .from('applications')
    .select('id')
    .eq('role', other)
    .neq('status', 'rejected')
    .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
    .limit(1)
    .maybeSingle()
  if (pending) return result('skipped', `Has a ${other} application. One email can be a creator or a brand, not both.`)

  let userId: string | null = profile?.id ?? null
  let created = false
  let emailed = false
  const meta = { full_name: row.name ?? row.brand_name, role }

  if (!userId && invite) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: SET_PASSWORD_URL,
      data: meta,
    })
    if (!error && data.user) {
      userId = data.user.id
      created = true
      emailed = true
    } else if (error && looksAlreadyRegistered(error.message)) {
      userId = await findAuthUserIdByEmail(db, email)
    } else {
      console.error('import: invite failed', error?.message)
    }
  }
  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: meta,
    })
    if (!error && data.user) {
      userId = data.user.id
      created = true
    } else if (error && looksAlreadyRegistered(error.message)) {
      userId = await findAuthUserIdByEmail(db, email)
    } else {
      console.error('import: createUser failed', error?.message)
      return result('failed', 'Couldn’t create the login. Try this row again.')
    }
  }
  if (!userId) return result('failed', 'That email has a login we can’t read.')

  const { error } = await asAdmin.rpc('admin_import_account', {
    p_profile_id: userId,
    p_role: role,
    p_row: row,
  })
  if (error) {
    if (created) await db.auth.admin.deleteUser(userId)
    // Our own refusals (P0001) are written for people; anything else isn't.
    if (error.code !== 'P0001') console.error('import: admin_import_account failed', error.code, error.message)
    return result('failed', error.code === 'P0001' ? error.message : 'Couldn’t set up the account. Try this row again.')
  }

  // A login that was already there gets a reset link instead of an invite.
  if (invite && !created) emailed = await sendPasswordReset(email)
  return result('created', invite && !emailed ? NOT_EMAILED : undefined, emailed)
}

export const handle = handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  await requireAdmin(req)

  const body = await readJson<{
    role?: string
    rows?: unknown
    invite?: boolean
  }>(req)
  const role = body.role
  if (role !== 'creator' && role !== 'brand') throw new HttpError(400, 'Choose creators or brands.', 'BAD_ROLE')
  if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > MAX_ROWS) {
    throw new HttpError(400, `Send between 1 and ${MAX_ROWS} rows at a time.`, 'BAD_ROWS')
  }

  const db = adminClient()
  // `admin_import_account` checks the caller is an admin, so it runs as them.
  const asAdmin = userClient(req)
  const results: ImportResult[] = []
  // One at a time: Auth and the email provider both push back on bursts.
  for (const raw of body.rows) {
    try {
      results.push(await importOne(db, asAdmin, role, raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}, body.invite !== false))
    } catch (e) {
      console.error('import: row threw', e instanceof Error ? e.message : String(e))
      results.push({
        email: String((raw as { email?: unknown })?.email ?? ''),
        status: 'failed',
        message: 'Something went wrong with this row. Try it again.',
        emailed: false,
      })
    }
  }
  return json({ results })
})
