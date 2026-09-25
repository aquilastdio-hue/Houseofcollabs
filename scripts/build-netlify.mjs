// Production build for Netlify (and for a local `dist/` you drag-and-drop).
//
// Why this exists rather than a plain `vite build`:
//
//  1. `.env.local` sets VITE_SITE_URL=http://localhost:5173 for dev, and Vite
//     reads .env.local in every mode — so a local production build happily bakes
//     "localhost" into the canonical/OpenGraph URLs. This strips any localhost
//     value so the app falls back to window.location.origin, which is correct on
//     whatever domain it ends up on.
//
//  2. The sitemap needs an absolute origin at build time. Netlify provides one
//     automatically ($URL for production, $DEPLOY_PRIME_URL for previews).
//
// Resolution order for the site URL:
//     SITE_URL → VITE_SITE_URL → DEPLOY_PRIME_URL → URL   (localhost ignored)
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isLocal = (u) => !u || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(u)

const candidates = [process.env.SITE_URL, process.env.VITE_SITE_URL, process.env.DEPLOY_PRIME_URL, process.env.URL]
const siteUrl = candidates.find((u) => u && !isLocal(u))?.replace(/\/$/, '')

const env = { ...process.env }
if (siteUrl) {
  env.SITE_URL = siteUrl
  env.VITE_SITE_URL = siteUrl
  console.log(`site URL: ${siteUrl}`)
} else {
  // No usable absolute URL. Drop the dev value so the bundle doesn't ship
  // localhost; the app resolves its own origin at runtime instead.
  const dropped = candidates.filter(Boolean)
  delete env.SITE_URL
  delete env.VITE_SITE_URL
  env.VITE_SITE_URL = '' // explicit empty beats .env.local's dev value
  console.log(
    dropped.length
      ? `site URL: none usable (ignored ${dropped.join(', ')}) — canonical links will use window.location.origin`
      : 'site URL: not set — canonical links will use window.location.origin',
  )
  console.log('note: sitemap.xml/robots.txt will use the default domain. Pass SITE_URL=https://your-site to fix.')
}

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' })

run('node', ['scripts/generate-sitemap.mjs'])
run('npx', ['tsc', '-b'])
run('npx', ['vite', 'build'])

console.log('\nBuild complete → dist/')
console.log('dist/ contains _redirects and _headers, so a drag-and-drop deploy keeps SPA routing and caching.')
