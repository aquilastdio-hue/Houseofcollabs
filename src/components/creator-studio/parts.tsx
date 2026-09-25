import * as React from 'react'
import { Link } from 'react-router'
import { RefreshCw, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/states'

/** Titled group of fields inside a studio editor. */
export function StudioSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className={cn('space-y-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="font-display text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/** Sticky-free footer for studio forms: optional secondary action + submit. */
export function FormActions({
  submitLabel,
  submitting,
  dirty,
  secondary,
  className,
}: {
  submitLabel: string
  submitting?: boolean
  dirty?: boolean
  secondary?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex items-center gap-2">{secondary}</div>
      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        {dirty && !submitting && (
          <span className="text-center text-xs text-muted sm:text-right" aria-live="polite">
            Unsaved changes
          </span>
        )}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 3, className, itemClassName }: { rows?: number; className?: string; itemClassName?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('h-20 w-full rounded-card', itemClassName)} />
      ))}
    </div>
  )
}

/** Shown when a creator workspace page has no creator record to work with. */
export function CreatorSetupRequired({ className }: { className?: string }) {
  const { refresh } = useAuth()
  const [reloading, setReloading] = React.useState(false)
  return (
    <EmptyState
      className={className}
      icon={<Store />}
      title="Finish setting up your storefront"
      description="We couldn’t find your creator profile. Complete onboarding to create it — it only takes a few minutes."
      action={
        <>
          <Button asChild>
            <Link to="/onboarding">Continue setup</Link>
          </Button>
          <Button
            variant="secondary"
            loading={reloading}
            onClick={async () => {
              setReloading(true)
              try {
                await refresh()
              } finally {
                setReloading(false)
              }
            }}
          >
            <RefreshCw /> Reload
          </Button>
        </>
      }
    />
  )
}
