import { Link } from 'react-router'
import {
  BookOpen,
  Camera,
  CirclePlay,
  Clapperboard,
  Film,
  Images,
  Mic,
  PackageOpen,
  Smartphone,
  Star,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CONTENT_TYPES } from '@/lib/constants'

const FORMAT_ICONS: Record<string, LucideIcon> = {
  ugc_video: Smartphone,
  reel: Clapperboard,
  story: CirclePlay,
  post: Images,
  youtube_video: Youtube,
  short: Film,
  photo: Camera,
  review: Star,
  unboxing: PackageOpen,
  tutorial: BookOpen,
  live: Mic,
}

const FORMATS = CONTENT_TYPES.filter((t) => t.value !== 'other')

/** Content formats as chips that open the marketplace filtered by format. */
export function ContentFormats({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {FORMATS.map((format) => {
        const Icon = FORMAT_ICONS[format.value] ?? Smartphone
        return (
          <li key={format.value}>
            <Link
              to={`/discover?contentType=${format.value}`}
              className="focus-ring group inline-flex h-10 items-center gap-2 rounded-pill border border-line bg-surface pr-4 pl-3 text-sm font-medium text-ink-soft transition-[border-color,color,background-color] duration-200 hover:border-ink hover:bg-ink hover:text-white"
            >
              <Icon className="size-4 text-muted transition-colors group-hover:text-brand" aria-hidden />
              {format.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
