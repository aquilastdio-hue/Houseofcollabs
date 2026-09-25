import * as React from 'react'
import { Select as SelectPrimitive } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const SelectRoot = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value

export function SelectTrigger({ className, children, size = 'md', ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger> & { size?: 'sm' | 'md' }) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'focus-ring flex w-full items-center justify-between gap-2 rounded-control border border-line bg-surface text-left text-ink',
        'transition-[border-color,box-shadow] hover:border-line-strong data-[placeholder]:text-faint disabled:cursor-not-allowed disabled:opacity-60',
        'aria-invalid:border-danger [&>span]:truncate',
        size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-3.5 text-sm',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export function SelectContent({ className, children, position = 'popper', ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={6}
        className={cn(
          'relative z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-card border border-line bg-surface shadow-float data-[state=open]:animate-scale-in',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-pointer items-center rounded-[0.6rem] py-2 pr-8 pl-2.5 text-sm outline-none select-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-subtle',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2.5 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

type Opt = { value: string; label: React.ReactNode; disabled?: boolean }

/**
 * High-level select. Radix Select doesn't allow empty-string values, so an
 * "any" option is represented with the sentinel `__any__` and mapped to ''.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  id,
  size,
  className,
  disabled,
  anyLabel,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
}: {
  value?: string | null
  onValueChange: (value: string) => void
  options: readonly Opt[]
  placeholder?: string
  id?: string
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
  anyLabel?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
}) {
  const ANY = '__any__'
  return (
    <SelectRoot
      value={value ? value : anyLabel ? ANY : undefined}
      onValueChange={(v) => onValueChange(v === ANY ? '' : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} size={size} className={className} aria-label={ariaLabel} aria-invalid={ariaInvalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {anyLabel && <SelectItem value={ANY}>{anyLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  )
}
