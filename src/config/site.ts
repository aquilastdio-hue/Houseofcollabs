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
 * Empty by design: the landing page funnels straight to Collabs / Creators, so
 * the header carries the logo and the two auth actions only.
 */
export const publicNav: readonly { label: string; href: string }[] = []

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
