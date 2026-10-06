import { supabase } from '@/lib/supabase/client'
import { AppError, toAppError, unwrap } from '@/lib/errors'
import { uploadFile } from '@/lib/supabase/storage'
import { validateFile } from '@/lib/validation/files'
import { uuid, fileExtension } from '@/lib/utils'
import { invokeFunction } from '@/lib/supabase/functions'
import type { TablesInsert } from '@/types'

export type ApplicationRole = 'brand' | 'creator'
export type ApplicationStatus = 'new' | 'reviewing' | 'approved' | 'rejected'

/** Statuses that still need a decision from someone. */
/**
 * What the applications queue shows by default: only what still needs a
 * decision.
 *
 * Deciding either way takes an application off this list. Approved people have
 * accounts now, so the row's job is done. Rejected ones moved to their own
 * page — they are still worth keeping (they answer "did we already look at this
 * person?" when someone applies again), but they are not work, and leaving them
 * in the queue made it look permanently full.
 */
export const LISTED_STATUSES = ['new', 'reviewing'] as const

/** What the Status filter can ask for. `''` is the default list, `'all'` is everything. */
export type StatusFilter = ApplicationStatus | 'all' | ''

/**
 * Which statuses a filter should fetch; `null` means don't filter at all.
 *
 * Dropping the approved ones is a view decision, not a delete: the row has to
 * survive, because an approved application is what
 * `private.claim_approved_application` looks up to hand someone their role the
 * first time they sign in with Google, and what `set_initial_role` checks.
 * Deleting it would lock out the very person who was just approved. It is also
 * the audit record of who decided what, so "All statuses" still reaches it.
 */
export function statusesFor(filter: StatusFilter): readonly ApplicationStatus[] | null {
  if (filter === 'all') return null
  if (filter) return [filter]
  return LISTED_STATUSES
}

/** Only the columns an applicant may set — the rest are server-owned. */
export type ApplicationInput = Pick<
  TablesInsert<'applications'>,
  | 'role'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'city'
  | 'message'
  | 'social_platform'
  | 'social_handle'
  | 'followers_count'
  | 'categories'
  | 'bio'
  | 'portfolio_url'
  | 'video_path'
  | 'image_path'
  | 'profile'
  | 'brand_name'
  | 'website'
  | 'budget_range'
  | 'looking_for'
>

/**
 * Submits an application. Deliberately unauthenticated — anon holds an insert
 * grant on exactly these columns, and a trigger pins status/review fields and
 * caps submissions per email, so nothing here can be spoofed from the client.
 */
export async function submitApplication(input: ApplicationInput) {
  const { error } = await supabase.from('applications').insert(input)
  if (error) throw toAppError(error)
}

// ---------------------------------------------------------------------------
// Duplicate mobile number / Instagram account
// ---------------------------------------------------------------------------

/**
 * The wording is defined once and shared by the form and the database trigger
 * (migration 0061 raises these exact strings), so an applicant sees the same
 * sentence whichever one catches the duplicate.
 */
export const DUPLICATE_MESSAGES = {
  phone: 'This mobile number is already registered. Please use a different mobile number.',
  instagram: 'This Instagram ID is already registered. Please use a different Instagram ID.',
  both: 'This mobile number and Instagram ID are already registered. Please use different details.',
} as const

/** Hint codes `private.applications_before_insert` raises, via `AppError.code`. */
export const DUPLICATE_CODES = {
  phone: 'DUPLICATE_PHONE',
  instagram: 'DUPLICATE_INSTAGRAM',
  both: 'DUPLICATE_PHONE_AND_INSTAGRAM',
} as const

export type DuplicateCheck = { phone_taken: boolean; instagram_taken: boolean }

/**
 * Asks whether a mobile number or Instagram account is already registered.
 *
 * This cannot be a `select`: `applications` is insert-only for `anon` and
 * readable only by admins, which is what stops the sign-up form doubling as a
 * directory of everyone who has applied. The RPC is `security definer` and
 * answers with two booleans — never a row, never whose account it collides
 * with.
 *
 * `email` is the applicant's own address, so a half-finished earlier attempt of
 * their own never locks them out of their own number.
 */
