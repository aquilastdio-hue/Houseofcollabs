import type { QueryData } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { toAppError, unwrap } from '@/lib/errors'
import { invokeFunction } from '@/lib/supabase/functions'
import { signedUrl } from '@/lib/supabase/storage'
import type { CreatorRequirements } from './creators.service'
import { sanitizeFilter } from './orders.service'
import type {
  AccountStatus,
  AdminDashboardStats,
  CreatorStatus,
  DisputeStatus,
  Json,
  OrderStatus,
  PaymentStatus,
  PayoutStatus,
  ReportStatus,
  ReportTarget,
  TablesInsert,
  TablesUpdate,
} from '@/types'

const range = (page: number, pageSize: number) => [(page - 1) * pageSize, page * pageSize - 1] as const

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export async function getDashboardStats(): Promise<AdminDashboardStats> {
  return unwrap(await supabase.rpc('admin_dashboard_stats')) as unknown as AdminDashboardStats
}

export async function getTimeseries(days = 30) {
  return unwrap(await supabase.rpc('admin_timeseries', { p_days: days })) ?? []
}

// ---------------------------------------------------------------------------
// Creators
// ---------------------------------------------------------------------------
export type AdminCreatorParams = {
  search?: string
  status?: CreatorStatus | ''
  verified?: boolean
  featured?: boolean
  includeDeleted?: boolean
  sort?: string
  page?: number
  pageSize?: number
}

export async function listCreators(p: AdminCreatorParams) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  const items =
    unwrap(
      await supabase.rpc('admin_list_creators', {
        p_search: p.search || undefined,
        p_status: p.status || undefined,
        p_verified: p.verified,
        p_featured: p.featured,
        p_include_deleted: p.includeDeleted ?? false,
        p_sort: p.sort ?? 'newest',
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      }),
    ) ?? []
  return { items, total: Number(items[0]?.total_count ?? 0), page, pageSize }
}

const ADMIN_CREATOR_SELECT = `
  *,
  profile:profiles ( id, email, full_name, status, created_at, last_seen_at ),
  creator_type_info:creator_types ( slug, name ),
  creator_categories ( is_primary, category:categories ( id, name, slug ) ),
  creator_languages ( id, language ),
  creator_social_accounts ( * ),
  creator_services ( *, service_addons ( * ) ),
  portfolio_items ( * )
`
const adminCreatorQuery = () => supabase.from('creators').select(ADMIN_CREATOR_SELECT)
export type AdminCreatorDetail = QueryData<ReturnType<typeof adminCreatorQuery>>[number]

export async function getCreator(id: string): Promise<AdminCreatorDetail | null> {
  return unwrap(await adminCreatorQuery().eq('id', id).maybeSingle())
}

export async function setCreatorStatus(id: string, status: CreatorStatus, reason?: string) {
  return unwrap(await supabase.rpc('admin_set_creator_status', { p_creator_id: id, p_status: status, p_reason: reason }))
}

export async function setCreatorFlags(id: string, flags: { verified?: boolean; featured?: boolean }) {
  return unwrap(await supabase.rpc('admin_set_creator_flags', { p_creator_id: id, p_verified: flags.verified, p_featured: flags.featured }))
}

export async function updateCreator(
  id: string,
  patch: Partial<{ display_name: string; headline: string; bio: string; city: string; state: string; creator_type: string; available: boolean; response_time: string }>,
) {
  return unwrap(await supabase.rpc('admin_update_creator', { p_creator_id: id, p_patch: patch as Json }))
}

export async function softDeleteCreator(id: string, reason?: string) {
  return unwrap(await supabase.rpc('admin_soft_delete_creator', { p_creator_id: id, p_reason: reason }))
}

export async function restoreCreator(id: string) {
  return unwrap(await supabase.rpc('admin_restore_creator', { p_creator_id: id }))
}

