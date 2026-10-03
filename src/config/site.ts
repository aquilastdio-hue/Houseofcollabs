/**
 * Brand + site configuration. Rename the product here — nothing else in the
 * UI hard-codes the brand name.
 */
export const site = {
  name: 'House of Collabs',
  /** Lowercase, no spaces — for storage keys, client ids and similar. */
  slug: 'house-of-collabs',
  description:
    'House of Collabs is the creator marketplace for brands in India. Discover vetted creators, compare fixed prices and delivery times, and order UGC, reels and reviews in minutes.',
  url: (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || '',
  supportEmail: 'support@houseofcollabs.example',
  partnershipsEmail: 'partners@houseofcollabs.example',
  address: 'Indiranagar, Bengaluru, Karnataka 560038',
  /** Prefix of generated order numbers. Set by the DB column default — kept here for display copy. */
  orderPrefix: 'HOC',
  social: {
    instagram: 'https://instagram.com/',
    linkedin: 'https://linkedin.com/',
    x: 'https://x.com/',
  },
} as const

export function siteUrl(path = '/') {
  const base = site.url || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Header navigation. Drives both the desktop bar and the mobile drawer.
 *
 * "Creators" points at /discover, not /creators: the latter sits behind
 * RequireAuth and renders a coming-soon page, so a signed-out visitor clicking
 * a header link labelled Creators would land on a login wall.
 */
export const publicNav: readonly { label: string; href: string }[] = [
  { label: 'Creators', href: '/discover' },
  // Collaboration and UGC are the two things creators here actually sell most
  // of -- 21 storefronts each. They filter the same marketplace rather than
  // being separate pages, so the listing, the filters and the empty states all
  // stay in one place.
  { label: 'Collaboration', href: '/discover?contentType=reel' },
  { label: 'UGC', href: '/ugc' },
  { label: 'Barter', href: '/barter' },
]

export const footerNav = {
  Product: [
    { label: 'Discover creators', href: '/discover' },
    { label: 'Categories', href: '/categories/ugc' },
  ],
  Company: [
    { label: 'Contact', href: '/contact' },
    { label: 'Creator guidelines', href: '/creator-guidelines' },
    { label: 'Brand guidelines', href: '/brand-guidelines' },
  ],
  Legal: [
    { label: 'Terms of service', href: '/terms' },
    { label: 'Privacy policy', href: '/privacy' },
    { label: 'Cookie policy', href: '/cookie-policy' },
    { label: 'Refund policy', href: '/refund-policy' },
    { label: 'Payout policy', href: '/payout-policy' },
  ],
} as const
