// Public XML sitemap of creator storefronts + category pages. Uses the anon
// client, so RLS guarantees only published creators are listed.
import { handler } from '../_shared/http.ts'
import { anonClient } from '../_shared/supabase.ts'

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)

export const handle = handler(
  async () => {
    const db = anonClient()
    const [creators, categories] = await Promise.all([
      db.from('creators').select('slug, updated_at').eq('status', 'published').is('deleted_at', null).order('updated_at', { ascending: false }).limit(45000),
      db.from('categories').select('slug, updated_at').eq('active', true),
    ])
    const urls = [
      ...(categories.data ?? []).map((c) => ({ loc: `${SITE_URL}/categories/${c.slug}`, lastmod: c.updated_at, priority: '0.7' })),
      ...(creators.data ?? []).map((c) => ({ loc: `${SITE_URL}/creators/${c.slug}`, lastmod: c.updated_at, priority: '0.8' })),
    ]
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod><priority>${u.priority}</priority></url>`)
        .join('\n') +
      `\n</urlset>\n`
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
  },
  { cors: false },
)
