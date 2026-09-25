import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Titled card (h2) used across the brand workspace for form sections and
 * read-only detail blocks.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  const headingId = React.useId()
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('scroll-mt-28 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6', className)}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn('space-y-5', bodyClassName)}>{children}</div>
    </section>
  )
}