// ---------------------------------------------------------------------------
// Brands & accounts
// ---------------------------------------------------------------------------
export async function listBrands(p: { search?: string; status?: AccountStatus | ''; sort?: string; page?: number; pageSize?: number }) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  const items =
    unwrap(
      await supabase.rpc('admin_list_brands', {
        p_search: p.search || undefined,
        p_status: p.status || undefined,
        p_sort: p.sort ?? 'newest',
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      }),
    ) ?? []
  return { items, total: Number(items[0]?.total_count ?? 0), page, pageSize }
}

const ADMIN_BRAND_SELECT = `*, profile:profiles ( id, email, full_name, status, created_at, last_seen_at, phone )`
const adminBrandQuery = () => supabase.from('brands').select(ADMIN_BRAND_SELECT)
export type AdminBrandDetail = QueryData<ReturnType<typeof adminBrandQuery>>[number]

export async function getBrand(id: string): Promise<AdminBrandDetail | null> {
  return unwrap(await adminBrandQuery().eq('id', id).maybeSingle())
}

export async function updateBrand(
  id: string,
  patch: Partial<{ brand_name: string; description: string; industry: string; location: string; website_url: string; instagram_url: string; contact_email: string; contact_phone: string }>,
) {
  return unwrap(await supabase.rpc('admin_update_brand', { p_brand_id: id, p_patch: patch as Json }))
}

export async function setUserStatus(profileId: string, status: AccountStatus, reason?: string) {
  return unwrap(await supabase.rpc('admin_set_user_status', { p_profile_id: profileId, p_status: status, p_reason: reason }))
}

// ---------------------------------------------------------------------------
// Orders & payments
// ---------------------------------------------------------------------------
const ADMIN_ORDER_SELECT = `
  id, order_number, status, service_title, total_amount, platform_fee_amount, creator_earning_amount, currency,
  created_at, paid_at, completed_at, refund_required,
  brand:brands ( id, brand_name, brand_logo_url ),
  creator:creators ( id, display_name, slug, profile_image_url ),
  payments ( id, status, amount, refunded_amount )
`
const adminOrderListQuery = () => supabase.from('orders').select(ADMIN_ORDER_SELECT, { count: 'exact' })
export type AdminOrderListItem = QueryData<ReturnType<typeof adminOrderListQuery>>[number]

export type AdminOrderParams = {
  statuses?: OrderStatus[]
  search?: string
  brandId?: string
  creatorId?: string
  from?: string
  to?: string
  minAmount?: number
  maxAmount?: number
  paymentStatus?: PaymentStatus | ''
  refundRequired?: boolean
  page?: number
  pageSize?: number
}

export async function listOrders(p: AdminOrderParams) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  const select = p.paymentStatus ? ADMIN_ORDER_SELECT.replace('payments (', 'payments!inner (') : ADMIN_ORDER_SELECT
  let q = supabase
    .from('orders')
    .select(select as typeof ADMIN_ORDER_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(...range(page, pageSize))
  if (p.statuses?.length) q = q.in('status', p.statuses)
  if (p.brandId) q = q.eq('brand_id', p.brandId)
  if (p.creatorId) q = q.eq('creator_id', p.creatorId)
  if (p.from) q = q.gte('created_at', p.from)
  if (p.to) q = q.lte('created_at', p.to)
  if (p.minAmount !== undefined) q = q.gte('total_amount', p.minAmount)
  if (p.maxAmount !== undefined) q = q.lte('total_amount', p.maxAmount)
  if (p.refundRequired) q = q.eq('refund_required', true)
  if (p.paymentStatus) q = q.eq('payments.status', p.paymentStatus)
  const s = p.search ? sanitizeFilter(p.search) : ''
  if (s) q = q.or(`order_number.ilike.*${s}*,service_title.ilike.*${s}*`)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: (data ?? []) as AdminOrderListItem[], total: count ?? 0, page, pageSize }
}

