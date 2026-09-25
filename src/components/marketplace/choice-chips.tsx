import * as React from 'react'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export type ChoiceOption = { value: string; label: React.ReactNode; icon?: React.ReactNode }

/**
 * Single-choice chips with radio semantics (arrow keys move between options,
 * Tab enters on the selected one). Used for compact filter groups.
 */
export function ChoiceChips({
  value,
  onValueChange,
  options,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: {
  value: string
  onValueChange: (value: string) => void
  options: readonly ChoiceOption[]
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {options.map((o) => (
        <RadioGroupPrimitive.Item
          key={o.value}
          value={o.value}
          className={cn(
            'focus-ring inline-flex h-8 items-center gap-1.5 rounded-pill border border-line bg-surface px-3 text-[0.8125rem] font-medium text-ink-soft',
            'transition-[background-color,border-color,color] duration-200 hover:border-line-strong hover:text-ink [&_svg]:size-3.5',
            'data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-white',
          )}
        >
          {o.icon}
          {o.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  )
}
