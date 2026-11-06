import { supabase } from '@/lib/supabase/client'
import { toAppError, unwrap } from '@/lib/errors'
import { fetchAllPages } from '@/lib/fetch-all'
import { invokeFunction } from '@/lib/supabase/functions'
import { istParts } from '@/lib/india-time'
import { toCsv } from '@/lib/csv'
import { creatorsCsv } from '@shared/creators-csv'
import { site } from '@/config/site'
import type { AccountKind, ImportRow } from '@/lib/account-import'
import { getProfileNames, listBrands, listCreators, type AdminCreatorParams } from './admin.service'
import type { AccountStatus } from '@/types'

/**
 * Admin → Creators / Brands → More: everyone on the list as a spreadsheet,
 * and a spreadsheet of new people turned into approved accounts.
 */

const day = (iso: string | null | undefined) => (iso ? istParts(iso).date : '')

/** Runs `fetch` over the ids 100 at a time (a URL can only hold so many). */
async function inChunks<T>(ids: string[], fetch: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, i * 100 + 100))
  return (await Promise.all(chunks.map(fetch))).flat()
}

/**
 * Every creator matching the page's filters. The first columns are the upload
 * template's, so an edited export can go straight back in.
 */
export async function exportCreatorsCsv(params: Omit<AdminCreatorParams, 'page' | 'pageSize'>) {
  const { items } = await fetchAllPages((page, pageSize) => listCreators({ ...params, page, pageSize }))
  const ids = items.map((c) => c.id)
  const [names, instagram, services] = await Promise.all([
    getProfileNames(items.map((c) => c.profile_id)),
    inChunks(
      ids,
      async (chunk) =>
        unwrap(
          await supabase.from('creator_social_accounts').select('creator_id, username, profile_url').eq('platform', 'instagram').in('creator_id', chunk),
        ) ?? [],
    ).then((rows) => new Map(rows.map((r) => [r.creator_id, r]))),
    // Every service a brand can order, in storefront order, for the "All services" column.
    inChunks(
      ids,
      async (chunk) =>
        unwrap(
          await supabase
            .from('creator_services')
            .select('creator_id, title, price, sort_order')
            .eq('active', true)
            .is('archived_at', null)
            .in('creator_id', chunk)
            .order('sort_order'),
        ) ?? [],
    ).then((rows) => {
      const byCreator = new Map<string, { title: string; price: number }[]>()
      for (const r of rows) byCreator.set(r.creator_id, [...(byCreator.get(r.creator_id) ?? []), r])
      return byCreator
    }),
  ])
  // The same builder serves the live link (Edge Function creators-feed), so both always match.
  const csv = creatorsCsv(items, { names, instagram, services, siteUrl: site.url || window.location.origin })
  return { csv, count: items.length }
}

export type CreatorsLiveLink = { key: string; created_at: string; last_used_at: string | null; uses: number }

/** Admin → Creators → More → Live link: the current link, or null while it's off (migration 0046). */
export async function getCreatorsLiveLink(): Promise<CreatorsLiveLink | null> {
  return (unwrap(await supabase.rpc('admin_creators_feed')) as CreatorsLiveLink | null) ?? null
}

/** On: a new link, and any old one stops working at once. Off: no link at all. */
export async function setCreatorsLiveLink(on: boolean): Promise<CreatorsLiveLink | null> {
  return (unwrap(await supabase.rpc('admin_set_creators_feed', { p_on: on })) as CreatorsLiveLink | null) ?? null
}

/** The address a spreadsheet opens: the creators CSV, fresh on every request (Edge Function creators-feed). */
export function creatorsLiveLinkUrl(key: string) {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/creators-feed?key=${key}`
}

/** Every brand matching the page's filters, template columns first. */
export async function exportBrandsCsv(params: { search?: string; status?: AccountStatus | ''; sort?: string }) {
  const { items } = await fetchAllPages((page, pageSize) => listBrands({ ...params, page, pageSize }))
  const [names, extra] = await Promise.all([
    getProfileNames(items.map((b) => b.profile_id)),
    inChunks(
      items.map((b) => b.id),
      async (chunk) => unwrap(await supabase.from('brands').select('id, website_url, instagram_url, preferences').in('id', chunk)) ?? [],
    ).then((rows) => new Map(rows.map((r) => [r.id, r]))),
  ])
  const header = [
    'Brand name',
    'Contact person',
    'Email',
    'Phone',
    'Website',
    'Instagram',
    'Industry',
    'City',
    'Contact email',
    'Account',
    'Orders',
    'Spend (₹)',
    'Joined',
    'Last active',
  ]
  const rows = items.map((b) => {
    const more = extra.get(b.id)
    const contact = (more?.preferences as { contact_person?: string | null } | null)?.contact_person
    return [
      b.brand_name,
      contact || names.get(b.profile_id) || '',
      b.email,
      b.contact_phone,
      more?.website_url ?? '',
      more?.instagram_url ?? '',
      b.industry,
      b.location,
      b.contact_email && b.contact_email !== b.email ? b.contact_email : '',
      b.account_status,
      b.orders_count,
      b.spend,
      day(b.joined_at),
      day(b.last_activity_at),
    ]
  })
  return { csv: toCsv(header, rows), count: items.length }
}

export type ImportResult = {
  line: number
  email: string
  status: 'created' | 'skipped' | 'failed'
  message?: string
  emailed: boolean
}

/** Must match admin-import-accounts' MAX_ROWS. */
const BATCH = 10

/**
 * Sends the rows to admin-import-accounts a batch at a time and reports how
 * far it has got. A batch that fails as a whole (connection dropped) marks its
 * rows failed and the rest carry on; if the very first one fails, nothing has
 * happened yet, so the error is thrown instead.
 */
export async function importAccounts(
  kind: AccountKind,
  rows: (ImportRow & { line: number })[],
  invite: boolean,
  onProgress: (done: number) => void,
): Promise<ImportResult[]> {
  const results: ImportResult[] = []
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      const res = await invokeFunction<{
        results: Omit<ImportResult, 'line'>[]
      }>('admin-import-accounts', {
        role: kind,
        rows: batch.map(({ line: _line, ...row }) => row),
        invite,
      })
      results.push(
        ...batch.map((row, j) => ({
          ...(res.results[j] ?? {
            email: row.email,
            status: 'failed' as const,
            emailed: false,
          }),
          line: row.line,
        })),
      )
    } catch (e) {
      if (i === 0) throw e
      const message = toAppError(e).message
      results.push(
        ...batch.map((row) => ({
          line: row.line,
          email: row.email,
          status: 'failed' as const,
          message,
          emailed: false,
        })),
      )
    }
    onProgress(results.length)
  }
  return results
}
