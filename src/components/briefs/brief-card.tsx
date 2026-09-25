import { Link } from 'react-router'
import { BadgeCheck, CalendarClock, ChevronRight, FileText, IndianRupee, Paperclip } from 'lucide-react'
import { cn, range } from '@/lib/utils'
import { formatINR, formatRelative, pluralize } from '@/lib/format'
import { CONTENT_TYPES, labelFor } from '@/lib/constants'
import type { BriefDetail } from '@/services/briefs.service'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { BriefStatusBadge, formatDeadline, isBriefOverdue } from './brief-status'

/** Brief summary row for brand (and creator) brief lists. */
export function BriefCard({ brief, perspective = 'brand', className }: { brief: BriefDetail; perspective?: 'brand' | 'creator'; className?: string }) {
  const counterpart =
    perspective === 'brand'
      ? brief.creator
        ? { name: brief.creator.display_name, image: brief.creator.profile_image_url, verified: brief.creator.verified, shape: 'circle' as const }
        : null
      : { name: brief.brand?.brand_name ?? 'Brand', image: brief.brand?.brand_logo_url, verified: false, shape: 'rounded' as const }
  const summary = [brief.product_name, brief.category?.name, brief.content_type ? labelFor(CONTENT_TYPES, brief.content_type) : null]
    .filter(Boolean)
    .join(' · ')
  const overdue = isBriefOverdue(brief.deadline, brief.status)
  const files = brief.brief_attachments.length

  return (
    <Link
      to={`/${perspective}/briefs/${brief.id}`}
      className={cn(
        'group focus-ring flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition-[box-shadow,border-color] duration-300 hover:border-line-strong hover:shadow-card-hover sm:p-5 md:flex-row md:items-center',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-ink" aria-hidden>
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate font-medium">{brief.title}</p>
            <BriefStatusBadge status={brief.status} size="sm" />
          </div>
          <p className="truncate text-sm text-muted">{summary || 'No product details yet'}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <li className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-danger')}>
              <CalendarClock className="size-3.5" aria-hidden />
              {brief.deadline ? `${overdue ? 'Deadline passed · ' : 'Due '}${formatDeadline(brief.deadline, 'd MMM yyyy')}` : 'No deadline'}
            </li>
            <li className="inline-flex items-center gap-1">
              <IndianRupee className="size-3.5" aria-hidden />
              {brief.budget != null ? formatINR(brief.budget) : 'No budget set'}
            </li>
            <li className="inline-flex items-center gap-1">
              <Paperclip className="size-3.5" aria-hidden />
              {pluralize(files, 'file')}
            </li>
            <li>Updated {formatRelative(brief.updated_at)}</li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 md:justify-end md:border-0 md:pt-0">
        {counterpart ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar src={counterpart.image} name={counterpart.name} size="sm" shape={counterpart.shape} />
            <span className="min-w-0">
              <span className="block text-xs text-faint">{perspective === 'brand' ? 'Creator' : 'Brand'}</span>
              <span className="flex items-center gap-1 text-sm font-medium">
                <span className="truncate md:max-w-40">{counterpart.name}</span>
                {counterpart.verified && <BadgeCheck className="size-3.5 shrink-0 fill-brand text-ink" aria-label="Verified" />}
              </span>
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted">Not sent yet</span>
        )}
        <ChevronRight className="size-5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  )
}

export function BriefListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="space-y-3" aria-hidden>
      {range(count).map((i) => (
        <li key={i} className="flex items-start gap-3.5 rounded-card border border-line bg-surface p-4 sm:p-5">
          <Skeleton className="size-12 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-4 w-2/3 max-w-80" />
            <Skeleton className="h-3 w-1/2 max-w-56" />
            <Skeleton className="h-3 w-3/4 max-w-96" />
          </div>
          <Skeleton className="hidden h-8 w-36 md:block" />
        </li>
      ))}
    </ul>
  )
}
