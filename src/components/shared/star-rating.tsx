import * as React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StarRating({ value, size = 'sm', className }: { value: number; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  const px = size === 'xs' ? 'size-3' : size === 'md' ? 'size-5' : 'size-4'
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} className={cn('relative inline-block', px)}>
            <Star className={cn('absolute inset-0 text-line-strong', px)} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn('text-ink', px)} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

/** Compact "★ 4.8 (23)" rating label. */
export function RatingLabel({ rating, count, className }: { rating: number; count: number; className?: string }) {
  if (!count) return <span className={cn('text-xs font-medium text-muted', className)}>New</span>
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', className)}>
      <Star className="size-3.5 text-ink" fill="currentColor" strokeWidth={0} aria-hidden />
      {Number(rating).toFixed(1)}
      <span className="font-normal text-muted">({count})</span>
    </span>
  )
}

export function StarInput({ value, onChange, id }: { value: number; onChange: (v: number) => void; id?: string }) {
  const [hover, setHover] = React.useState(0)
  const labels = ['Poor', 'Fair', 'Good', 'Great', 'Outstanding']
  return (
    <div className="flex items-center gap-3">
      <div id={id} role="radiogroup" aria-label="Rating" className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 5 }, (_, i) => {
          const v = i + 1
          const active = (hover || value) >= v
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              aria-label={`${v} star${v > 1 ? 's' : ''} — ${labels[i]}`}
              onMouseEnter={() => setHover(v)}
              onFocus={() => setHover(v)}
              onBlur={() => setHover(0)}
              onClick={() => onChange(v)}
              className="focus-ring rounded-md p-0.5 transition-transform hover:scale-110"
            >
              <Star className={cn('size-7 transition-colors', active ? 'text-ink' : 'text-line-strong')} fill="currentColor" strokeWidth={0} />
            </button>
          )
        })}
      </div>
      <span className="text-sm text-muted" aria-live="polite">
        {labels[(hover || value) - 1] ?? 'Select a rating'}
      </span>
    </div>
  )
}
