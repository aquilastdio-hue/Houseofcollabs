import * as React from 'react'
import { cn } from '@/lib/utils'
import { RadioGroupItem } from '@/components/ui/radio-group'

/** Radio option row (label + description) for use inside `RadioGroup`; supports `disabled`. */
export function ChoiceRow({
  id,
  value,
  title,
  description,
  icon,
  disabled,
  checked,
}: {
  id: string
  value: string
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
  checked: boolean
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors',
        checked ? 'border-ink bg-brand-soft/40' : 'border-line hover:border-line-strong',
        disabled && 'cursor-not-allowed opacity-50 hover:border-line',
      )}
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} className="mt-0.5" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium [&_svg]:size-3.5">
          {icon}
          {title}
        </span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
    </label>
  )
}
