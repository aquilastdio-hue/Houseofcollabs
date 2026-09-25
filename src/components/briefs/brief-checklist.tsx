import { useWatch, type Control } from 'react-hook-form'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import type { BriefFormValues } from './brief-form-schema'

/** Live completeness checklist for the brief editor sidebar. */
export function BriefChecklist({ control }: { control: Control<BriefFormValues> }) {
  const v = useWatch({ control })
  const items = [
    { label: 'Title', done: (v.title ?? '').trim().length >= 3 },
    { label: 'Campaign objective', done: !!v.campaign_objective?.trim() },
    { label: 'Product details', done: !!(v.product_name?.trim() || v.product_description?.trim()) },
    { label: 'Deliverables', done: !!v.deliverables?.trim() },
    { label: 'Talking points', done: (v.talking_points?.length ?? 0) > 0 },
    { label: 'Deadline', done: !!v.deadline },
    { label: 'Budget', done: !!v.budget?.trim() },
  ]
  const done = items.filter((i) => i.done).length
  const percent = Math.round((done / items.length) * 100)

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Brief checklist</p>
        <p className="text-xs text-muted tabular-nums">
          {done}/{items.length} done
        </p>
      </div>
      <Progress value={percent} tone={percent === 100 ? 'success' : 'brand'} aria-label="Brief completeness" />
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'flex size-4.5 shrink-0 items-center justify-center rounded-full',
                item.done ? 'bg-ink text-brand' : 'border border-line-strong bg-surface',
              )}
              aria-hidden
            >
              {item.done && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className={item.done ? 'text-ink' : 'text-muted'}>{item.label}</span>
            <span className="sr-only">{item.done ? '(added)' : '(missing)'}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">A complete brief helps creators say yes with confidence.</p>
    </div>
  )
}
