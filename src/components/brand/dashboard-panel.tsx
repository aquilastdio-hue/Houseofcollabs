import * as React from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { cn, range } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Dashboard block with an h2 title, optional counter badge and "view all"
 * link. `bare` drops the card chrome for panels that list their own cards.
 */
export function DashboardPanel({
  title,
  href,
  linkLabel = 'View all',
  badge,
  bare,
  className,
  children,
}: {
  title: string
  href?: string
  linkLabel?: string
  badge?: React.ReactNode
  bare?: boolean
  className?: string
  children: React.ReactNode
}) {
  const headingId = React.useId()
  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex min-w-0 flex-col', !bare && 'rounded-card border border-line bg-surface p-5 shadow-card sm:p-6', className)}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id={headingId} className="truncate font-display text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {badge}
        </div>
        {href && (
          <Link
            to={href}
            aria-label={`${linkLabel}: ${title}`}
            className="focus-ring -mr-2 inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-1 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            {linkLabel}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

/** Avatar + two text lines placeholder rows for compact panel lists. */
export function PanelRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="space-y-4" aria-hidden>
      {range(rows).map((i) => (
        <li key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Placeholder matching the `OrderCard` footprint. */
export function OrderListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="space-y-3" aria-hidden>
      {range(count).map((i) => (
        <li key={i} className="flex items-center gap-3.5 rounded-card border border-line bg-surface p-4 sm:p-5">
          <Skeleton className="size-12 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 max-w-72" />
            <Skeleton className="h-3 w-1/2 max-w-48" />
          </div>
          <Skeleton className="hidden h-6 w-28 rounded-pill sm:block" />
          <Skeleton className="h-7 w-16" />
        </li>
      ))}
    </ul>
  )
}
