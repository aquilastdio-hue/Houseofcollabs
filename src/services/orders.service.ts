import type { QueryData } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { toAppError, unwrap } from '@/lib/errors'
import { scopedPath, signedUrl, signedUrls, uploadFile } from '@/lib/supabase/storage'
import type { Attachment, OrderQuote, OrderStatus, ShippingAddressInput } from '@/types'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const ORDER_LIST_SELECT = `
  id, order_number, status, service_title, content_type, total_amount, creator_earning_amount, currency,
  delivery_days, due_at, created_at, updated_at, paid_at, completed_at, requires_shipping,
  revisions_allowed, revisions_used, refund_required, brief_id,
  brand:brands ( id, brand_name, brand_logo_url, brand_slug ),
  creator:creators ( id, display_name, slug, profile_image_url, verified )
`

const orderListQuery = () => supabase.from('orders').select(ORDER_LIST_SELECT, { count: 'exact' })
export type OrderListItem = QueryData<ReturnType<typeof orderListQuery>>[number]

export type OrderListParams = {
  brandId?: string
  creatorId?: string
  statuses?: OrderStatus[]
  search?: string
  from?: string
  to?: string
  minAmount?: number
  maxAmount?: number
  page?: number
  pageSize?: number
}

/** Strips characters that have meaning in PostgREST `or=` filters. */
export function sanitizeFilter(value: string) {
  return value.replace(/[,()%*\\:"']/g, ' ').trim()
}

export async function listOrders(p: OrderListParams) {
  const pageSize = p.pageSize ?? 20
  const page = Math.max(1, p.page ?? 1)
  let q = orderListQuery()
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (p.brandId) q = q.eq('brand_id', p.brandId)
  if (p.creatorId) q = q.eq('creator_id', p.creatorId)
  if (p.statuses?.length) q = q.in('status', p.statuses)
  if (p.from) q = q.gte('created_at', p.from)
  if (p.to) q = q.lte('created_at', p.to)
  if (p.minAmount !== undefined) q = q.gte('total_amount', p.minAmount)
  if (p.maxAmount !== undefined) q = q.lte('total_amount', p.maxAmount)
  const s = p.search ? sanitizeFilter(p.search) : ''
  if (s) q = q.or(`order_number.ilike.*${s}*,service_title.ilike.*${s}*`)
  const { data, error, count } = await q
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

const ORDER_DETAIL_SELECT = `
  *,
  brand:brands ( id, profile_id, brand_name, brand_logo_url, brand_slug, brand_pronunciation, pronunciation_audio_url,
                 website_url, instagram_url, contact_email, contact_phone, industry, location ),
  creator:creators ( id, profile_id, display_name, slug, profile_image_url, verified, city, state, rating, review_count ),
  brief:briefs ( id, title, status, brief_attachments ( * ) ),
  order_items ( * ),
  order_status_history ( * ),
  order_deliverables ( * ),
  order_revisions ( * ),
  shipping_details ( * ),
  reviews ( * ),
  disputes ( * ),
  payments ( id, status, amount, currency, method, provider_order_id, provider_payment_id, refunded_amount, captured_at, created_at, error_description )
`

const orderDetailQuery = () =>
  supabase
    .from('orders')
    .select(ORDER_DETAIL_SELECT)
    .order('created_at', { referencedTable: 'order_status_history', ascending: true })
    .order('created_at', { referencedTable: 'order_deliverables', ascending: true })
    .order('revision_number', { referencedTable: 'order_revisions', ascending: true })
    .order('created_at', { referencedTable: 'payments', ascending: false })

export type OrderDetail = QueryData<ReturnType<typeof orderDetailQuery>>[number]

export async function getOrder(id: string): Promise<OrderDetail | null> {
  return unwrap(await orderDetailQuery().eq('id', id).maybeSingle())
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------
const CHECKOUT_SERVICE_SELECT = `
  *,
  service_addons ( * ),
  creator:creators ( id, slug, display_name, profile_image_url, verified, city, state, rating, review_count, available, response_time, status )
`
const checkoutServiceQuery = () => supabase.from('creator_services').select(CHECKOUT_SERVICE_SELECT)
export type CheckoutService = QueryData<ReturnType<typeof checkoutServiceQuery>>[number]

export async function getServiceForCheckout(serviceId: string): Promise<CheckoutService | null> {
  const data = unwrap(await checkoutServiceQuery().eq('id', serviceId).maybeSingle())
  if (!data) return null
  return { ...data, service_addons: data.service_addons.filter((a) => a.active).sort((a, b) => a.sort_order - b.sort_order) }
}

export async function quoteOrder(serviceId: string, addonIds: string[]): Promise<OrderQuote> {
  const data = unwrap(await supabase.rpc('calculate_order_total', { p_service_id: serviceId, p_addon_ids: addonIds }))
  return data as unknown as OrderQuote
}

export async function createOrder(input: { serviceId: string; addonIds: string[]; briefId?: string | null; requirements?: string }) {
  return unwrap(
    await supabase.rpc('create_order', {
      p_service_id: input.serviceId,
      p_addon_ids: input.addonIds,
      p_brief_id: input.briefId ?? undefined,
      p_requirements: input.requirements || undefined,
    }),
  )
}

// ---------------------------------------------------------------------------
// Workflow actions (all validated by the database)
// ---------------------------------------------------------------------------
export async function cancelOrder(id: string, reason?: string) {
  return unwrap(await supabase.rpc('cancel_order', { p_order_id: id, p_reason: reason }))
}

export async function acceptOrder(id: string, shipping?: ShippingAddressInput) {
  return unwrap(await supabase.rpc('accept_order', { p_order_id: id, p_shipping: shipping }))
}

export async function declineOrder(id: string, reason: string) {
  return unwrap(await supabase.rpc('decline_order', { p_order_id: id, p_reason: reason }))
}

export async function submitShippingAddress(id: string, shipping: ShippingAddressInput) {
  return unwrap(await supabase.rpc('submit_shipping_address', { p_order_id: id, p_shipping: shipping }))
}

export async function markShipped(id: string, courier: string, trackingNumber: string, trackingUrl?: string) {
  return unwrap(
    await supabase.rpc('mark_order_shipped', {
      p_order_id: id,
      p_courier: courier,
      p_tracking_number: trackingNumber,
      p_tracking_url: trackingUrl || undefined,
    }),
  )
}

export async function markReceived(id: string) {
  return unwrap(await supabase.rpc('mark_product_received', { p_order_id: id }))
}

export async function startWork(id: string) {
  return unwrap(await supabase.rpc('start_order_work', { p_order_id: id }))
}

export type DeliverableInput =
  | { storage_path: string; file_name: string; mime_type?: string; size_bytes?: number }
  | { external_url: string; file_name?: string }

export async function submitDeliverables(id: string, items: DeliverableInput[], note?: string) {
  return unwrap(await supabase.rpc('submit_deliverables', { p_order_id: id, p_items: items, p_note: note }))
}

export async function requestRevision(id: string, reason: string, instructions?: string, attachments: Attachment[] = []) {
  return unwrap(
    await supabase.rpc('request_revision', {
      p_order_id: id,
      p_reason: reason,
      p_instructions: instructions,
      p_attachments: attachments,
    }),
  )
}

export async function approveOrder(id: string) {
  return unwrap(await supabase.rpc('approve_order', { p_order_id: id }))
}

export async function openDispute(id: string, reason: string, description: string) {
  return unwrap(await supabase.rpc('open_dispute', { p_order_id: id, p_reason: reason, p_description: description }))
}

export async function submitReview(orderId: string, rating: number, comment?: string) {
  return unwrap(await supabase.rpc('submit_review', { p_order_id: orderId, p_rating: rating, p_comment: comment }))
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------
export async function listDisputeMessages(disputeId: string) {
  return unwrap(await supabase.from('dispute_messages').select('*').eq('dispute_id', disputeId).order('created_at'))
}

export async function addDisputeMessage(disputeId: string, body: string, attachments: Attachment[] = []) {
  return unwrap(await supabase.rpc('add_dispute_message', { p_dispute_id: disputeId, p_body: body, p_attachments: attachments }))
}

// ---------------------------------------------------------------------------
// Files (private bucket: order-deliverables/{orderId}/…)
// ---------------------------------------------------------------------------
export async function uploadOrderFile(orderId: string, file: File, sub?: 'revisions' | 'disputes'): Promise<Attachment> {
  const up = await uploadFile('order-deliverables', scopedPath(orderId, file.name, sub), file)
  return { path: up.path, name: file.name, mime: up.mime, size: file.size }
}

export function orderFileUrl(path: string, download?: string) {
  return signedUrl('order-deliverables', path, 3600, download)
}

export function orderFileUrls(paths: string[]) {
  return signedUrls('order-deliverables', paths)
}
