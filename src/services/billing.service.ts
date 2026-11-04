import { supabase } from '@/lib/supabase/client'
import { AppError, toAppError, unwrap } from '@/lib/errors'
import { invokeFunction } from '@/lib/supabase/functions'
import { openRazorpayCheckout, type RazorpaySuccess } from '@/lib/payments/razorpay'
import { site } from '@/config/site'
import type { Database, Json } from '@/types/database.types'

/**
 * Billing (migration 0038): invoices, tax details, commission payments and
 * the admin's tax books. The database issues every document and works out
 * every amount; this module reads them and asks for the few actions people
 * take themselves.
 */

type Tables = Database['public']['Tables']
export type Invoice = Tables['invoices']['Row']
export type TaxRate = Tables['tax_rates']['Row']
export type TaxDeposit = Tables['tax_deposits']['Row']
export type BillingEntity = Tables['billing_entity']['Row']
export type CreatorTaxProfile = Tables['creator_tax_profiles']['Row']
export type BrandBillingProfile = Tables['brand_billing_profiles']['Row']

export type InvoiceKind = 'creator_service' | 'brand_commission' | 'creator_commission' | 'settlement' | 'credit_note'
export type InvoiceStatus = 'paid' | 'unpaid' | 'partially_paid' | 'cancelled' | 'credited' | 'issued'

/** A party as printed on a document (snapshot taken when it was issued). */
export type InvoiceParty = {
  name?: string | null
  display_name?: string | null
  brand_name?: string | null
  gstin?: string | null
  pan?: string | null
  tan?: string | null
  state_code?: string | null
  address?: string | null
  city?: string | null
  pincode?: string | null
  email?: string | null
  phone?: string | null
  note?: string | null
}

export type InvoiceLine = {
  description: string
  sac?: string | null
  quantity?: number
  rate?: number
  amount: number
  // settlement statements
  order_number?: string
  completed_at?: string
  fee?: number
  creator_gst?: number
  commission_deducted?: number
  tds?: number
  tcs?: number
}

export const party = (j: Json) => (j ?? {}) as InvoiceParty
export const lines = (j: Json) => ((Array.isArray(j) ? j : []) as unknown) as InvoiceLine[]
export const meta = (j: Json) => (j && typeof j === 'object' && !Array.isArray(j) ? j : {}) as Record<string, string | number | null>

// ------------------------------------------------------------- summaries ---
export type CreatorBillingSummary = {
  role: 'creator'
  earnings_total: number
  pending: number
  paid: number
  in_progress: number
  tds: number
  tcs: number
  commission_outstanding: number
  commission_paid: number
  commission_percent: number
  tax_profile: CreatorTaxProfile | null
  rates: { gst: number; tds: number; tds_no_pan: number; tds_limit: number; tcs: number }
}

export type BrandBillingSummary = {
  role: 'brand'
  campaign_payments: number
  creator_fees: number
  creator_gst: number
  hoc_commission: number
  commission_gst: number
  orders: number
  refunded: number
  outstanding: number
  commission_percent: number
  billing_profile: BrandBillingProfile | null
}

export async function getMyBillingSummary() {
  return unwrap(await supabase.rpc('get_my_billing_summary')) as unknown as CreatorBillingSummary | BrandBillingSummary
}

export type TaxProfileInput = {
  legal_name: string
  state_code: string
  pan?: string
  gstin?: string
  gst_registered?: boolean
  entity_type?: string
  address?: string
  city?: string
  pincode?: string
  invoice_consent?: boolean
}

export async function saveMyTaxProfile(input: TaxProfileInput) {
  return unwrap(await supabase.rpc('save_my_tax_profile', { p_profile: input as unknown as Json }))
}

