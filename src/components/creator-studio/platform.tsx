import { AtSign, Facebook, Globe, Instagram, X, Youtube, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { labelFor, PLATFORMS } from '@/lib/constants'
import type { SocialPlatform } from '@/types'

// Lucide has no X or Threads brand mark, so these use the nearest generic
// glyph — the same approach TikTok used before it was removed.
const ICONS: Record<SocialPlatform, LucideIcon> = {
  instagram: Instagram,
  youtube: Youtube,
  x: X,
  threads: AtSign,
  facebook: Facebook,
  other: Globe,
}

const TONES: Record<SocialPlatform, string> = {
  instagram: 'bg-rose-soft text-rose',
  youtube: 'bg-danger-soft text-danger',
  x: 'bg-night-soft text-ink',
  threads: 'bg-lilac-soft text-lilac',
  facebook: 'bg-sky-soft text-sky',
  other: 'bg-subtle text-ink-soft',
}

export function platformLabel(platform?: string | null) {
  return labelFor(PLATFORMS, platform)
}

/** Round tinted platform glyph (decorative — pair it with a text label). */
export function PlatformIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const Icon = ICONS[platform] ?? Globe
  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', TONES[platform] ?? TONES.other, className)} aria-hidden>
      <Icon className="size-[1.125rem]" />
    </span>
  )
}

/** Best-guess public profile link for a handle (used to prefill forms). */
export function profileUrlFor(platform: string, username: string) {
  const handle = username.trim().replace(/^@+/, '')
  if (!handle || /\s/.test(handle)) return null
  switch (platform) {
    case 'instagram':
      return `https://www.instagram.com/${handle}`
    case 'youtube':
      return `https://www.youtube.com/@${handle}`
    case 'x':
      return `https://x.com/${handle}`
    case 'threads':
      return `https://www.threads.com/@${handle}`
    case 'facebook':
      return `https://www.facebook.com/${handle}`
    default:
      return null
  }
}