export async function listPaymentRefunds(orderId: string) {
  return unwrap(
    await supabase
      .from('payment_refunds')
      .select('id, payment_id, order_id, amount, provider_refund_id, status, reason, created_at, updated_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
  )
}

export type OrderAdminAction =
  | { action: 'refund'; amount?: number; reason: string }
  | { action: 'cancel'; reason: string }
  | { action: 'force_complete'; reason: string }
  | { action: 'set_status'; status: OrderStatus; reason: string }
  | { action: 'resolve_dispute'; dispute_id: string; outcome: 'release_to_creator' | 'resume_order' | 'rejected' | 'refund_brand' | 'partial_refund'; note: string; amount?: number }

export function orderAction(orderId: string, payload: OrderAdminAction) {
  return invokeFunction<{ ok: true; order: unknown }>('admin-order-action', { order_id: orderId, ...payload })
}

const ADMIN_PAYMENT_SELECT = `
  id, order_id, payer_id, amount, currency, provider, provider_order_id, provider_payment_id, status, method,
  error_code, error_description, refunded_amount, captured_at, created_at,
  order:orders ( id, order_number, service_title, brand:brands ( id, brand_name ), creator:creators ( id, display_name ) )
`
export async function listPayments(p: { status?: PaymentStatus | ''; search?: string; page?: number; pageSize?: number }) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  let q = supabase.from('payments').select(ADMIN_PAYMENT_SELECT, { count: 'exact' }).order('created_at', { ascending: false }).range(...range(page, pageSize))
  if (p.status) q = q.eq('status', p.status)
  const s = p.search ? sanitizeFilter(p.search) : ''
  if (s) q = q.or(`provider_order_id.ilike.*${s}*,provider_payment_id.ilike.*${s}*`)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}
export type AdminPaymentItem = Awaited<ReturnType<typeof listPayments>>['items'][number]

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------
const ADMIN_PAYOUT_SELECT = `
  *,
  creator:creators ( id, display_name, slug, profile_image_url ),
  payout_transactions ( * ),
  creator_earnings ( id, order_id, net_amount )
`
export async function listPayouts(p: { status?: PayoutStatus | ''; page?: number; pageSize?: number }) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  let q = supabase.from('payout_requests').select(ADMIN_PAYOUT_SELECT, { count: 'exact' }).order('created_at', { ascending: false }).range(...range(page, pageSize))
  if (p.status) q = q.eq('status', p.status)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}
export type AdminPayoutItem = Awaited<ReturnType<typeof listPayouts>>['items'][number]

export function processPayout(payload: {
  payout_request_id: string
  action: 'processing' | 'paid' | 'failed' | 'rejected' | 'razorpayx'
  reference?: string
  note?: string
}) {
  return invokeFunction<{ ok: true }>('process-payout', payload)
}

export async function revealPayoutMethod(payoutRequestId: string) {
  return unwrap(await supabase.rpc('admin_reveal_payout_method', { p_payout_request_id: payoutRequestId })) as unknown as {
    method_type: string
    account_holder_name: string
    upi_id: string | null
    bank_account_number: string | null
    ifsc_code: string | null
    bank_name: string | null
  }
}

// ---------------------------------------------------------------------------
// Disputes, reports, moderation
// ---------------------------------------------------------------------------
const ADMIN_DISPUTE_SELECT = `
  *,
  order:orders ( id, order_number, status, service_title, total_amount,
                 brand:brands ( id, brand_name, brand_logo_url ), creator:creators ( id, display_name, profile_image_url ) )
`
export async function listDisputes(p: { status?: DisputeStatus | '' | 'open'; page?: number; pageSize?: number }) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  let q = supabase.from('disputes').select(ADMIN_DISPUTE_SELECT, { count: 'exact' }).order('created_at', { ascending: false }).range(...range(page, pageSize))
  if (p.status === 'open') q = q.in('status', ['created', 'under_review', 'waiting_for_brand', 'waiting_for_creator'])
  else if (p.status) q = q.eq('status', p.status)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}
export type AdminDisputeItem = Awaited<ReturnType<typeof listDisputes>>['items'][number]

