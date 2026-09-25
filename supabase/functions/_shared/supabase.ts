// Supabase clients for Edge Functions. The service-role client exists only on
// the server; it is never exposed to browsers.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'
import { HttpError } from './http.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

let admin: SupabaseClient | null = null

/** Service-role client: bypasses RLS. Use only after authorising the caller. */
export function adminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new HttpError(500, 'Server is not configured.', 'MISCONFIGURED')
  admin ??= createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  return admin
}

/** Client acting as the calling user (RLS applies) — forwards their JWT. */
export function userClient(req: Request): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
}

/** Public (anon) client for read-only public data. */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function bearer(req: Request) {
  return (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
}

/** Verifies the caller's access token with Supabase Auth. */
export async function requireUser(req: Request): Promise<User> {
  const token = bearer(req)
  if (!token) throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED')
  const { data, error } = await adminClient().auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'AUTH_REQUIRED')
  const { data: profile } = await adminClient().from('profiles').select('status').eq('id', data.user.id).maybeSingle()
  if (!profile || profile.status !== 'active') throw new HttpError(403, 'Your account is not active.', 'ACCOUNT_INACTIVE')
  return data.user
}

/** Requires an active row in admin_users (the single source of admin rights). */
export async function requireAdmin(req: Request): Promise<User> {
  const user = await requireUser(req)
  const { data } = await adminClient().from('admin_users').select('id').eq('profile_id', user.id).eq('active', true).maybeSingle()
  if (!data) throw new HttpError(403, 'Admin access required.', 'ADMIN_REQUIRED')
  return user
}

export async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  const { error } = await adminClient().rpc('create_audit_log', {
    p_actor_id: actorId,
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_metadata: metadata,
  })
  if (error) console.error('audit log failed', error.message)
}
