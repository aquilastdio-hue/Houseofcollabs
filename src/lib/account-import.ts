import { parseCsv, toCsv, uncell } from './csv'

/**
 * Admin → Creators / Brands → More → Upload CSV: turning a spreadsheet into
 * rows for the admin-import-accounts Edge Function. Everything here runs in
 * the browser before anything is sent, so the admin sees every problem first.
 */

export type AccountKind = 'creator' | 'brand'

/** One account to create. Only `email` and the name are required. */
export type ImportRow = {
  email: string
  name: string | null
  brand_name?: string | null
  phone: string | null
  instagram: string | null
  followers?: number | null
  categories?: string[]
  city: string | null
  state?: string | null
  bio?: string | null
  website?: string | null
  industry?: string | null
}

export type ImportProblem = { line: number; message: string }

type Column = {
  key: keyof ImportRow
  header: string
  aliases: string[]
  required?: boolean
  example: string
}

/**
 * The columns the template has. Headers are matched loosely ("E-mail",
 * "WhatsApp number"...), and a file exported from the same page reads back in
 * as is: extra columns are ignored.
 */
export const IMPORT_COLUMNS: Record<AccountKind, Column[]> = {
  creator: [
    {
      key: 'name',
      header: 'Name',
      aliases: ['full name', 'creator name', 'display name', 'creator'],
      required: true,
      example: 'Riya Sharma',
    },
    {
      key: 'email',
      header: 'Email',
      aliases: ['email address', 'e mail', 'mail'],
      required: true,
      example: 'riya@example.com',
    },
    {
      key: 'phone',
      header: 'WhatsApp',
      aliases: ['whatsapp number', 'phone', 'phone number', 'mobile', 'mobile number'],
      example: '+91 98765 43210',
    },
    {
      key: 'instagram',
      header: 'Instagram',
      aliases: ['instagram handle', 'instagram id', 'instagram url', 'insta', 'ig'],
      example: '@riyasharma',
    },
    {
      key: 'followers',
      header: 'Followers',
      aliases: ['followers count', 'instagram followers'],
      example: '12.5K',
    },
    {
      key: 'categories',
      header: 'Categories',
      aliases: ['category', 'niche', 'niches'],
      example: 'Fashion; Beauty',
    },
    { key: 'city', header: 'City', aliases: ['location'], example: 'Delhi' },
    { key: 'state', header: 'State', aliases: [], example: 'Delhi' },
    {
      key: 'bio',
      header: 'Bio',
      aliases: ['about', 'description'],
      example: 'Fashion and lifestyle creator from Delhi.',
    },
  ],
  brand: [
    {
      key: 'brand_name',
      header: 'Brand name',
      aliases: ['brand', 'company', 'company name'],
      required: true,
      example: 'Aquila Studio',
    },
    {
      key: 'name',
      header: 'Contact person',
      aliases: ['contact name', 'name', 'full name'],
      example: 'Anita Rao',
    },
    {
      key: 'email',
      header: 'Email',
      aliases: ['email address', 'e mail', 'mail', 'contact email'],
      required: true,
      example: 'hello@aquilastudio.in',
    },
    {
      key: 'phone',
      header: 'Phone',
      aliases: ['whatsapp', 'whatsapp number', 'phone number', 'mobile', 'contact phone'],
      example: '+91 98765 43210',
    },
    {
      key: 'website',
      header: 'Website',
      aliases: ['website url', 'url', 'site'],
      example: 'aquilastudio.in',
    },
    {
      key: 'instagram',
      header: 'Instagram',
      aliases: ['instagram handle', 'instagram url', 'insta', 'ig'],
      example: '@aquilastudio',
    },
    {
      key: 'industry',
      header: 'Industry',
      aliases: ['category'],
      example: 'Fashion',
    },
    { key: 'city', header: 'City', aliases: ['location'], example: 'Mumbai' },
  ],
}

export const MAX_IMPORT_ROWS = 500

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const norm = (header: string) =>
  header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** "12.5K" → 12500, "1.2M" → 1200000, "12,000" → 12000; anything else → null. */
