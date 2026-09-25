// Writes public/sitemap.xml (static marketing + category pages) and
// public/robots.txt. Creator storefronts are served dynamically by the
// `sitemap` Edge Function at /sitemap-creators.xml (see vercel.json / netlify.toml).
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
  ['/contact', '0.5', 'yearly'],
  ['/privacy', '0.3', 'yearly'],
  ['/terms', '0.3', 'yearly'],
  ['/cookie-policy', '0.3', 'yearly'],
  ['/creator-guidelines', '0.4', 'yearly'],
  ['/brand-guidelines', '0.4', 'yearly'],
  ['/refund-policy', '0.4', 'yearly'],
  ['/payout-policy', '0.4', 'yearly'],
]
const categories = ['beauty', 'fashion', 'fitness', 'lifestyle', 'food', 'travel', 'technology', 'gaming', 'parenting', 'education', 'skincare', 'couple', 'ugc', 'photography', 'finance']

const urls = [
  ...pages.map(([p, priority, freq]) => ({ loc: `${site}${p}`, priority, freq })),
  ...categories.map((c) => ({ loc: `${site}/categories/${c}`, priority: '0.7', freq: 'daily' })),
]

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
