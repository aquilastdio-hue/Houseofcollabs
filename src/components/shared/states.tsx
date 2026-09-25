import * as React from 'react'
import { AlertTriangle, Inbox, Lock, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { Button } from '@/components/ui/button'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface/60 text-center',
        compact ? 'gap-2 px-5 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <span className={cn('flex items-center justify-center rounded-full bg-brand-soft text-brand-ink [&_svg]:size-5', compact ? 'size-10' : 'size-12')}>
        {icon ?? <Inbox />}
      </span>
      <div className="max-w-sm">
        <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function ErrorState({
  error,
  title,
  onRetry,
  className,
  compact,
}: {
  error?: unknown
  title?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}) {
  const appError = error ? toAppError(error) : null
  const Icon = appError?.kind === 'network' ? WifiOff : appError?.kind === 'permission' || appError?.kind === 'auth' ? Lock : AlertTriangle
  const heading =
    title ??
    (appError?.kind === 'network'
      ? 'You’re offline'
      : appError?.kind === 'permission'
        ? 'You don’t have access'
        : appError?.kind === 'not_found'
          ? 'Not found'
          : 'Something went wrong')
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-danger/20 bg-danger-soft/40 text-center',
        compact ? 'px-5 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <Icon className="size-5" />
      </span>
      <div className="max-w-sm">
        <h3 className="font-display text-lg font-semibold tracking-tight">{heading}</h3>
        <p className="mt-1 text-sm text-muted">{appError?.message ?? 'Please try again in a moment.'}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  )
}

/**
 * Renders exactly one of loading / error / empty / content — the async-state
 * contract every data view follows.
 */
export function AsyncBoundary<T>({
  query,
  loading,
  empty,
  isEmpty,
  children,
  errorTitle,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown }
  loading: React.ReactNode
  empty?: React.ReactNode
  isEmpty?: (data: T) => boolean
  children: (data: T) => React.ReactNode
  errorTitle?: string
}) {
  if (query.isPending) return <>{loading}</>
  if (query.isError) return <ErrorState error={query.error} title={errorTitle} onRetry={() => void query.refetch()} />
  const data = query.data as T
  if (empty && isEmpty?.(data)) return <>{empty}</>
  return <>{children(data)}</>
}
