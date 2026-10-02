import { site, siteUrl } from '@/config/site'

/**
 * Schema.org graphs for the public site.
 *
 * Kept here rather than inline so the same object is emitted everywhere a page
 * needs it, and so there is one place to check a claim against. Everything
 * below describes something a visitor can see on the page it is attached to —
 * schema that disagrees with the visible content is worse than none.
 *
 * `scripts/prerender-meta.mjs` writes the homepage graphs again for crawlers
 * that do not run JavaScript. If you change these, change that too.
 */

/** The company. Attached to the homepage only — one per site. */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: siteUrl('/'),
    logo: siteUrl('/house-of-collabs-logo.webp'),
    description: site.description,
    areaServed: 'IN',
  }
}

/** The site itself, so search engines can attribute pages to one property. */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: siteUrl('/'),
    inLanguage: 'en-IN',
  }
}

/**
 * A list of creators, for a browse page.
 *
 * Positions are 1-based and point at the storefront each card links to, which
 * is what makes this an honest description of the page rather than a keyword
 * dump: every entry corresponds to a card the visitor can actually click.
 */
export function creatorListSchema(creators: { slug: string; display_name: string }[], listName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: creators.length,
    itemListElement: creators.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: siteUrl(`/creators/${c.slug}`),
      name: c.display_name,
    })),
  }
}