// -------------------------------------------------------------- invoices ---
export type InvoiceListParams = {
  kind?: InvoiceKind | 'all'
  status?: InvoiceStatus | 'open' | 'all'
  search?: string
  /** Admin only: also show documents from test accounts. */
  includeTest?: boolean
  /** Issued on or after / on or before (YYYY-MM-DD, India time). */
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

/** The caller's documents: RLS shows a brand, a creator or an admin exactly theirs. */
export async function listInvoices(params: InvoiceListParams = {}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  let q = supabase.from('invoices').select('*', { count: 'exact' }).order('issued_at', { ascending: false }).order('number', { ascending: false })
  if (params.kind && params.kind !== 'all') q = q.eq('kind', params.kind)
  if (params.status === 'open') q = q.in('status', ['unpaid', 'partially_paid'])
  else if (params.status && params.status !== 'all') q = q.eq('status', params.status)
  if (!params.includeTest) q = q.eq('is_test', false)
  if (params.from) q = q.gte('issued_at', `${params.from}T00:00:00+05:30`)
  if (params.to) q = q.lte('issued_at', `${params.to}T23:59:59.999+05:30`)
  const term = params.search?.trim().replace(/[%,()]/g, ' ')
  if (term) q = q.or(`number.ilike.%${term}%,meta->>order_number.ilike.%${term}%,recipient->>name.ilike.%${term}%,supplier->>name.ilike.%${term}%`)
  const { data, error, count } = await q.range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

// ------------------------------------------------ paying a commission ---
type InvoicePaymentResponse = {
  key_id: string
  razorpay_order_id: string
  amount: number
  currency: string
  invoice_number: string
  description: string
  prefill: { name?: string; email?: string; contact?: string }
}

/** Creator → Razorpay → server check. The invoice only turns paid when the server confirms it. */
export async function payInvoice(invoiceId: string, opts: { onFailure?: (message: string) => void } = {}) {
  const pay = await invokeFunction<InvoicePaymentResponse>('invoice-payment', { action: 'create', invoice_id: invoiceId })
  if (!pay.key_id) throw new AppError('Payments are not configured yet. Please contact support.', { kind: 'payment', code: 'PAYMENTS_NOT_CONFIGURED' })
  const response: RazorpaySuccess = await openRazorpayCheckout({
    keyId: pay.key_id,
    razorpayOrderId: pay.razorpay_order_id,
    amountPaise: pay.amount,
    currency: pay.currency,
    name: site.name,
    description: pay.description,
    prefill: pay.prefill,
    notes: { invoice_number: pay.invoice_number },
    onFailure: opts.onFailure,
  })
  return invokeFunction<{ status: 'captured' | 'processing'; invoice_id: string }>('invoice-payment', { action: 'verify', ...response })
}

// ----------------------------------------------------------------- admin ---
export type AdminBillingSummary = {
  billing_v2_enabled: boolean
  transaction_value: number
  refunds: number
  brand_commission_revenue: number
  creator_commission_revenue: number
  hoc_revenue: number
  gst_collected: number
  tds_withheld: number
  tcs_collected: number
  creator_payouts: number
  commission_payments: number
  tax_deposited: number
  balances: Record<string, number>
  gst_payable: number
  tds_payable: number
  tcs_payable: number
  outstanding_creator_commissions: number
  outstanding_commission_invoices: number
  pending_settlements: number
  monthly_taxes: {
    month: string
    tds_withheld: number
    tds_reversed: number
    tcs_collected: number
    tcs_reversed: number
    gst_output: number
    tds_deposited: number
    tcs_deposited: number
    gst_deposited: number
  }[]
  reconciliation: {
    unbalanced_postings: number
    paid_orders_without_invoices: number
    captured_v2_payments: number
    ledger_brand_payments: number
    withholdings_total: number
    ledger_withholdings: number
    commission_invoices_outstanding: number
    ledger_commission_receivable: number
    unpaid_v2_earnings: number
    paid_orders_in_progress: number
  }
}

export async function getAdminBillingSummary(from?: string, to?: string) {
  return unwrap(await supabase.rpc('admin_billing_summary', { p_from: from, p_to: to })) as unknown as AdminBillingSummary
}

export async function getBillingEntity() {
  return unwrap(await supabase.from('billing_entity').select('*').maybeSingle())
}

export type BillingEntityInput = Partial<Omit<BillingEntity, 'id' | 'updated_at' | 'updated_by'>>

export async function saveBillingEntity(input: BillingEntityInput) {
  return unwrap(await supabase.rpc('admin_save_billing_entity', { p_entity: input as unknown as Json }))
}

export async function listTaxRates() {
  return unwrap(await supabase.from('tax_rates').select('*').order('code').order('effective_from', { ascending: false })) ?? []
}

export async function saveTaxRate(input: { code: string; rate: number; threshold: number | null; effective_from: string; note?: string }) {
  return unwrap(
    await supabase.rpc('admin_save_tax_rate', {
      p_code: input.code,
      p_rate: input.rate,
      p_threshold: input.threshold,
      p_effective_from: input.effective_from,
      p_note: input.note,
    }),
  )
}

export async function deleteTaxRate(id: string) {
  unwrap(await supabase.rpc('admin_delete_tax_rate', { p_id: id }))
}

export async function listTaxDeposits() {
  return unwrap(await supabase.from('tax_deposits').select('*').order('period', { ascending: false }).order('deposited_on', { ascending: false })) ?? []
}

export type TaxDepositInput = {
  tax_type: 'gst_output' | 'tds_194o' | 'tcs_gst_52'
  period: string
  amount: number
  reference: string
  deposited_on: string
  return_type?: string
  filing_reference?: string
  filed_on?: string
  note?: string
}

export async function recordTaxDeposit(input: TaxDepositInput) {
  return unwrap(await supabase.rpc('admin_record_tax_deposit', { p_deposit: input as unknown as Json }))
}

export async function recordInvoicePayment(invoiceId: string, amount: number, reference: string) {
  return unwrap(await supabase.rpc('admin_record_invoice_payment', { p_invoice_id: invoiceId, p_amount: amount, p_reference: reference }))
}

export type RegisterRow = Record<string, string | number | boolean | null>

export async function invoiceRegister(from: string, to: string, includeTest = false) {
  return (unwrap(await supabase.rpc('admin_invoice_register', { p_from: from, p_to: to, p_include_test: includeTest })) ?? []) as unknown as RegisterRow[]
}

export async function withholdingRegister(from: string, to: string, includeTest = false) {
  return (unwrap(await supabase.rpc('admin_withholding_register', { p_from: from, p_to: to, p_include_test: includeTest })) ?? []) as unknown as RegisterRow[]
}

// ------------------------------------------ bank-transfer payouts (0042) ---
export type PreparePayoutsResult = {
  created: number
  total: number
  already_open: number
  without_details: { creator_id: string; name: string }[]
}

/** One payout request for every creator with earnings ready to pay. */
export async function preparePayouts(includeTest = false) {
  return unwrap(await supabase.rpc('admin_prepare_payouts', { p_include_test: includeTest })) as unknown as PreparePayoutsResult
}

export type PayoutSheetRow = {
  payout_request_id: string
  reference: string
  requested_at: string
  status: string
  creator: string
  legal_name: string | null
  pan: string | null
  gstin: string | null
  email: string | null
  phone: string | null
  method: 'upi' | 'bank_transfer' | null
  account_holder: string | null
  upi_id: string | null
  account_number: string | null
  ifsc: string | null
  bank: string | null
  amount: number
  gross: number
  commission_deducted: number
  tds: number
  tcs: number
  orders: string
  test: boolean
}

/** Full payout details for the accountant. Audited on every call. */
export async function payoutSheet(status: 'pending' | 'processing' | 'open' = 'pending', includeTest = false) {
  return (unwrap(await supabase.rpc('admin_payout_sheet', { p_status: status, p_include_test: includeTest })) ?? []) as unknown as PayoutSheetRow[]
}

export type MarkPaidResult = { payout_request_id: string; ok: boolean; reference?: string; error?: string }

export async function markPayoutsPaid(rows: { payout_request_id: string; reference: string }[]) {
  return (unwrap(await supabase.rpc('admin_mark_payouts_paid', { p_rows: rows as unknown as Json })) ?? []) as unknown as MarkPaidResult[]
}

export type AccountsExport = Record<'orders' | 'payments' | 'refunds' | 'earnings' | 'payouts' | 'ledger', RegisterRow[]>

export async function accountsExport(from: string, to: string, includeTest = false) {
  return unwrap(await supabase.rpc('admin_accounts_export', { p_from: from, p_to: to, p_include_test: includeTest })) as unknown as AccountsExport
}