export async function checkApplicationDuplicates(input: {
  phone?: string | null
  instagram?: string | null
  email?: string | null
}): Promise<DuplicateCheck> {
  const { data, error } = await supabase.rpc('check_application_duplicates', {
    p_phone: input.phone?.trim() || undefined,
    p_instagram: input.instagram?.trim() || undefined,
    p_email: input.email?.trim() || undefined,
  })
  if (error) throw toAppError(error)
  return (data as DuplicateCheck | null) ?? { phone_taken: false, instagram_taken: false }
}

/**
 * Uploads an application file to the private `applications` bucket and returns
 * its path. No public URL exists — admins read it through a signed link.
 */
export async function uploadApplicationFile(file: File): Promise<string> {
  const problem = validateFile('applications', file)
  if (problem) throw new AppError(problem, { kind: 'validation', code: 'INVALID_FILE' })
  const path = `${uuid()}.${fileExtension(file.name) || 'bin'}`
  const uploaded = await uploadFile('applications', path, file)
  return uploaded.path
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export type ApplicationStats = {
  total: number
  new: number
  reviewing: number
  approved: number
  rejected: number
  /** Applications by role — includes rejected ones and people never provisioned. */
  creators: number
  brands: number
  /** Accounts that actually exist right now, which is a different question. */
  live_creators: number
  live_brands: number
  new_7d: number
}

export async function getApplicationStats(): Promise<ApplicationStats> {
  return unwrap(await supabase.rpc('admin_application_stats')) as unknown as ApplicationStats
}

const range = (page: number, pageSize: number) => [(page - 1) * pageSize, page * pageSize - 1] as const

export async function listApplications(p: {
  role?: ApplicationRole | ''
  status?: StatusFilter
  search?: string
  page?: number
  pageSize?: number
}) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  let q = supabase
    .from('applications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(...range(page, pageSize))
  if (p.role) q = q.eq('role', p.role)
  const statuses = statusesFor(p.status ?? '')
  if (statuses) q = statuses.length === 1 ? q.eq('status', statuses[0]) : q.in('status', [...statuses])
  if (p.search?.trim()) {
    const term = p.search.trim().replace(/[%,()]/g, '')
    // The referral code lives in the `profile` jsonb rather than its own
    // column, so it needs the json path spelled out — searching the columns
    // alone would never find it. Stored upper-cased; `ilike` makes the search
    // box case-insensitive either way.
    q = q.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%,brand_name.ilike.%${term}%,social_handle.ilike.%${term}%,profile->>referral_code.ilike.%${term}%`,
    )
  }
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

export type ApplicationRow = Awaited<ReturnType<typeof listApplications>>['items'][number]

export async function reviewApplication(id: string, status: ApplicationStatus, note?: string) {
  return unwrap(await supabase.rpc('admin_review_application', { p_id: id, p_status: status, p_note: note || undefined }))
}

export type ApprovalResult = {
  ok: boolean
  profileId: string
  /** A brand-new auth account was made for them. */
  created: boolean
  /** Supabase sent its "Invite user" email. False when they already had an
   *  account and got a password reset instead — invites only work once. */
  invited: boolean
  alreadyHadAccount: boolean
  /** Where the emailed link points — derived from the SITE_URL secret. */
  redirectTo?: string
  role: ApplicationRole
  emailed: boolean
  emailError: string | null
  /** Only set when the email failed, for the admin to pass on by hand. */
  inviteLink: string | null
  copied?: { photos: number; videos: number; logo: number }
}

/**
 * Approves an application *and* provisions the account behind it — creating the
 * auth user needs the service role, so it runs in the `approve-application`
 * Edge Function rather than here.
 */
export function approveApplication(applicationId: string) {
  return invokeFunction<ApprovalResult>('approve-application', { applicationId })
}

/** Short-lived link to an application's uploaded file. Admin-only by policy. */
export async function applicationFileUrl(path: string) {
  const { data, error } = await supabase.storage.from('applications').createSignedUrl(path, 300)
  if (error) throw toAppError(error)
  return data.signedUrl
}

/**
 * Hands the Firebase ID token to the server, which checks its signature before
 * recording that this number was verified. The browser's own word for it is
 * worth nothing — see the `verify-phone` Edge Function.
 */
export async function verifyPhoneToken(idToken: string) {
  return invokeFunction<{ verified: boolean; phone: string }>('verify-phone', { id_token: idToken })
}
