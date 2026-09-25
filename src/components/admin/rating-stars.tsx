import * as React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The admin's own 1–5 rating.
 *
 * Deliberately distinct from the star rating brands leave on an order: this one
 * is never shown outside the admin panel, so it says so, and clicking the star
 * that is already set clears the rating rather than leaving no way back to
 * "unrated".
 */
export function RatingStars({
  value,
  onChange,
  disabled,
  size = 'md',
  label = 'Admin rating',
}: {
  value: number | null
  onChange?: (rating: number | null) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  label?: string
}) {
  const [hover, setHover] = React.useState<number | null>(null)
  const shown = hover ?? value ?? 0
  const readOnly = !onChange || disabled
  const star = size === 'sm' ? 'size-4' : 'size-5'

  return (
    <div
      className="flex items-center gap-0.5"
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={readOnly ? `${label}: ${value ?? 'not rated'} of 5` : label}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          role={readOnly ? undefined : 'radio'}
          aria-checked={readOnly ? undefined : value === n}
          aria-label={`${n} of 5`}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={() => onChange?.(value === n ? null : n)}
          className={cn(
            'rounded-sm transition-transform',
            readOnly ? 'cursor-default' : 'focus-ring hover:scale-110',
          )}
        >
          <Star
            className={cn(
              star,
              n <= shown ? 'fill-warning text-warning' : 'text-line-strong',
              !readOnly && 'transition-colors',
            )}
            aria-hidden
          />
        </button>
      ))}
      <span className="ml-2 text-xs text-muted tabular-nums">{value ? `${value}/5` : 'Not rated'}</span>
    </div>
  )
}
