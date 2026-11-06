// GET /functions/v1/creators-feed?key=… : the creators spreadsheet as CSV, built
// fresh on every request, so a Google Sheet (=IMPORTDATA) or an Excel workbook
// (Data → From Web) linked to it stays up to date by itself. Same builder as
// Admin → Creators → Download CSV (`_shared/creators-csv.ts`).
//
// The key in the link is the only lock, so it's checked first, by the database
// (`creators_feed`, migration 0046), before anything is read with the service
// role. Admins make, replace or turn off the link in Admin → Creators → More.
import { handler, must } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'
import { creatorsCsv, type CreatorSheetRow } from '../_shared/creators-csv.ts'

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://www.houseofcollabs.com').replace(/\/$/, '')
const PAGE = 1000

/** A spreadsheet shows the response body in a cell, so errors are one plain sentence. */
const refuse = (status: number, message: string) =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

/** Runs `fetch` over the ids 100 at a time (a URL can only hold so many). */
async function inChunks<T>(ids: string[], fetch: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, i * 100 + 100))
  return (await Promise.all(chunks.map(fetch))).flat()
}

export const handle = handler(
  async (req) => {
    if (req.method !== 'GET') return refuse(405, 'Open this link with GET, as a spreadsheet or browser does.')
    const key = new URL(req.url).searchParams.get('key') ?? ''
    if (!/^[0-9a-f]{64}$/.test(key)) return refuse(403, 'This link doesn’t work any more. Ask an admin for the new one.')

    const db = adminClient()
    const rows: CreatorSheetRow[] = []
    for (let offset = 0; ; offset += PAGE) {
      const res = await db.rpc('creators_feed', { p_key: key, p_offset: offset })
      if (res.error?.code === '42501') return refuse(403, res.error.message)
      const page = must(res) as CreatorSheetRow[]
      rows.push(...page)
      if (page.length < PAGE) break
    }

    const ids = rows.map((r) => r.id)
    const profileIds = [...new Set(rows.map((r) => r.profile_id))]
    const [names, instagram, services] = await Promise.all([
      inChunks(profileIds, async (chunk) => must(await db.from('profiles').select('id, full_name').in('id', chunk)) as { id: string; full_name: string | null }[]).then(
        (list) => new Map(list.filter((p) => p.full_name?.trim()).map((p) => [p.id, p.full_name!.trim()])),
      ),
      inChunks(
        ids,
        async (chunk) =>
          must(await db.from('creator_social_accounts').select('creator_id, username, profile_url').eq('platform', 'instagram').in('creator_id', chunk)) as {
            creator_id: string
            username: string
            profile_url: string | null
          }[],
      ).then((list) => new Map(list.map((a) => [a.creator_id, a]))),
      inChunks(
        ids,
        async (chunk) =>
          must(
            await db
              .from('creator_services')
              .select('creator_id, title, price, sort_order')
              .eq('active', true)
              .is('archived_at', null)
              .in('creator_id', chunk)
              .order('sort_order'),
          ) as { creator_id: string; title: string; price: number }[],
      ).then((list) => {
        const byCreator = new Map<string, { title: string; price: number }[]>()
        for (const s of list) byCreator.set(s.creator_id, [...(byCreator.get(s.creator_id) ?? []), s])
        return byCreator
      }),
    ])

    const csv = creatorsCsv(rows, { names, instagram, services, siteUrl: SITE_URL })
    // Opened in a browser, the link downloads a dated file that opens in Excel,
    // Numbers or Google Sheets; IMPORTDATA and Excel's From Web ignore this header.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
    // The byte-order mark makes Excel read ₹ as UTF-8; Google Sheets ignores it.
    return new Response(`﻿${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="house-of-collabs-creators-${today}.csv"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    })
  },
  { cors: false },
)