export function parseFollowers(value: string): number | null {
  const m = value
    .trim()
    .replace(/,/g, '')
    .match(/^(\d+(?:\.\d+)?)\s*([kKmM])?$/)
  if (!m) return null
  const n = Number(m[1]) * (m[2] ? (m[2].toLowerCase() === 'k' ? 1_000 : 1_000_000) : 1)
  return Number.isFinite(n) ? Math.round(n) : null
}

export function templateCsv(kind: AccountKind) {
  const columns = IMPORT_COLUMNS[kind]
  return toCsv(
    columns.map((c) => c.header),
    [columns.map((c) => c.example)],
  )
}

export function readImportFile(text: string, kind: AccountKind): { rows: (ImportRow & { line: number })[]; problems: ImportProblem[] } {
  const table = parseCsv(text)
  if (table.length < 2)
    return {
      rows: [],
      problems: [{ line: 0, message: 'The file has no rows under the header.' }],
    }

  const header = table[0]!.map(norm)
  const used = new Set<number>()
  const index = new Map<keyof ImportRow, number>()
  // Exact header names first, so "Name" wins over a "Full name" column that only matches an alias.
  for (const pass of ['exact', 'alias'] as const) {
    for (const col of IMPORT_COLUMNS[kind]) {
      if (index.has(col.key)) continue
      const names = pass === 'exact' ? [norm(col.header)] : col.aliases.map(norm)
      const at = header.findIndex((h, i) => !used.has(i) && names.includes(h))
      if (at >= 0) {
        index.set(col.key, at)
        used.add(at)
      }
    }
  }
  const missing = IMPORT_COLUMNS[kind].filter((c) => c.required && !index.has(c.key)).map((c) => c.header)
  if (missing.length) {
    return {
      rows: [],
      problems: [
        {
          line: 1,
          message: `The file needs ${missing.map((m) => `a “${m}” column`).join(' and ')}.`,
        },
      ],
    }
  }

  const rows: (ImportRow & { line: number })[] = []
  const problems: ImportProblem[] = []
  const seen = new Map<string, number>()
  const body = table.slice(1)
  if (body.length > MAX_IMPORT_ROWS) {
    problems.push({
      line: MAX_IMPORT_ROWS + 2,
      message: `Only ${MAX_IMPORT_ROWS} rows go in at a time; the rest of the file was left out.`,
    })
  }

  body.slice(0, MAX_IMPORT_ROWS).forEach((cells, i) => {
    const line = i + 2
    const get = (key: keyof ImportRow) => {
      const at = index.get(key)
      return at === undefined ? '' : uncell(cells[at] ?? '')
    }
    const opt = (key: keyof ImportRow) => get(key) || null

    const email = get('email').toLowerCase()
    const name = opt('name')
    const brand = opt('brand_name')
    if (!EMAIL_RE.test(email))
      return problems.push({
        line,
        message: email ? `“${email}” isn’t an email address.` : 'No email.',
      })
    if (seen.has(email))
      return problems.push({
        line,
        message: `${email} is already on line ${seen.get(email)}.`,
      })
    if (kind === 'brand' && (!brand || brand.length < 2)) return problems.push({ line, message: 'No brand name.' })
    if (kind === 'creator' && (!name || name.length < 2)) return problems.push({ line, message: 'No name.' })
    seen.set(email, line)

    const row: ImportRow & { line: number } = {
      line,
      email,
      name,
      phone: opt('phone'),
      instagram: opt('instagram'),
      city: opt('city'),
    }
    if (kind === 'creator') {
      row.followers = parseFollowers(get('followers'))
      row.categories = get('categories')
        .split(/[;,|]/)
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 5)
      row.state = opt('state')
      row.bio = opt('bio')
    } else {
      row.brand_name = brand
      row.website = opt('website')
      row.industry = opt('industry')
    }
    rows.push(row)
  })

  return { rows, problems }
}
