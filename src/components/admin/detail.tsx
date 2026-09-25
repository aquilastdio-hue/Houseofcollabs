import * as React from 'react'
import { Link } from 'react-router'
import { Check, Copy, ExternalLink as ExternalIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { stopPropagation } from './admin-utils'

/** Titled card section used across admin detail pages. */
export function DetailCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('rounded-card border border-line bg-surface shadow-card', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
      <div className={cn('px-5 pt-4 pb-5 sm:px-6 sm:pb-6', bodyClassName)}>{children}</div>
    </section>
  )
}

export function DetailList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>{children}</dl>
}

export function DetailItem({ label, children, className, mono }: { label: React.ReactNode; children?: React.ReactNode; className?: string; mono?: boolean }) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-medium text-faint">{label}</dt>
      <dd className={cn('mt-0.5 text-sm break-words text-ink', mono && 'font-mono text-xs', empty && 'text-faint')}>{empty ? '—' : children}</dd>
    </div>
  )
}

/** Icon button that copies `value` to the clipboard. */
export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async (e) => {
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
        } catch {
          toast.error('Couldn’t copy. Select the text and copy it manually.')
        }
      }}
      className={cn(
        'focus-ring inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink',
        className,
      )}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  )
}

/** Monospace id with a copy button. */
export function IdText({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1', className)}>
      <span className="truncate font-mono text-xs text-ink-soft" title={value}>
        {value}
      </span>
      <CopyButton value={value} label="Copy id" />
    </span>
  )
}

/** External link opened in a new tab (never passes the referrer). */
export function ExternalAnchor({ href, children, className }: { href: string; children?: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={stopPropagation}
      className={cn('focus-ring inline-flex max-w-full items-center gap-1 rounded text-ink underline decoration-ink/25 underline-offset-2 hover:decoration-ink', className)}
    >
      <span className="truncate">{children ?? href}</span>
      <ExternalIcon className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

/**
 * Link inside a clickable table row. On mobile the whole card is the button,
 * so the link renders as plain text there unless `always` is set.
 */
export function CellLink({ to, children, className, always }: { to: string; children: React.ReactNode; className?: string; always?: boolean }) {
  const link = (
    <Link
      to={to}
      onClick={stopPropagation}
      className={cn('focus-ring rounded-sm font-medium text-ink hover:underline hover:underline-offset-2', !always && 'hidden md:inline', className)}
    >
      {children}
    </Link>
  )
  if (always) return link
  return (
    <>
      {link}
      <span className={cn('font-medium md:hidden', className)}>{children}</span>
    </>
  )
}

/** Avatar + title + subtitle cell. */
export function IdentityCell({
  name,
  subtitle,
  image,
  to,
  shape = 'circle',
  size = 'sm',
  badge,
  always,
}: {
  name: string
  subtitle?: React.ReactNode
  image?: string | null
  to?: string
  shape?: 'circle' | 'rounded'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  badge?: React.ReactNode
  always?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar src={image} name={name} size={size} shape={shape} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">
            {to ? (
              <CellLink to={to} always={always}>
                {name}
              </CellLink>
            ) : (
              <span className="font-medium">{name}</span>
            )}
          </span>
          {badge}
        </div>
        {subtitle && <div className="truncate text-xs text-muted">{subtitle}</div>}
      </div>
    </div>
  )
}

/** Loading layout for detail pages (header + two-column body). */
export function DetailPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Skeleton className="h-56 w-full rounded-card" />
          <Skeleton className="h-72 w-full rounded-card" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </div>
    </div>
  )
}

/** Horizontal label/value row (money breakdowns, summaries). */
export function SummaryRow({ label, value, strong, muted, className }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5 text-sm', className)}>
      <dt className={cn(muted ? 'text-faint' : 'text-muted')}>{label}</dt>
      <dd className={cn('text-right tabular-nums', strong ? 'font-display text-base font-semibold text-ink' : muted ? 'text-faint' : 'text-ink')}>{value}</dd>
    </div>
  )
}
