// Writes a static copy of <head> for every public route.
//
// Why this exists
// ---------------
// The app is a client-rendered SPA: Vercel serves the same `index.html` for
// every path, and React 19 hoists <title>/<meta>/<link> once the bundle runs.
// Google renders JavaScript and picks those up on a second pass, so search
// indexing survives. Social crawlers do not run JavaScript at all — Facebook,
// LinkedIn, WhatsApp, Slack and X were all reading the shell's generic title
// and finding no og:image, which is why every shared link looked identical.
//
// So after `vite build` this walks a list of public routes and writes
// `dist/<route>/index.html` with the real head baked in. Vercel's filesystem
// handler serves those files before it reaches the SPA rewrite, so a crawler
// gets real metadata and a browser still gets the same app.
//
// Duplicate tags
// --------------
// Once the bundle boots, React renders its own title and meta. Two of each in
// one document is its own problem, so every injected tag is marked
// `data-prerender` and a small inline script removes them before the app
// mounts. A crawler that ignores scripts keeps the static ones; a browser ends
// up with exactly the set React manages.
//
// Keeping this honest
// -------------------
// The metadata here must match what `<Seo>` renders on the same route, or a
// link preview will say something the page does not. Routes whose copy lives
// in a component are listed below by hand; creator storefronts are read from
// the database so they stay correct as creators are published.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const SITE_NAME = 'House of Collabs'
const DEFAULT_DESCRIPTION =
  'House of Collabs is the creator marketplace for brands in India. Discover vetted creators, compare fixed prices and delivery times, and order UGC, reels and reviews in minutes.'
const OG_IMAGE = '/og-image.png'

const site = (process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? '').replace(/\/$/, '')
if (!site) {
  console.log('prerender: no SITE_URL — skipping (canonical URLs would be wrong without one)')
  process.exit(0)
}

const abs = (p) => (p.startsWith('http') ? p : `${site}${p.startsWith('/') ? p : `/${p}`}`)
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const titled = (t) => (t ? `${t} · ${SITE_NAME}` : SITE_NAME)
const trim = (s, max = 160) => {
  const flat = String(s).replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`
}

// --------------------------------------------------------------- the routes
// Titles and descriptions mirror each page's own <Seo> call.
const LEGAL = [
  ['/privacy', 'Privacy Policy', `How ${SITE_NAME} collects, uses and protects your personal data.`],
  ['/terms', 'Terms of Service', `The agreement between you and ${SITE_NAME} for using the marketplace as a brand, a creator or a visitor.`],
  ['/cookie-policy', 'Cookie Policy', `How ${SITE_NAME} uses cookies and similar technologies.`],
  ['/creator-guidelines', 'Creator Guidelines', `What ${SITE_NAME} expects from creators selling on the marketplace.`],
  ['/brand-guidelines', 'Brand Guidelines', `What ${SITE_NAME} expects from brands ordering on the marketplace.`],
  ['/refund-policy', 'Refund Policy', `When an order can be cancelled or refunded on ${SITE_NAME}.`],
  ['/payout-policy', 'Payout Policy', `When and how creators are paid for completed work on ${SITE_NAME}.`],
]

const routes = [
  {
    path: '/',
    // Null, so the tab reads just "House of Collabs". Matches the <Seo> call
    // in src/pages/public/Home.tsx.
    title: null,
    description: DEFAULT_DESCRIPTION,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: site,
        logo: abs('/house-of-collabs-logo.webp'),
        description: DEFAULT_DESCRIPTION,
        areaServed: 'IN',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: site,
        inLanguage: 'en-IN',
      },
    ],
  },
  {
    path: '/discover',
    title: 'Discover creators',
    description:
      'Browse Indian creators by niche, city, budget and delivery time. Compare fixed prices and hire for UGC videos, reels, reviews and more.',
  },
  {
    path: '/about',
    title: 'About',
    description: `How ${SITE_NAME} works, who it is for, and what it does for brands and creators in India.`,
  },
  {
    path: '/contact',
    title: 'Contact',
    description: `Get in touch with the ${SITE_NAME} team for brand enquiries, creator support, payments and payouts, partnerships or press.`,
  },
  {
    path: '/get-started',
    title: 'Create your profile',
    description: `Join ${SITE_NAME} as a brand or a creator.`,
  },
  ...LEGAL.map(([p, title, description]) => ({ path: p, title, description })),
]

// -------------------------------------------------- creator storefronts (db)
// Public columns only, through the anon key and RLS — the same data the page
// itself renders. A failure here must not fail the build: the storefronts fall
// back to the SPA shell exactly as they do today.
/**
 * Vite reads .env files, plain node does not. On Vercel these arrive as real
 * environment variables; locally they only exist in the file, and without this
 * a local production build would quietly skip every storefront.
 */
function envFromFiles(name) {
  // Split rather than match. A built regex here needs `\s`, which a template
  // literal turns into a bare `s` — so `=\s*` became `=s*` and quietly ate the
  // first character of a key beginning with "s", producing a 401 that looked
  // like a bad key rather than a bad parser.
  for (const file of ['.env.local', '.env']) {
    const p = path.join(root, file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const at = line.indexOf('=')
      if (at < 0) continue
      if (line.slice(0, at).trim() !== name) continue
      return line.slice(at + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
  return undefined
}

/** One read against the public API, with RLS applying as it does in the browser. */
async function publicRows(table, select, label) {
  const url = process.env.VITE_SUPABASE_URL || envFromFiles('VITE_SUPABASE_URL')
  const key = process.env.VITE_SUPABASE_ANON_KEY || envFromFiles('VITE_SUPABASE_ANON_KEY')
  if (!url || !key) {
    console.log(`prerender: no Supabase credentials — skipping ${label}`)
    return []
  }
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=500`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    return await res.json()
  } catch (e) {
    console.log(`prerender: ${label} skipped (${e.message})`)
    return []
  }
}

