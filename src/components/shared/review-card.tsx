import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { Avatar } from '@/components/ui/avatar'
import { StarRating } from './star-rating'

export function ReviewCard({
  rating,
  comment,
  authorName,
  authorImage,
  subtitle,
  date,
  response,
  responderName,
  className,
}: {
  rating: number
  comment?: string | null
  authorName: string
  authorImage?: string | null
  subtitle?: string | null
  date?: string | null
  response?: string | null
  responderName?: string
  className?: string
}) {
  return (
    <article className={cn('flex flex-col gap-4 rounded-card border border-line bg-surface p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <StarRating value={rating} />
        {date && <time className="text-xs text-faint">{formatDate(date)}</time>}
      </div>
      {comment ? <p className="leading-relaxed text-ink-soft">“{comment}”</p> : <p className="text-sm text-muted italic">No written feedback.</p>}
      <div className="flex items-center gap-3">
        <Avatar src={authorImage} name={authorName} size="sm" shape="rounded" />
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{authorName}</p>
          {subtitle && <p className="truncate text-muted">{subtitle}</p>}
        </div>
      </div>
      {response && (
        <div className="rounded-control bg-subtle p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-muted">Response from {responderName ?? 'the creator'}</p>
          <p className="text-ink-soft">{response}</p>
        </div>
      )}
    </article>
  )
}
