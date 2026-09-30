// Production build. Use this rather than a plain `vite build`, for two reasons
// that have nothing to do with which host is serving the result:
//
//  1. `.env.local` sets VITE_SITE_URL=http://localhost:5173 for dev, and Vite
//     reads .env.local in every mode — so a local production build happily
//     bakes "localhost" into the canonical and OpenGraph URLs. This strips any
//     localhost value so the app falls back to window.location.origin, which is
//     correct on whatever domain it ends up on.
//
//  2. The sitemap needs an absolute origin at build time, and it has to be
//     regenerated per build or it goes stale as creators are published.
//
// Hosts advertise their own URL under their own names. Vercel gives the bare
// hostname with no scheme, so it is prefixed here; the explicit SITE_URL /
// VITE_SITE_URL still win, which is what a local drag-and-drop build uses.
//
// Resolution order:
//   SITE_URL → VITE_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL
//   (localhost ignored at every step)
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isLocal = (u) => !u || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(u)

/** Vercel exposes hostnames without a scheme; everything else arrives complete. */
const withScheme = (u) => (!u || /^https?:\/\//i.test(u) ? u : `https://${u}`)

const candidates = [
  process.env.SITE_URL,
  process.env.VITE_SITE_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL,
]
  .filter(Boolean)
  .map(withScheme)

const siteUrl = candidates.find((u) => !isLocal(u))?.replace(/\/$/, '')

const env = { ...process.env }
if (siteUrl) {
  env.SITE_URL = siteUrl
  env.VITE_SITE_URL = siteUrl
  console.log(`site URL: ${siteUrl}`)
} else {
  // No usable absolute URL. Drop the dev value so the bundle doesn't ship
  // localhost; the app resolves its own origin at runtime instead.
  delete env.SITE_URL
  env.VITE_SITE_URL = '' // explicit empty beats .env.local's dev value
  console.log(
    candidates.length
      ? `site URL: none usable (ignored ${candidates.join(', ')}) — canonical links will use window.location.origin`
      : 'site URL: not set — canonical links will use window.location.origin',
  )
  console.log('note: sitemap.xml/robots.txt will use the default domain. Pass SITE_URL=https://your-site to fix.')
}

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' })

run('node', ['scripts/generate-sitemap.mjs'])
run('npx', ['tsc', '-b'])
run('npx', ['vite', 'build'])

console.log('\nBuild complete → dist/')