/**
 * Category landing pages, straight from the table CategoryPage renders.
 *
 * The slugs were hardcoded here at first, which meant the description had to be
 * invented and promptly disagreed with the one the page itself writes. Reading
 * the row removes the guess.
 */
async function categoryRoutes() {
  const rows = await publicRows('categories', 'slug,name,description,image_url', 'category pages')
  return rows
    .filter((c) => c.slug && c.name)
    .map((c) => ({
      path: `/categories/${c.slug}`,
      // Mirrors the <Seo> call in src/pages/public/CategoryPage.tsx.
      title: `${c.name} creators`,
      description: trim(
        `Hire ${c.name.toLowerCase()} creators across India with fixed prices and delivery times.${c.description ? ` ${c.description}` : ''}`,
        300,
      ),
      image: c.image_url || undefined,
    }))
}

async function creatorRoutes() {
  const url = process.env.VITE_SUPABASE_URL || envFromFiles('VITE_SUPABASE_URL')
  const key = process.env.VITE_SUPABASE_ANON_KEY || envFromFiles('VITE_SUPABASE_ANON_KEY')
  if (!url || !key) {
    console.log('prerender: no Supabase credentials — skipping creator storefronts')
    return []
  }
  try {
    const select = 'slug,display_name,headline,bio,city,state,country,profile_image_url,creator_categories(is_primary,category:categories(name))'
    const res = await fetch(`${url}/rest/v1/creators?select=${encodeURIComponent(select)}&limit=500`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    const rows = await res.json()
    return rows
      .filter((c) => c.slug)
      .map((c) => {
        const cats = c.creator_categories ?? []
        const primary = (cats.find((x) => x.is_primary) ?? cats[0])?.category?.name
        const role = primary ? `${primary} creator` : 'Creator'
        const title = `${c.display_name} — ${role}${c.city ? ` in ${c.city}` : ''}`
        const description = trim(
          c.headline || c.bio || `Hire ${c.display_name} on ${SITE_NAME} — fixed prices, clear delivery times and secure payments.`,
        )
        return {
          path: `/creators/${c.slug}`,
          title,
          description,
          // Undefined, not null: a creator with no avatar falls back to the
          // shared card rather than sharing with no preview image at all.
          image: c.profile_image_url || undefined,
          type: 'profile',
          jsonLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'ProfilePage',
              url: abs(`/creators/${c.slug}`),
              mainEntity: {
                '@type': 'Person',
                name: c.display_name,
                description,
                ...(c.profile_image_url ? { image: c.profile_image_url } : {}),
                address: {
                  '@type': 'PostalAddress',
                  ...(c.city ? { addressLocality: c.city } : {}),
                  ...(c.state ? { addressRegion: c.state } : {}),
                  addressCountry: c.country ?? 'IN',
                },
              },
            },
          ],
        }
      })
  } catch (e) {
    console.log(`prerender: creator storefronts skipped (${e.message})`)
    return []
  }
}

