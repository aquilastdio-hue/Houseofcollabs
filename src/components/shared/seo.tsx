import { useLocation } from 'react-router'
import { site, siteUrl } from '@/config/site'

/**
 * Per-page document metadata. React 19 hoists <title>/<meta>/<link> into
 * <head>, so this can render anywhere in the tree.
 */
export function Seo({
  title,
  description = site.description,
  image = '/og-image.svg',
  canonical,
  noindex,
  type = 'website',
  jsonLd,
}: {
  title?: string
  description?: string
  image?: string | null
  canonical?: string
  noindex?: boolean
  type?: 'website' | 'profile' | 'article'
  jsonLd?: Record<string, unknown>
}) {
  const { pathname } = useLocation()
  const fullTitle = title ? `${title} · ${site.name}` : site.name
  const url = siteUrl(canonical ?? pathname)
  const img = image ? (image.startsWith('http') ? image : siteUrl(image)) : undefined
  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:site_name" content={site.name} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {img && <meta property="og:image" content={img} />}
      <meta name="twitter:card" content={img ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {img && <meta name="twitter:image" content={img} />}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </>
  )
}
