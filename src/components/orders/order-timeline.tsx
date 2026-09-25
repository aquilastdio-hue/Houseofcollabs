import { Check, Circle, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime, formatRelative } from '@/lib/format'
import { buildTimeline, historyLabel } from '@/lib/order-state'
import type { OrderStatus, OrderStatusHistory } from '@/types'

/** Progress timeline (milestones) derived from the status history. */
export function OrderTimeline({
  status,
  history,
  requiresShipping,
  className,
}: {
  status: OrderStatus
  history: OrderStatusHistory[]
  requiresShipping: boolean
  className?: string
}) {
  const steps = buildTimeline(status, history, requiresShipping)
  return (
    <ol className={cn('relative', className)} aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
          {i < steps.length - 1 && (
            <span className={cn('absolute top-7 bottom-0 left-[0.8125rem] w-px', s.state === 'done' ? 'bg-ink' : 'bg-line')} aria-hidden />
          )}
          <span
            className={cn(
              'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2',
              s.state === 'done' && 'border-ink bg-ink text-brand',
              s.state === 'current' && 'border-ink bg-brand text-white',
              s.state === 'upcoming' && 'border-line-strong bg-surface text-faint',
              s.state === 'skipped' && 'border-line bg-subtle text-faint',
            )}
          >
            {s.state === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : s.state === 'skipped' ? <Minus className="size-3.5" /> : <Circle className="size-2.5 fill-current" />}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={cn('text-sm', s.state === 'upcoming' || s.state === 'skipped' ? 'text-muted' : 'font-medium text-ink')}>{s.label}</p>
            {s.at && <p className="text-xs text-faint">{formatDateTime(s.at)}</p>}
            {s.state === 'current' && !s.at && <p className="text-xs text-muted">In progress</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Full activity log: every status change with actor + reason. */
export function OrderActivity({ history }: { history: OrderStatusHistory[] }) {
  const items = [...history].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <ul className="space-y-3">
      {items.map((h) => (
        <li key={h.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-line-strong" aria-hidden />
          <div className="min-w-0">
            <p>
              <span className="font-medium">{historyLabel(h)}</span>
              <span className="text-muted"> · {h.actor_role === 'system' ? 'House of Collabs' : h.actor_role}</span>
            </p>
            {h.reason && <p className="text-muted">{h.reason}</p>}
            <p className="text-xs text-faint" title={formatDateTime(h.created_at)}>
              {formatRelative(h.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
