import { AtSign, Facebook, Globe, Instagram, X, Youtube, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  instagram: Instagram,
  youtube: Youtube,
  x: X,
  threads: AtSign,
  facebook: Facebook,
}

/** Social platform glyph (X and Threads have no Lucide mark, so they use the nearest generic one). */
export function PlatformIcon({ platform, className }: { platform?: string | null; className?: string }) {
  const Icon = ICONS[platform ?? ''] ?? Globe
  return <Icon className={cn('size-4 shrink-0', className)} aria-hidden />
}
