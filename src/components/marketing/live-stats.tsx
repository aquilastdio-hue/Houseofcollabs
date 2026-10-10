import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { usePublicStats } from '@/hooks/use-catalog'
import { Skeleton } from '@/components/ui/skeleton'
import type { PublicStats } from '@/types'

type StatKey = 'cities' | 'categories' | 'completed_orders'

const LABELS: Record<StatKey, [singular: string, plural: string]> = {
  cities: ['city represented', 'cities represented'],
  categories: ['content category', 'content categories'],
  completed_orders: ['order completed', 'orders completed'],
}

/**
 * Live marketplace numbers from `get_public_stats`. Stats that are zero are
 * hidden; the whole row disappears if nothing is worth showing.
 */
export function LiveStats({
  keys = ['cities', 'categories'],
  inverse,
  className,
}: {
  keys?: StatKey[]
  inverse?: boolean
  className?: string
}) {
  const query = usePublicStats()

  if (query.isPending) {
    return (
      <div className={cn('flex flex-wrap gap-x-10 gap-y-4', className)} aria-hidden>
        {keys.map((k) => (
          <div key={k} className="space-y-2">
            <Skeleton className={cn('h-8 w-16', inverse && 'bg-white/10')} />
            <Skeleton className={cn('h-3 w-24', inverse && 'bg-white/10')} />
          </div>
        ))}
      </div>
    )
  }
  if (query.isError || !query.data) return null

  const stats: PublicStats = query.data
  const items = keys
    .map((key) => ({ key, value: Number(stats[key] ?? 0) }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
  if (items.length === 0) return null

  return (
    <dl className={cn('flex flex-wrap gap-x-10 gap-y-4', className)}>
      {items.map(({ key, value }) => {
        const [singular, plural] = LABELS[key]
        return (
          <div key={key} className="flex flex-col-reverse">
            <dt className={cn('text-sm', inverse ? 'text-white/60' : 'text-muted')}>{value === 1 ? singular : plural}</dt>
            <dd className={cn('font-display text-3xl font-semibold tracking-tight tabular-nums', inverse ? 'text-white' : 'text-ink')}>
              {formatNumber(value)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
