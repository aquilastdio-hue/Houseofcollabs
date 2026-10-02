import { useLocation } from 'react-router'
import { site, siteUrl } from '@/config/site'

/** The shared social card. 1200x630 PNG — SVG is not rendered by any major crawler. */
export const DEFAULT_OG_IMAGE = '/og-image.png'

/**
 * Per-page document metadata. React 19 hoists <title>/<meta>/<link> into
 * <head>, so this can render anywhere in the tree.
 *
 * Note what this cannot do: the app is a client-rendered SPA, so the HTML the
 * server hands out carries only the shell's generic title. Google renders
 * JavaScript and picks these up on its second pass, but social crawlers
 * (Facebook, LinkedIn, WhatsApp, X) do not run JavaScript at all. The build
 * writes a static copy of the head for each public route so those crawlers see
 * the real thing — see `scripts/prerender-meta.mjs`. Keep the two in step: a
 * field added here is invisible to a link preview until it is added there too.
 */
export function Seo({
  title,
  description = site.description,
  image,
  imageAlt,
  canonical,
  noindex,
  type = 'website',
  jsonLd,
}: {
  title?: string
  description?: string
  /** Defaults to the shared 1200x630 card. Pass null for no image at all. */
  image?: string | null
  imageAlt?: string
  canonical?: string
  noindex?: boolean
  type?: 'website' | 'profile' | 'article'
  /** One schema object, or several — each is emitted as its own script tag. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}) {
  const { pathname } = useLocation()
  const fullTitle = title ? `${title} · ${site.name}` : site.name
  const url = siteUrl(canonical ?? pathname)
  // Only the shared card has known dimensions. A creator passes their avatar,
  // which is square and small — declaring 1200x630 for it would tell a crawler
  // to lay out a wide preview for an image that is nothing of the sort.
  const usingDefaultCard = image === undefined
  const src = image === undefined ? DEFAULT_OG_IMAGE : image
  const img = src ? (src.startsWith('http') ? src : siteUrl(src)) : undefined
  const graphs = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []
  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:site_name" content={site.name} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {img && (
        <>
          <meta property="og:image" content={img} />
          {/* Dimensions let a crawler lay out the card before it has fetched
              the file, which is the difference between a large preview and a
              thumbnail on the first share. */}
          {usingDefaultCard && <meta property="og:image:width" content="1200" />}
          {usingDefaultCard && <meta property="og:image:height" content="630" />}
          <meta property="og:image:alt" content={imageAlt ?? fullTitle} />
        </>
      )}
      <meta name="twitter:card" content={img ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {img && <meta name="twitter:image" content={img} />}
      {img && <meta name="twitter:image:alt" content={imageAlt ?? fullTitle} />}
      {graphs.map((graph, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(graph)}
        </script>
      ))}
    </>
  )
}
