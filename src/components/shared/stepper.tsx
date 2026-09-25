import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Step = { key: string; label: string; description?: string }

/** Horizontal (md+) / compact (mobile) step indicator. */
export function Stepper({
  steps,
  current,
  completed = [],
  onStepClick,
  className,
}: {
  steps: Step[]
  current: number
  completed?: number[]
  onStepClick?: (index: number) => void
  className?: string
}) {
  const pct = Math.round(((current + 1) / steps.length) * 100)
  return (
    <div className={className}>
      <div className="md:hidden">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            Step {current + 1} of {steps.length} · {steps[current]?.label}
          </span>
          <span className="text-muted">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-pill bg-muted-surface">
          <div className="h-full rounded-pill bg-ink transition-[width] duration-500 ease-spring" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ol className="hidden items-center md:flex" aria-label="Progress">
        {steps.map((s, i) => {
          const done = completed.includes(i) || i < current
          const active = i === current
          const clickable = !!onStepClick && (done || i <= Math.max(current, ...completed, 0) + 1)
          return (
            <li key={s.key} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(i)}
                aria-current={active ? 'step' : undefined}
                className="focus-ring group flex items-center gap-2.5 rounded-pill pr-2 disabled:cursor-default"
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                    active ? 'border-ink bg-ink text-brand' : done ? 'border-ink bg-brand text-white' : 'border-line-strong bg-surface text-muted',
                  )}
                >
                  {done && !active ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn('text-sm font-medium whitespace-nowrap', active ? 'text-ink' : 'text-muted')}>{s.label}</span>
              </button>
              {i < steps.length - 1 && <span className={cn('mx-2 h-px min-w-4 flex-1', done ? 'bg-ink' : 'bg-line')} aria-hidden />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
