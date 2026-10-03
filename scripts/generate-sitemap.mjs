// Writes public/sitemap.xml (the fixed marketing and legal pages) and
// public/robots.txt.
//
// Two sitemaps, one owner each. Anything driven by the database -- category
// pages and creator storefronts -- belongs to the `sitemap` Edge Function at
// /sitemap-creators.xml, which knows the real `lastmod` and which rows are
// still live. Categories used to be listed here as well, so all fifteen
// appeared in both files with a made-up lastmod in one of them.
//
// The base URL comes from SITE_URL. For the deployed site that is pinned in
// vercel.json; the Edge Function reads its own SITE_URL secret in Supabase, and
// the two are deliberately separate systems.
//
//   SITE_URL=https://your-domain.com node scripts/generate-sitemap.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const site = (process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? 'https://houseofcollabs.example').replace(/\/$/, '')
const today = new Date().toISOString().slice(0, 10)

const pages = [
  ['/', '1.0', 'weekly'],
  ['/discover', '0.9', 'daily'],
  ['/ugc', '0.8', 'weekly'],
  ['/barter', '0.8', 'weekly'],
  ['/get-started', '0.6', 'monthly'],
  ['/contact', '0.5', 'yearly'],
  ['/privacy', '0.3', 'yearly'],
  ['/terms', '0.3', 'yearly'],
  ['/cookie-policy', '0.3', 'yearly'],
  ['/creator-guidelines', '0.4', 'yearly'],
  ['/brand-guidelines', '0.4', 'yearly'],
  ['/refund-policy', '0.4', 'yearly'],
  ['/payout-policy', '0.4', 'yearly'],
]
const urls = pages.map(([p, priority, freq]) => ({ loc: `${site}${p}`, priority, freq }))

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`

const robots = `# ${site}
User-agent: *
Allow: /
Disallow: /brand/
Disallow: /brand$
Disallow: /creator/
Disallow: /creator$
Disallow: /admin
Disallow: /onboarding
Disallow: /auth/
Disallow: /reset-password

Sitemap: ${site}/sitemap.xml
Sitemap: ${site}/sitemap-creators.xml
`

fs.mkdirSync(path.join(root, 'public'), { recursive: true })
fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), xml)
fs.writeFileSync(path.join(root, 'public', 'robots.txt'), robots)
console.log(`wrote public/sitemap.xml (${urls.length} urls) and public/robots.txt for ${site}`)
