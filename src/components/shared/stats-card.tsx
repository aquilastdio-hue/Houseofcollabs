import * as React from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export function StatsCard({
  label,
  value,
  icon,
  hint,
  delta,
  tone = 'default',
  loading,
  className,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  hint?: React.ReactNode
  delta?: number | null
  tone?: 'default' | 'brand' | 'dark'
  loading?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-card border p-5',
        tone === 'dark' ? 'border-night-line bg-night text-white' : tone === 'brand' ? 'border-brand-strong/40 bg-brand-gradient text-white shadow-brand' : 'border-line bg-surface shadow-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn('text-sm font-medium', tone === 'dark' ? 'text-white/70' : tone === 'brand' ? 'text-white/80' : 'text-muted')}>{label}</span>
        {icon && (
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-full [&_svg]:size-4',
              tone === 'dark' ? 'bg-white/10 text-brand' : tone === 'brand' ? 'bg-white/20 text-white' : 'bg-subtle text-ink',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-28" />
      ) : (
        <div className="font-display text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      )}
      {(hint || typeof delta === 'number') && (
        <div className={cn('flex items-center gap-2 text-xs', tone === 'dark' || tone === 'brand' ? 'text-white/70' : 'text-muted')}>
          {typeof delta === 'number' && Number.isFinite(delta) && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', delta >= 0 ? 'text-success' : 'text-danger')}>
              {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
          {hint}
        </div>
      )}
    </div>
  )
}
