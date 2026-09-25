import * as React from 'react'
import { RadioGroup as RadioPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return <RadioPrimitive.Root className={cn('grid gap-2', className)} {...props} />
}

export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      className={cn(
        'focus-ring aspect-square size-5 shrink-0 rounded-full border border-line-strong bg-surface transition-colors data-[state=checked]:border-ink disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="flex items-center justify-center">
        <span className="size-2.5 rounded-full bg-ink" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Item>
  )
}

/** Large selectable card used for choices like "I am a brand / creator". */
export function RadioCard({
  value,
  title,
  description,
  icon,
  className,
}: {
  value: string
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <RadioPrimitive.Item
      value={value}
      className={cn(
        'focus-ring group relative flex w-full items-start gap-3 rounded-card border border-line bg-surface p-4 text-left transition-[border-color,box-shadow,background-color]',
        'hover:border-line-strong data-[state=checked]:border-ink data-[state=checked]:shadow-card data-[state=checked]:bg-brand-soft/40',
        className,
      )}
    >
      {/* Unselected the chip is a light `bg-subtle`, so the glyph must be ink;
          it only turns white once the chip fills with brand on selection. */}
      {icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-subtle text-ink group-data-[state=checked]:bg-brand group-data-[state=checked]:text-white [&_svg]:size-5">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </span>
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong group-data-[state=checked]:border-ink">
        <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-ink" />
      </span>
    </RadioPrimitive.Item>
  )
}