// ----------------------------------------------------------------- rendering
// Removes every injected tag, itself included, before the bundle renders its
// own. JSON-LD has to go the same way as the meta: leaving it behind put the
// homepage's Organization and WebSite graphs on top of a creator's ProfilePage.
const CLEANUP = `<script data-prerender>(function(){try{var me=document.currentScript;document.querySelectorAll('[data-prerender]').forEach(function(n){if(n!==me)n.remove()});if(me&&me.parentNode)me.parentNode.removeChild(me)}catch(e){}})()</script>`

function head(route) {
  const full = titled(route.title)
  const url = abs(route.path)
  const image = route.image === null ? null : route.image ? abs(route.image) : abs(OG_IMAGE)
  const sharedCard = !route.image
  const tags = [
    `<title data-prerender>${esc(full)}</title>`,
    `<meta data-prerender name="description" content="${esc(route.description)}" />`,
    `<link data-prerender rel="canonical" href="${esc(url)}" />`,
    `<meta data-prerender property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta data-prerender property="og:locale" content="en_IN" />`,
    `<meta data-prerender property="og:type" content="${route.type ?? 'website'}" />`,
    `<meta data-prerender property="og:title" content="${esc(full)}" />`,
    `<meta data-prerender property="og:description" content="${esc(route.description)}" />`,
    `<meta data-prerender property="og:url" content="${esc(url)}" />`,
  ]
  if (image) {
    tags.push(`<meta data-prerender property="og:image" content="${esc(image)}" />`)
    if (sharedCard) {
      tags.push(`<meta data-prerender property="og:image:width" content="1200" />`)
      tags.push(`<meta data-prerender property="og:image:height" content="630" />`)
    }
    tags.push(`<meta data-prerender property="og:image:alt" content="${esc(full)}" />`)
  }
  tags.push(`<meta data-prerender name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`)
  tags.push(`<meta data-prerender name="twitter:title" content="${esc(full)}" />`)
  tags.push(`<meta data-prerender name="twitter:description" content="${esc(route.description)}" />`)
  if (image) tags.push(`<meta data-prerender name="twitter:image" content="${esc(image)}" />`)
  for (const graph of route.jsonLd ?? []) {
    // `</script>` inside JSON would close the tag early.
    tags.push(`<script data-prerender type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`)
  }
  tags.push(CLEANUP)
  return tags.join('\n    ')
}

/**
 * Remove anything a previous run injected.
 *
 * The homepage is written back over `dist/index.html`, which is also the shell
 * every other route is built from. Without this, running the script twice gives
 * the second run a shell that already carries the homepage's tags, and every
 * creator page ends up declaring the homepage's canonical before its own.
 */
function stripPrerendered(html) {
  return html
    .replace(/\s*<title data-prerender>[\s\S]*?<\/title>/gi, '')
    .replace(/\s*<script data-prerender[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\s*<(?:meta|link) data-prerender[^>]*>/gi, '')
}

function render(shell, route) {
  // Drop the shell's own title and description so nothing is stated twice.
  let html = stripPrerendered(shell)
    .replace(/\s*<title>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<meta\s+[^>]*name="description"[\s\S]*?\/>/i, '')
  return html.replace(/<\/head>/i, `    ${head(route)}\n  </head>`)
}

const shellPath = path.join(dist, 'index.html')
if (!fs.existsSync(shellPath)) {
  console.error('prerender: dist/index.html not found — run vite build first')
  process.exit(1)
}
const shell = fs.readFileSync(shellPath, 'utf8')

const all = [...routes, ...(await categoryRoutes()), ...(await creatorRoutes())]
let written = 0
for (const route of all) {
  const out = route.path === '/' ? shellPath : path.join(dist, route.path, 'index.html')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, render(shell, route))
  written += 1
}

console.log(`prerender: wrote ${written} pages with static metadata (${site})`)
