import { supabase } from '@/lib/supabase/client'
import { toAppError, unwrap } from '@/lib/errors'
import { invokeFunction } from '@/lib/supabase/functions'
import type { EarningsSummary, PayoutMethod, PayoutMethodType, PayoutRequest } from '@/types'

export async function getEarningsSummary(): Promise<EarningsSummary> {
  return unwrap(await supabase.rpc('get_earnings_summary')) as unknown as EarningsSummary
}

const EARNING_SELECT = `
  *,
  order:orders ( id, order_number, service_title, completed_at, brand:brands ( id, brand_name, brand_logo_url ) )
`

export async function listEarnings(page = 1, pageSize = 20) {
  const { data, error, count } = await supabase
    .from('creator_earnings')
    .select(EARNING_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw toAppError(error)
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}
export type EarningListItem = Awaited<ReturnType<typeof listEarnings>>['items'][number]

const PAYOUT_METHOD_COLUMNS =
  'id, creator_id, method_type, account_holder_name, upi_id, bank_account_last4, ifsc_code, bank_name, verified, created_at, updated_at'

export async function getPayoutMethod(creatorId: string): Promise<PayoutMethod | null> {
  return unwrap(await supabase.from('payout_methods').select(PAYOUT_METHOD_COLUMNS).eq('creator_id', creatorId).maybeSingle())
}

export async function savePayoutMethod(input: {
  method_type: PayoutMethodType
  account_holder_name: string
  upi_id?: string
  bank_account_number?: string
  ifsc_code?: string
  bank_name?: string
}) {
  return unwrap(
    await supabase.rpc('save_payout_method', {
      p_method_type: input.method_type,
      p_account_holder_name: input.account_holder_name,
      p_upi_id: input.upi_id,
      p_bank_account_number: input.bank_account_number,
      p_ifsc_code: input.ifsc_code,
      p_bank_name: input.bank_name,
    }),
  )
}

export async function listPayoutRequests() {
  return unwrap(
    await supabase
      .from('payout_requests')
      .select('*, payout_transactions ( * )')
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'payout_transactions', ascending: false }),
  )
}
export type PayoutRequestWithTransactions = Awaited<ReturnType<typeof listPayoutRequests>>[number]

/** Goes through the `request-payout` Edge Function (balance + minimum checks server-side). */
export function requestPayout(notes?: string) {
  return invokeFunction<{ payout_request: PayoutRequest }>('request-payout', { notes })
}
