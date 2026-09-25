import { supabase } from '@/lib/supabase/client'
import { AppError, toAppError, unwrap } from '@/lib/errors'
import { uploadFile } from '@/lib/supabase/storage'
import { validateFile } from '@/lib/validation/files'
import { uuid, fileExtension } from '@/lib/utils'
import { invokeFunction } from '@/lib/supabase/functions'
import type { TablesInsert } from '@/types'

export type ApplicationRole = 'brand' | 'creator'
export type ApplicationStatus = 'new' | 'reviewing' | 'approved' | 'rejected'

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
  creators: number
  brands: number
  new_7d: number
}

export async function getApplicationStats(): Promise<ApplicationStats> {
  return unwrap(await supabase.rpc('admin_application_stats')) as unknown as ApplicationStats
}

const range = (page: number, pageSize: number) => [(page - 1) * pageSize, page * pageSize - 1] as const

export async function listApplications(p: {
  role?: ApplicationRole | ''
  status?: ApplicationStatus | ''
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
  if (p.status) q = q.eq('status', p.status)
  if (p.search?.trim()) {
    const term = p.search.trim().replace(/[%,()]/g, '')
    q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,brand_name.ilike.%${term}%,social_handle.ilike.%${term}%`)
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
  created: boolean
  role: ApplicationRole
  emailed: boolean
  emailError: string | null
  inviteLink: string | null
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
