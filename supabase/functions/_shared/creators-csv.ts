/**
 * The creators spreadsheet, column for column what Admin → Creators shows.
 * One builder for both ways out: the dashboard's Download CSV (website,
 * `@shared/creators-csv`) and the live link for Excel and Google Sheets
 * (Edge Function `creators-feed`), so the two always match. Pure: callers
 * fetch the rows from `admin_list_creators` / `creators_feed` and pass the
 * extra lookups in.
 */
import { exportInstagram, exportPhone, toCsv } from './spreadsheet.ts'

/** The service kinds with their own price column in Admin → Creators and the spreadsheet, with their labels. */
export const PRICE_COLUMNS = [
  { type: 'ugc_video', label: 'UGC' },
  { type: 'reel', label: 'Reel' },
  { type: 'story', label: 'Story' },
  { type: 'post', label: 'Feed post' },
  { type: 'youtube_video', label: 'YouTube video' },
] as const
export const PRICE_COLUMN_TYPES = PRICE_COLUMNS.map((c) => c.type)

/** Admin → Creators "IFCR": what a creator is worth per piece, at this many rupees per average view. */
export const FINAL_PRICE_PER_VIEW = 0.5

/** Average Instagram Reel views × FINAL_PRICE_PER_VIEW, to the rupee; null without a view count. */
export function finalPricing(avgViews: unknown): number | null {
  if (avgViews === null || avgViews === undefined || avgViews === '') return null
  const views = Number(avgViews)
  return Number.isFinite(views) ? Math.round(views * FINAL_PRICE_PER_VIEW) : null
}

/** A creator's price for one kind of service from `service_prices` (the lower one if they have two), or null. */
export function servicePrice(prices: unknown, type: string): number | null {
  const value = prices && typeof prices === 'object' ? (prices as Record<string, unknown>)[type] : undefined
  return value === undefined || value === null ? null : Number(value)
}

/** One row of `admin_list_creators` (and `creators_feed`, which returns the same columns). */
export type CreatorSheetRow = {
  id: string
  profile_id: string
  display_name: string | null
  email: string | null
  whatsapp: string | null
  slug: string | null
  city: string | null
  state: string | null
  status: string | null
  account_status: string | null
  verified: boolean | null
  featured: boolean | null
  followers_count: number | null
  engagement_rate: number | string | null
  avg_reel_views: number | string | null
  service_prices: unknown
  rating: number | string | null
  review_count: number | null
  categories: string[] | null
  orders_count: number | null
  revenue: number | string | null
  joined_at: string | null
  deleted_at: string | null
  referral_code: string | null
}

export type CreatorSheetLookups = {
  /** profile id → full name */
  names: Map<string, string>
  /** creator id → their Instagram account */
  instagram: Map<string, { username: string; profile_url: string | null }>
  /** creator id → services a brand can order, in storefront order */
  services: Map<string, { title: string; price: number | string }[]>
  /** The website, for profile links: https://www.houseofcollabs.com */
  siteUrl: string
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inrPrecise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** ₹2,000, with paise only when there are some (as the website shows prices). */
const rupees = (amount: number | string) => {
  const n = Number(amount)
  return Number.isInteger(n) ? inr.format(n) : inrPrecise.format(n)
}

/** 2026-11-05, the day in India. */
const indiaDay = (iso: string | null) => {
  if (!iso) return ''
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}`
}

const yes = (v: boolean | null | undefined) => (v ? 'Yes' : 'No')

/**
 * The CSV text. The first columns are the upload template's, so an edited
 * download can go straight back in. Add the byte-order mark when saving or
 * serving it, so Excel reads ₹ as UTF-8.
 */
export function creatorsCsv(rows: readonly CreatorSheetRow[], lookups: CreatorSheetLookups): string {
  const site = lookups.siteUrl.replace(/\/$/, '')
  const header = [
    'Name',
    'Email',
    'WhatsApp',
    'Instagram',
    'Followers',
    'Categories',
    'City',
    'State',
    'Engagement rate (%)',
    'Avg views',
    ...PRICE_COLUMNS.map((c) => `${c.label} (₹)`),
    'IFCR (₹)',
    'All services',
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
  const body = rows.map((c) => {
    const ig = lookups.instagram.get(c.id)
    return [
      c.display_name,
      c.email,
      exportPhone(c.whatsapp),
      ig ? exportInstagram(ig.profile_url, ig.username) : '',
      c.followers_count,
      c.categories,
      c.city,
      c.state,
      c.engagement_rate == null ? '' : Number(c.engagement_rate).toFixed(2),
      c.avg_reel_views == null ? '' : Math.round(Number(c.avg_reel_views)),
      ...PRICE_COLUMNS.map((p) => servicePrice(c.service_prices, p.type) ?? ''),
      finalPricing(c.avg_reel_views) ?? '',
      (lookups.services.get(c.id) ?? []).map((s) => `${s.title}: ${rupees(s.price)}`).join('; '),
      lookups.names.get(c.profile_id) ?? '',
      c.deleted_at ? 'removed' : c.status,
      c.account_status,
      yes(c.verified),
      yes(c.featured),
      c.orders_count,
      c.revenue,
      c.review_count ? c.rating : '',
      c.review_count,
      c.referral_code,
      c.slug ? `${site}/creators/${c.slug}` : '',
      indiaDay(c.joined_at),
    ]
  })
  return toCsv(header, body)
}
