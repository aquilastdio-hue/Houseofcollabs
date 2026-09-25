import { ExternalLink, Globe, Instagram, Volume2 } from 'lucide-react'
import type { BriefDetail } from '@/services/briefs.service'
import { Avatar } from '@/components/ui/avatar'
import { SectionCard } from '@/components/brand/section-card'
import { displayUrl, safeHref } from '@/components/brand/validators'

/** Brand identity block on a brief: logo, name, pronunciation (text + audio), links. */
export function BriefBrandCard({ brand, title = 'Brand' }: { brand: BriefDetail['brand']; title?: string }) {
  const website = safeHref(brand.website_url)
  const instagram = safeHref(brand.instagram_url)
  const audio = safeHref(brand.pronunciation_audio_url)

  return (
    <SectionCard title={title} bodyClassName="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar src={brand.brand_logo_url} name={brand.brand_name} size="lg" shape="rounded" />
        <div className="min-w-0">
          <p className="truncate font-medium">{brand.brand_name}</p>
          {brand.brand_pronunciation && (
            <p className="text-sm text-muted">
              Pronounced <span className="font-medium text-ink-soft">“{brand.brand_pronunciation}”</span>
            </p>
          )}
        </div>
      </div>

      {audio && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Volume2 className="size-3.5" aria-hidden /> Hear how to say it
          </p>
          <audio controls preload="none" src={audio} className="h-10 w-full" aria-label={`How to pronounce ${brand.brand_name}`} />
        </div>
      )}

      {(website || instagram) && (
        <ul className="space-y-1.5 text-sm">
          {website && (
            <li>
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="focus-ring inline-flex max-w-full items-center gap-2 rounded text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                <Globe className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="truncate">{displayUrl(website)}</span>
                <ExternalLink className="size-3.5 shrink-0 text-faint" aria-hidden />
              </a>
            </li>
          )}
          {instagram && (
            <li>
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="focus-ring inline-flex max-w-full items-center gap-2 rounded text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                <Instagram className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="truncate">{displayUrl(instagram)}</span>
                <ExternalLink className="size-3.5 shrink-0 text-faint" aria-hidden />
              </a>
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  )
}
