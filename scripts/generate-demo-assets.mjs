// Generates the original demo artwork referenced by supabase/seed.sql into public/demo/.
//
//   npm run gen:assets
//
// Everything here is drawn from scratch with primitives and the House of Collabs design
// tokens — no third-party images, clip-art or traced assets. Output is fully
// deterministic (each file is seeded from its own name) so re-running produces
// byte-identical files and diffs stay empty.
//
//   avatars/creator-01..35.svg   400x400   abstract creator portraits
//   brands/<slug>.svg            256x256   monogram badges
//   covers/<category>.svg       1600x400   storefront banners
//   portfolio/<category>-1..6.svg 800x1000 portfolio pieces
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'demo')

// ---------------------------------------------------------------------------
// Deterministic randomness — seeded per file name.
// ---------------------------------------------------------------------------
function makeRng(seedText) {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let a = h >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
const between = (rng, min, max) => min + rng() * (max - min)
const int = (rng, min, max) => Math.floor(between(rng, min, max + 1))
const r2 = (n) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// Palette — mirrors the tokens in src/styles/index.css.
// ---------------------------------------------------------------------------
const C = {
  canvas: '#f8f7fa', surface: '#ffffff', subtle: '#f2f0f6', mutedSurface: '#e9e6ef',
  line: '#e7e4ee', ink: '#111111', inkSoft: '#3a3446', muted: '#6b6478', night: '#140d1a',
  lime: '#e1306c', limeStrong: '#c13584', limeSoft: '#fde8f0', limeInk: '#8a1140',
  rose: '#cc3d64', roseSoft: '#ffe3e8', peach: '#d4622f', peachSoft: '#ffe7d9',
  sand: '#936712', sandSoft: '#f6ead0', mint: '#1d8656', mintSoft: '#dcf4e7',
  sky: '#2f67d8', skySoft: '#e0edff', lilac: '#6a4fd1', lilacSoft: '#ebe5ff',
}

/** Each theme: [deep accent, soft wash, bright pop]. */
const THEMES = {
  beauty: [C.rose, C.roseSoft, C.peach],
  fashion: [C.lilac, C.lilacSoft, C.rose],
  fitness: [C.limeInk, C.limeSoft, C.limeStrong],
  lifestyle: [C.sand, C.sandSoft, C.peach],
  food: [C.peach, C.peachSoft, C.sand],
  travel: [C.sky, C.skySoft, C.mint],
  technology: [C.ink, C.skySoft, C.sky],
  gaming: [C.lilac, C.lilacSoft, C.limeStrong],
  parenting: [C.mint, C.mintSoft, C.peach],
  education: [C.sky, C.skySoft, C.sand],
  skincare: [C.mint, C.mintSoft, C.limeStrong],
  couple: [C.rose, C.roseSoft, C.lilac],
  ugc: [C.limeInk, C.limeSoft, C.lime],
  photography: [C.inkSoft, C.subtle, C.sand],
  finance: [C.mint, C.mintSoft, C.sky],
}
const CATEGORIES = Object.keys(THEMES)

const svg = (w, h, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img"${extra}>\n${body}\n</svg>\n`

/** Subtle paper grain so flat fills don't look sterile. */
function grain(id, opacity = 0.045) {
  return `  <filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="${opacity}"/></feComponentTransfer>
  </filter>`
}

// ---------------------------------------------------------------------------
// Avatars — abstract portraits, never a real likeness.
// ---------------------------------------------------------------------------
function avatar(name) {
  const rng = makeRng(name)
  const [deep, soft, pop] = THEMES[pick(rng, CATEGORIES)]
  const S = 400
  const skin = pick(rng, ['#e8c4a0', '#d9a878', '#c08b5c', '#9c6741', '#7a4b2c', '#f0d5b8'])
  const cx = 200
  const headR = int(rng, 74, 84)
  const headY = int(rng, 168, 178)
  const hair = pick(rng, ['bob', 'bun', 'curls', 'crop', 'wrap', 'long'])
  const parts = []

  parts.push(`  <rect width="${S}" height="${S}" fill="${soft}"/>`)
  // Backdrop geometry
  const style = int(rng, 0, 2)
  if (style === 0) parts.push(`  <circle cx="${cx}" cy="${int(rng, 190, 215)}" r="${int(rng, 120, 140)}" fill="${pop}" opacity="0.34"/>`)
  else if (style === 1) parts.push(`  <path d="M0 ${int(rng, 230, 270)} Q ${S / 2} ${int(rng, 150, 200)} ${S} ${int(rng, 230, 270)} L ${S} ${S} L 0 ${S} Z" fill="${pop}" opacity="0.3"/>`)
  else parts.push(`  <rect x="${int(rng, 30, 60)}" y="${int(rng, 40, 70)}" width="${int(rng, 270, 320)}" height="${int(rng, 270, 320)}" rx="${int(rng, 40, 120)}" fill="${pop}" opacity="0.28"/>`)

  // Shoulders
  const shW = int(rng, 210, 250)
  parts.push(`  <path d="M${r2(cx - shW / 2)} ${S} Q ${cx} ${int(rng, 268, 292)} ${r2(cx + shW / 2)} ${S} Z" fill="${deep}"/>`)
  // Neck
  parts.push(`  <rect x="${cx - 24}" y="${headY + headR - 26}" width="48" height="66" rx="22" fill="${skin}"/>`)

  // Hair behind
  if (hair === 'long') parts.push(`  <path d="M${cx - headR - 16} ${headY + 12} q 0 -${headR + 46} ${headR + 16} -${headR + 46} q ${headR + 16} 0 ${headR + 16} ${headR + 46} l 0 ${int(rng, 96, 128)} q -14 16 -30 4 l 0 -${int(rng, 76, 100)} l -${2 * headR - 8} 0 l 0 ${int(rng, 76, 100)} q -16 12 -30 -4 Z" fill="${C.ink}" opacity="0.9"/>`)
  if (hair === 'bun') parts.push(`  <circle cx="${cx}" cy="${headY - headR - 4}" r="${int(rng, 26, 34)}" fill="${C.ink}" opacity="0.9"/>`)

  // Head
  parts.push(`  <circle cx="${cx}" cy="${headY}" r="${headR}" fill="${skin}"/>`)

  // Hair in front
  if (hair === 'bob' || hair === 'long' || hair === 'bun') {
    parts.push(`  <path d="M${cx - headR} ${headY - 6} a ${headR} ${headR} 0 0 1 ${headR * 2} 0 q -${headR * 0.5} -${headR * 0.34} -${headR} -${headR * 0.3} q -${headR * 0.5} -0.04 -${headR} ${headR * 0.3} Z" fill="${C.ink}" opacity="0.92"/>`)
  } else if (hair === 'curls') {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI
      parts.push(`  <circle cx="${r2(cx + Math.cos(a) * headR * 0.86)}" cy="${r2(headY + Math.sin(a) * headR * 0.86)}" r="${int(rng, 17, 24)}" fill="${C.ink}" opacity="0.9"/>`)
    }
  } else if (hair === 'crop') {
    parts.push(`  <path d="M${cx - headR} ${headY - 10} a ${headR} ${headR} 0 0 1 ${headR * 2} 0 l 0 -8 a ${headR} ${headR} 0 0 0 -${headR * 2} 0 Z" fill="${C.ink}" opacity="0.9"/>`)
    parts.push(`  <path d="M${cx - headR + 4} ${headY - 14} a ${headR - 4} ${headR - 4} 0 0 1 ${(headR - 4) * 2} 0 q -${headR * 0.6} -${headR * 0.5} -${(headR - 4) * 2} 0 Z" fill="${C.ink}" opacity="0.9"/>`)
  } else {
    // headwrap
    parts.push(`  <path d="M${cx - headR} ${headY - 2} a ${headR} ${headR} 0 0 1 ${headR * 2} 0 q -${headR} -${headR * 0.62} -${headR * 2} 0 Z" fill="${deep}"/>`)
    parts.push(`  <circle cx="${cx + headR - 10}" cy="${headY - headR * 0.52}" r="13" fill="${deep}"/>`)
  }

  // Face — minimal, friendly, non-identifying
  const eyeY = headY + int(rng, -2, 6)
  const eyeDx = int(rng, 25, 31)
  parts.push(`  <circle cx="${cx - eyeDx}" cy="${eyeY}" r="5.5" fill="${C.ink}"/>`)
  parts.push(`  <circle cx="${cx + eyeDx}" cy="${eyeY}" r="5.5" fill="${C.ink}"/>`)
  parts.push(`  <path d="M${cx - 19} ${eyeY + 27} q 19 ${int(rng, 14, 22)} 38 0" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>`)
  if (rng() > 0.62) {
    parts.push(`  <circle cx="${cx - eyeDx - 20}" cy="${eyeY + 15}" r="9" fill="${C.rose}" opacity="0.28"/>`)
    parts.push(`  <circle cx="${cx + eyeDx + 20}" cy="${eyeY + 15}" r="9" fill="${C.rose}" opacity="0.28"/>`)
  }
  if (rng() > 0.7) {
    parts.push(`  <circle cx="${cx - headR - 2}" cy="${eyeY + 20}" r="7" fill="${pop}"/>`)
    parts.push(`  <circle cx="${cx + headR + 2}" cy="${eyeY + 20}" r="7" fill="${pop}"/>`)
  }

  parts.push(`  <defs>${grain('g', 0.05)}</defs>`)
  parts.push(`  <rect width="${S}" height="${S}" filter="url(#g)" opacity="0.5"/>`)
  return svg(S, S, parts.join('\n'), ' aria-label="Illustrated creator avatar"')
}

// ---------------------------------------------------------------------------
// Brand logos — monogram badges built from the slug.
// ---------------------------------------------------------------------------
const BRAND_THEME = {
  'kumkum-naturals': [C.rose, C.roseSoft], 'urban-tiffin-co': [C.peach, C.peachSoft],
  'nimbus-audio': [C.sky, C.skySoft], 'saffron-street': [C.sand, C.sandSoft],
  'peak-protein-labs': [C.limeInk, C.limeSoft], 'chai-circle': [C.sand, C.sandSoft],
  'loom-and-lace': [C.lilac, C.lilacSoft], 'byte-gadgets': [C.ink, C.skySoft],
  'wander-bags': [C.mint, C.mintSoft], 'little-sprouts': [C.mint, C.mintSoft],
}

function brandLogo(slug) {
  const rng = makeRng(`brand:${slug}`)
  const [deep, soft] = BRAND_THEME[slug] ?? [C.ink, C.subtle]
  const S = 256
  const initials = slug.split('-').filter((w) => !['and', 'co', 'labs'].includes(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  const shape = int(rng, 0, 2)
  const parts = [`  <rect width="${S}" height="${S}" fill="${soft}"/>`]

  if (shape === 0) parts.push(`  <circle cx="128" cy="128" r="92" fill="${deep}"/>`)
  else if (shape === 1) parts.push(`  <rect x="36" y="36" width="184" height="184" rx="52" fill="${deep}"/>`)
  else parts.push(`  <path d="M128 30 L226 128 L128 226 L30 128 Z" fill="${deep}"/>`)

  // Geometric accent that reads as a mark, not a letterform
  const accent = int(rng, 0, 2)
  if (accent === 0) parts.push(`  <circle cx="${int(rng, 186, 204)}" cy="${int(rng, 52, 70)}" r="16" fill="${soft}" opacity="0.9"/>`)
  else if (accent === 1) parts.push(`  <path d="M40 200 q 88 -46 176 0" stroke="${soft}" stroke-width="8" stroke-linecap="round" opacity="0.55"/>`)

  parts.push(
    `  <text x="128" y="128" text-anchor="middle" dominant-baseline="central" fill="${soft}" font-family="Bricolage Grotesque, Geist, Segoe UI, system-ui, sans-serif" font-size="${initials.length > 1 ? 84 : 104}" font-weight="700" letter-spacing="-3">${initials}</text>`,
  )
  parts.push(`  <defs>${grain('gb', 0.04)}</defs><rect width="${S}" height="${S}" filter="url(#gb)" opacity="0.45"/>`)
  return svg(S, S, parts.join('\n'), ` aria-label="${slug} logo"`)
}

// ---------------------------------------------------------------------------
// Covers — wide storefront banners.
// ---------------------------------------------------------------------------
function cover(category) {
  const rng = makeRng(`cover:${category}`)
  const [deep, soft, pop] = THEMES[category]
  const W = 1600, H = 400
  const parts = [`  <rect width="${W}" height="${H}" fill="${soft}"/>`]

  // Layered arcs sweeping across the banner
  for (let i = 0; i < 4; i++) {
    const y = int(rng, -60, 160)
    const amp = int(rng, 70, 190)
    const fill = [deep, pop, C.surface][i % 3]
    parts.push(`  <path d="M0 ${y + amp} Q ${int(rng, 300, 620)} ${y - amp * 0.5} ${W / 2} ${y + amp * 0.4} T ${W} ${y + amp * 0.2} L ${W} ${H} L 0 ${H} Z" fill="${fill}" opacity="${r2(between(rng, 0.14, 0.34))}"/>`)
  }
  // Confetti discs
  for (let i = 0; i < int(rng, 7, 12); i++) {
    parts.push(`  <circle cx="${int(rng, 40, W - 40)}" cy="${int(rng, 40, H - 40)}" r="${int(rng, 6, 30)}" fill="${i % 2 ? deep : pop}" opacity="${r2(between(rng, 0.16, 0.5))}"/>`)
  }
  // Grounding bar
  parts.push(`  <rect x="0" y="${H - 14}" width="${W}" height="14" fill="${deep}" opacity="0.85"/>`)
  parts.push(`  <defs>${grain('gc', 0.05)}</defs><rect width="${W}" height="${H}" filter="url(#gc)" opacity="0.5"/>`)
  return svg(W, H, parts.join('\n'), ` aria-label="${category} cover"`)
}

// ---------------------------------------------------------------------------
// Portfolio pieces — 4:5 abstract compositions themed per category.
// ---------------------------------------------------------------------------
function portfolio(category, variant) {
  const rng = makeRng(`portfolio:${category}:${variant}`)
  const [deep, soft, pop] = THEMES[category]
  const W = 800, H = 1000
  const parts = [`  <rect width="${W}" height="${H}" fill="${soft}"/>`]
  const layout = (variant - 1) % 6

  if (layout === 0) {
    // Stacked horizon bands
    let y = int(rng, 120, 220)
    for (let i = 0; i < 5; i++) {
      const h = int(rng, 70, 190)
      parts.push(`  <rect x="0" y="${y}" width="${W}" height="${h}" fill="${[deep, pop, C.surface, C.ink][i % 4]}" opacity="${r2(between(rng, 0.2, 0.62))}"/>`)
      y += h + int(rng, -20, 26)
    }
    parts.push(`  <circle cx="${int(rng, 220, 580)}" cy="${int(rng, 180, 300)}" r="${int(rng, 70, 120)}" fill="${pop}" opacity="0.8"/>`)
  } else if (layout === 1) {
    // Concentric rings
    const cx = int(rng, 320, 480), cy = int(rng, 420, 580)
    for (let i = 7; i >= 1; i--) {
      parts.push(`  <circle cx="${cx}" cy="${cy}" r="${i * int(rng, 44, 54)}" fill="${i % 2 ? deep : pop}" opacity="${r2(0.16 + i * 0.045)}"/>`)
    }
    parts.push(`  <rect x="0" y="${H - int(rng, 120, 200)}" width="${W}" height="200" fill="${C.ink}" opacity="0.14"/>`)
  } else if (layout === 2) {
    // Editorial grid
    const cols = int(rng, 2, 3), rows = int(rng, 3, 4), gap = 22
    const cw = (W - gap * (cols + 1)) / cols, ch = (H - gap * (rows + 1)) / rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const fill = pick(rng, [deep, pop, C.surface, C.ink, soft])
        parts.push(`  <rect x="${r2(gap + c * (cw + gap))}" y="${r2(gap + r * (ch + gap))}" width="${r2(cw)}" height="${r2(ch)}" rx="${int(rng, 6, 28)}" fill="${fill}" opacity="${r2(between(rng, 0.45, 0.95))}"/>`)
      }
    }
  } else if (layout === 3) {
    // Diagonal ribbons
    for (let i = 0; i < 6; i++) {
      const x = int(rng, -240, W)
      parts.push(`  <path d="M${x} ${H} L ${x + int(rng, 150, 300)} ${H} L ${x + int(rng, 420, 640)} 0 L ${x + int(rng, 240, 400)} 0 Z" fill="${i % 2 ? deep : pop}" opacity="${r2(between(rng, 0.2, 0.55))}"/>`)
    }
    parts.push(`  <circle cx="${int(rng, 180, 620)}" cy="${int(rng, 200, 800)}" r="${int(rng, 80, 140)}" fill="${C.surface}" opacity="0.72"/>`)
  } else if (layout === 4) {
    // Arch / portal
    const m = int(rng, 90, 150)
    parts.push(`  <path d="M${m} ${H - m} L ${m} ${int(rng, 330, 420)} a ${W / 2 - m} ${W / 2 - m} 0 0 1 ${W - m * 2} 0 L ${W - m} ${H - m} Z" fill="${deep}" opacity="0.9"/>`)
    parts.push(`  <circle cx="${W / 2}" cy="${int(rng, 380, 470)}" r="${int(rng, 70, 110)}" fill="${pop}"/>`)
    for (let i = 0; i < 3; i++) {
      parts.push(`  <rect x="${int(rng, 140, 560)}" y="${int(rng, 620, 820)}" width="${int(rng, 60, 180)}" height="${int(rng, 12, 26)}" rx="10" fill="${soft}" opacity="0.65"/>`)
    }
  } else {
    // Scattered geometry
    for (let i = 0; i < int(rng, 9, 15); i++) {
      const kind = int(rng, 0, 2)
      const x = int(rng, 40, W - 160), y = int(rng, 40, H - 160)
      const s = int(rng, 60, 220)
      const fill = pick(rng, [deep, pop, C.ink, C.surface])
      const op = r2(between(rng, 0.28, 0.78))
      if (kind === 0) parts.push(`  <circle cx="${x}" cy="${y}" r="${r2(s / 2)}" fill="${fill}" opacity="${op}"/>`)
      else if (kind === 1) parts.push(`  <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${int(rng, 0, 40)}" fill="${fill}" opacity="${op}"/>`)
      else parts.push(`  <path d="M${x} ${y + s} L ${r2(x + s / 2)} ${y} L ${x + s} ${y + s} Z" fill="${fill}" opacity="${op}"/>`)
    }
  }

  parts.push(`  <defs>${grain('gp', 0.055)}</defs><rect width="${W}" height="${H}" filter="url(#gp)" opacity="0.55"/>`)
  return svg(W, H, parts.join('\n'), ` aria-label="${category} portfolio piece"`)
}

// ---------------------------------------------------------------------------
// Write everything.
// ---------------------------------------------------------------------------
const written = { avatars: 0, brands: 0, covers: 0, portfolio: 0 }
for (const d of ['avatars', 'brands', 'covers', 'portfolio']) fs.mkdirSync(path.join(outDir, d), { recursive: true })

for (let i = 1; i <= 35; i++) {
  const name = `creator-${String(i).padStart(2, '0')}.svg`
  fs.writeFileSync(path.join(outDir, 'avatars', name), avatar(name))
  written.avatars++
}
for (const slug of Object.keys(BRAND_THEME)) {
  fs.writeFileSync(path.join(outDir, 'brands', `${slug}.svg`), brandLogo(slug))
  written.brands++
}
for (const cat of CATEGORIES) {
  fs.writeFileSync(path.join(outDir, 'covers', `${cat}.svg`), cover(cat))
  written.covers++
  for (let v = 1; v <= 6; v++) {
    fs.writeFileSync(path.join(outDir, 'portfolio', `${cat}-${v}.svg`), portfolio(cat, v))
    written.portfolio++
  }
}

const total = Object.values(written).reduce((a, b) => a + b, 0)
console.log(`wrote ${total} demo SVGs to public/demo/ —`, Object.entries(written).map(([k, v]) => `${v} ${k}`).join(', '))