export async function getDispute(id: string) {
  return unwrap(
    await supabase
      .from('disputes')
      .select(`${ADMIN_DISPUTE_SELECT}, dispute_messages ( * )`)
      .eq('id', id)
      .order('created_at', { referencedTable: 'dispute_messages', ascending: true })
      .maybeSingle(),
  )
}

export async function updateDispute(id: string, status: DisputeStatus, note?: string) {
  return unwrap(await supabase.rpc('admin_update_dispute', { p_dispute_id: id, p_status: status, p_note: note }))
}

export async function listReports(p: { status?: ReportStatus | ''; targetType?: ReportTarget | ''; page?: number; pageSize?: number }) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  let q = supabase
    .from('reports')
    .select('*, reporter:profiles!reports_reported_by_fkey ( id, full_name, email, role )', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(...range(page, pageSize))
  if (p.status) q = q.eq('status', p.status)
  if (p.targetType) q = q.eq('target_type', p.targetType)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}
export type AdminReportItem = Awaited<ReturnType<typeof listReports>>['items'][number]

export async function updateReport(id: string, status: ReportStatus, note?: string) {
  return unwrap(await supabase.rpc('admin_update_report', { p_report_id: id, p_status: status, p_note: note }))
}

export async function listReviews(p: { status?: 'published' | 'hidden' | ''; page?: number; pageSize?: number }) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  let q = supabase
    .from('reviews')
    .select('*, creator:creators ( id, display_name, slug ), brand:brands ( id, brand_name )', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(...range(page, pageSize))
  if (p.status) q = q.eq('status', p.status)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

export async function moderateReview(id: string, status: 'published' | 'hidden') {
  return unwrap(await supabase.rpc('admin_moderate_review', { p_review_id: id, p_status: status }))
}

export async function listPortfolioItems(p: { hidden?: boolean; page?: number; pageSize?: number }) {
  const pageSize = p.pageSize ?? 24
  const page = Math.max(1, p.page ?? 1)
  let q = supabase
    .from('portfolio_items')
    .select('*, creator:creators ( id, display_name, slug )', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(...range(page, pageSize))
  if (p.hidden !== undefined) q = q.eq('is_hidden', p.hidden)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

export async function moderatePortfolioItem(id: string, hidden: boolean) {
  return unwrap(await supabase.rpc('admin_moderate_portfolio_item', { p_item_id: id, p_hidden: hidden }))
}

export async function listContactMessages(p: { status?: 'new' | 'read' | 'archived' | ''; page?: number; pageSize?: number }) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  let q = supabase.from('contact_messages').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(...range(page, pageSize))
  if (p.status) q = q.eq('status', p.status)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

export async function updateContactMessage(id: string, status: 'new' | 'read' | 'archived') {
  unwrap(await supabase.rpc('admin_update_contact_message', { p_id: id, p_status: status }))
}

export async function broadcastNotification(audience: 'all' | 'brands' | 'creators', title: string, message: string, actionUrl?: string) {
  return unwrap(
    await supabase.rpc('admin_broadcast_notification', { p_audience: audience, p_title: title, p_message: message, p_action_url: actionUrl }),
  )
}

export async function listAnnouncements(page = 1, pageSize = 20) {
  const { data, error, count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('action', 'notification_broadcast')
    .order('created_at', { ascending: false })
    .range(...range(page, pageSize))
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

// ---------------------------------------------------------------------------
// Taxonomies & settings
// ---------------------------------------------------------------------------
export async function listAllCategories() {
  return unwrap(await supabase.from('categories').select('*').order('sort_order').order('name'))
}

export async function createCategory(input: Omit<TablesInsert<'categories'>, 'id' | 'created_at' | 'updated_at'>) {
  return unwrap(await supabase.from('categories').insert(input).select('*').single())
}

export async function updateCategory(id: string, patch: TablesUpdate<'categories'>) {
  return unwrap(await supabase.from('categories').update(patch).eq('id', id).select('*').single())
}

export async function deleteCategory(id: string) {
  unwrap(await supabase.from('categories').delete().eq('id', id))
}

export async function listAllCreatorTypes() {
  return unwrap(await supabase.from('creator_types').select('*').order('sort_order'))
}

export async function upsertCreatorType(input: TablesInsert<'creator_types'>) {
  return unwrap(await supabase.from('creator_types').upsert(input).select('*').single())
}

export async function deleteCreatorType(slug: string) {
  unwrap(await supabase.from('creator_types').delete().eq('slug', slug))
}

export async function listSettings() {
  return unwrap(await supabase.from('platform_settings').select('*').order('key'))
}

export async function updateSetting(key: string, value: Json) {
  return unwrap(await supabase.rpc('admin_update_setting', { p_key: key, p_value: value }))
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------
export async function listAuditLogs(p: { action?: string; entityType?: string; actorId?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
  const pageSize = p.pageSize ?? 50
  const page = Math.max(1, p.page ?? 1)
  let q = supabase
    .from('audit_logs')
    .select('*, actor:profiles ( id, full_name, email, role )', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(...range(page, pageSize))
  if (p.action) q = q.ilike('action', `%${sanitizeFilter(p.action)}%`)
  if (p.entityType) q = q.eq('entity_type', p.entityType)
  if (p.actorId) q = q.eq('actor_id', p.actorId)
  if (p.from) q = q.gte('created_at', p.from)
  if (p.to) q = q.lte('created_at', p.to)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}
export type AuditLogItem = Awaited<ReturnType<typeof listAuditLogs>>['items'][number]

// ---------------------------------------------------------------------------
// People directory + activity (admin_people_stats / admin_list_people)
// ---------------------------------------------------------------------------

/** Account totals, DAU/WAU/MAU and the pending-work queues. */
export type PeopleStats = {
  users_total: number
  users_active: number
  users_suspended: number
  new_7d: number
  new_30d: number
  dau: number
  wau: number
  mau: number
  by_role: Record<string, number>
  creators_total: number
  creators_published: number
  creators_verified: number
  creators_pending: number
  brands_total: number
  brands_active: number
  onboarding_done: number
  contact_open: number
  reports_open: number
  disputes_open: number
  payouts_pending: number
}

export async function getPeopleStats(): Promise<PeopleStats> {
  return unwrap(await supabase.rpc('admin_people_stats')) as unknown as PeopleStats
}

export type PeopleParams = {
  search?: string
  role?: '' | 'brand' | 'creator' | 'admin' | 'unassigned'
  status?: AccountStatus | ''
  sort?: 'recent' | 'oldest' | 'name' | 'active' | 'value'
  page?: number
  pageSize?: number
}

export async function listPeople(p: PeopleParams) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  const rows = unwrap(
    await supabase.rpc('admin_list_people', {
      p_search: p.search?.trim() || undefined,
      p_role: p.role || undefined,
      p_status: p.status || undefined,
      p_sort: p.sort ?? 'recent',
      p_page: page,
      p_page_size: pageSize,
    }),
  )
  // total_count is repeated on every row by the window count; 0 rows => 0 total.
  const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0
  return { items: rows, total, page, pageSize }
}

export type PersonRow = Awaited<ReturnType<typeof listPeople>>['items'][number]

// ---------------------------------------------------------------------------
// Revenue rollup (admin_revenue_summary)
// ---------------------------------------------------------------------------
export type RevenueSummary = {
  gross: { today: number; week: number; month: number; year: number; all: number }
  platform_fee: { month: number; year: number; all: number }
  creator_earnings: { available: number; pending: number; paid: number; gross: number }
  payouts: { pending_count: number; pending_amount: number; paid_amount: number }
  refunds: { count: number; amount: number }
  payments_by_status: Record<string, number>
  failed_payments: number
}

export async function getRevenueSummary(): Promise<RevenueSummary> {
  return unwrap(await supabase.rpc('admin_revenue_summary')) as unknown as RevenueSummary
}

// ---------------------------------------------------------------------------
// Briefs (campaigns). Admins can read every brief through RLS, so this is a
// plain query rather than an RPC.
// ---------------------------------------------------------------------------
const adminBriefQuery = () =>
  supabase
    .from('briefs')
    // Must stay a single string literal: QueryData infers the row shape from
    // the literal type, and concatenation widens it to `string`.
    .select(
      'id, title, status, budget, deadline, platform, content_type, created_at, sent_at, brand:brands ( id, brand_name, brand_logo_url ), creator:creators ( id, display_name, profile_image_url )',
      { count: 'exact' },
    )

export type AdminBriefItem = QueryData<ReturnType<typeof adminBriefQuery>>[number]

export type BriefStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'completed'

export async function listBriefs(p: { status?: BriefStatus | ''; search?: string; page?: number; pageSize?: number }) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  let q = adminBriefQuery().order('created_at', { ascending: false }).range(...range(page, pageSize))
  if (p.status) q = q.eq('status', p.status)
  if (p.search?.trim()) q = q.ilike('title', `%${sanitizeFilter(p.search.trim())}%`)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

// ---------------------------------------------------------------------------
// Email delivery log. Rows are written by the database (trigger) and the
// send-notification function; the client only ever reads them.
// ---------------------------------------------------------------------------
export type EmailStats = {
  total: number
  sent: number
  pending: number
  failed: number
  skipped: number
  retryable: number
  exhausted: number
  sent_24h: number
  failed_24h: number
  by_category: Record<string, number>
  provider: string | null
  last_sent_at: string | null
  /** False when the database has no pg_net/Vault and cannot call the function. */
  auto_dispatch: boolean
}

export async function getEmailStats(): Promise<EmailStats> {
  return unwrap(await supabase.rpc('admin_email_stats')) as unknown as EmailStats
}

export type EmailDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'skipped'

const adminEmailQuery = () =>
  supabase
    .from('email_deliveries')
    // Single string literal — see the note on adminBriefQuery.
    .select(
      'id, recipient_email, email_type, category, subject, status, provider, provider_message_id, attempts, max_attempts, last_error, next_attempt_at, created_at, sent_at, user:profiles ( id, full_name, role )',
      { count: 'exact' },
    )

export type AdminEmailItem = QueryData<ReturnType<typeof adminEmailQuery>>[number]

export async function listEmailDeliveries(p: {
  status?: EmailDeliveryStatus | ''
  category?: string
  search?: string
  page?: number
  pageSize?: number
}) {
  const pageSize = p.pageSize ?? 25
  const page = Math.max(1, p.page ?? 1)
  let q = adminEmailQuery().order('created_at', { ascending: false }).range(...range(page, pageSize))
  if (p.status) q = q.eq('status', p.status)
  if (p.category) q = q.eq('category', p.category)
  if (p.search?.trim()) {
    const term = sanitizeFilter(p.search.trim())
    q = q.or(`recipient_email.ilike.%${term}%,subject.ilike.%${term}%,email_type.ilike.%${term}%`)
  }
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

/**
 * Asks the send-notification function to drain whatever is queued. It only
 * re-sends deliveries the database already approved, so it can't be used to
 * mail someone who opted out.
 */
export function retryQueuedEmails(limit = 50) {
  return invokeFunction<{ claimed: number; sent: number }>('send-notification', { retry: true, limit })
}

export type EmailPreview = {
  to: string
  inAppOnly: boolean
  subject: string | null
  html: string | null
  text: string | null
}

/**
 * Renders a logged email exactly as the recipient sees it. Read-only — the
 * function sends nothing on this path and can only render a row the database
 * already queued, so it cannot be used to mail an arbitrary address.
 */
export function previewEmail(deliveryId: string) {
  return invokeFunction<EmailPreview>('send-notification', { preview: deliveryId })
}

/** Sends one test email to the signed-in admin's own address. */
export function sendTestEmail() {
  return invokeFunction<{ ok: boolean; provider: string }>('send-notification', { test: true })
}

// ---------------------------------------------------------------------------
// Progressive setup: what a creator has provided beyond signup, and the
// identity checks waiting on a decision.
// ---------------------------------------------------------------------------
export async function getCreatorSetup(creatorId: string): Promise<CreatorRequirements> {
  return unwrap(await supabase.rpc('get_creator_requirements', { p_creator_id: creatorId })) as unknown as CreatorRequirements
}

export async function listCreatorVerifications(creatorId: string) {
  return unwrap(
    await supabase
      .from('creator_verifications')
      .select(
        'id, status, legal_name, date_of_birth, document_type, document_number_last4, document_path, address_line, city, state, postal_code, note, review_note, reviewed_at, submitted_at',
      )
      .eq('creator_id', creatorId)
      .order('submitted_at', { ascending: false }),
  )
}

export type AdminVerification = Awaited<ReturnType<typeof listCreatorVerifications>>[number]

export async function reviewVerification(id: string, status: 'approved' | 'rejected' | 'more_info', note?: string) {
  return unwrap(await supabase.rpc('admin_review_creator_verification', { p_id: id, p_status: status, p_note: note || undefined }))
}

/** Short-lived link to an identity document. Admin-only by storage policy. */
export function verificationDocumentUrl(path: string) {
  return signedUrl('verification-documents', path, 300)
}

// ---------------------------------------------------------------------------
// Creator ranking
//
// The admin's own rating decides where a creator sits on the public creators
// page, and "Send on top" overrides it. Both live in `creator_rankings`, which
// has no grants to anon or authenticated — these RPCs are the only way to read
// or write them, so a rating can never reach the creator it describes.
// ---------------------------------------------------------------------------
export type CreatorRanking = {
  id: string
  slug: string
  display_name: string
  profile_image_url: string | null
  city: string | null
  status: CreatorStatus
  verified: boolean
  featured: boolean
  followers_count: number
  rating: number
  review_count: number
  admin_rating: number | null
  pinned_at: string | null
  /** Hand-placed position from dragging; null means the automatic order applies. */
  sort_order: number | null
  rank_position: number
  total_count: number
}

export async function listCreatorRankings(p: {
  search?: string
  status?: CreatorStatus | ''
  page?: number
  pageSize?: number
}) {
  const pageSize = p.pageSize ?? 50
  const page = Math.max(1, p.page ?? 1)
  const rows = (unwrap(
    await supabase.rpc('admin_creator_rankings', {
      p_search: p.search?.trim() || undefined,
      p_status: p.status || undefined,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
  ) ?? []) as unknown as CreatorRanking[]
  return { items: rows, total: rows[0]?.total_count ?? 0, page, pageSize }
}

/** Null clears the rating, which drops the creator back below every rated one. */
export async function setCreatorRating(creatorId: string, rating: number | null) {
  // The generated Args type says `number`, but the function accepts null to
  // clear a rating — that is what the `p_rating is not null` branch is for.
  return unwrap(await supabase.rpc('admin_set_creator_rating', { p_creator_id: creatorId, p_rating: rating as number }))
}

/** "Send on top" — and the same call with `false` takes it back down. */
export async function pinCreator(creatorId: string, pinned: boolean) {
  return unwrap(await supabase.rpc('admin_pin_creator', { p_creator_id: creatorId, p_pinned: pinned }))
}

/** The rating given while reviewing an application, before the creator exists. */
export async function rateApplication(id: string, rating: number | null) {
  return unwrap(await supabase.rpc('admin_rate_application', { p_id: id, p_rating: rating as number }))
}

/**
 * Marks an applicant for Discover while their application is still under
 * review. Sets `creators.featured` when they are approved — or immediately, if
 * they already have an account.
 */
export async function setApplicationDiscover(id: string, discover: boolean) {
  return unwrap(await supabase.rpc('admin_set_application_discover', { p_id: id, p_discover: discover }))
}

/**
 * Persists a drag on the ranking screen. The whole visible order is sent, not
 * just the row that moved, so positions cannot collide or leave gaps.
 */
export async function reorderCreators(ids: string[]) {
  return unwrap(await supabase.rpc('admin_reorder_creators', { p_ids: ids }))
}
