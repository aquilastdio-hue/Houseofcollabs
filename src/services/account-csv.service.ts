import { supabase } from '@/lib/supabase/client'
import { toAppError, unwrap } from '@/lib/errors'
import { fetchAllPages } from '@/lib/fetch-all'
import { invokeFunction } from '@/lib/supabase/functions'
import { istParts } from '@/lib/india-time'
import { toCsv } from '@/lib/csv'
import { site } from '@/config/site'
import type { AccountKind, ImportRow } from '@/lib/account-import'
import { getProfileNames, listBrands, listCreators, type AdminCreatorParams } from './admin.service'
import type { AccountStatus } from '@/types'

/**
 * Admin → Creators / Brands → More: everyone on the list as a spreadsheet,
 * and a spreadsheet of new people turned into approved accounts.
 */

const day = (iso: string | null | undefined) => (iso ? istParts(iso).date : '')
const yes = (v: boolean | null | undefined) => (v ? 'Yes' : 'No')

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
  const [names, instagram] = await Promise.all([
    getProfileNames(items.map((c) => c.profile_id)),
    inChunks(
      items.map((c) => c.id),
      async (chunk) =>
        unwrap(await supabase.from('creator_social_accounts').select('creator_id, username').eq('platform', 'instagram').in('creator_id', chunk)) ??
        [],
    ).then((rows) => new Map(rows.map((r) => [r.creator_id, r.username.trim().replace(/^@/, '')]))),
  ])
  const header = [
    'Name',
    'Email',
    'WhatsApp',
    'Instagram',
    'Followers',
    'Categories',
    'City',
    'State',
    'Full name',
    'Storefront',
    'Account',
    'Verified',
    'Featured',
    'Orders',
    'Revenue (₹)',
    'Rating',
    'Reviews',
    'Referral code',
    'Profile link',
    'Joined',
  ]
  const rows = items.map((c) => [
    c.display_name,
    c.email,
    c.whatsapp,
    instagram.get(c.id) ?? '',
    c.followers_count,
    c.categories,
    c.city,
    c.state,
    names.get(c.profile_id) ?? '',
    c.deleted_at ? 'removed' : c.status,
    c.account_status,
    yes(c.verified),
    yes(c.featured),
    c.orders_count,
    c.revenue,
    c.review_count ? c.rating : '',
    c.review_count,
    c.referral_code,
    c.slug ? `${site.url || window.location.origin}/creators/${c.slug}` : '',
    day(c.joined_at),
  ])
  return { csv: toCsv(header, rows), count: items.length }
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
