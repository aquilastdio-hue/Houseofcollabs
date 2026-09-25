import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './command'

export type ComboOption = { value: string; label: string; hint?: string }

const triggerClass =
  'focus-ring flex min-h-11 w-full items-center justify-between gap-2 rounded-control border border-line bg-surface px-3.5 text-left text-sm transition-[border-color] hover:border-line-strong aria-invalid:border-danger disabled:opacity-60'

/**
 * Searchable single-select. With `allowCustom`, typing a value not in the
 * list offers "Use “…”" (e.g. for free-text cities).
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches.',
  allowCustom,
  clearable,
  id,
  className,
  disabled,
  'aria-invalid': ariaInvalid,
}: {
  value?: string | null
  onChange: (value: string) => void
  options: readonly ComboOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  allowCustom?: boolean
  clearable?: boolean
  id?: string
  className?: string
  disabled?: boolean
  'aria-invalid'?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const selected = options.find((o) => o.value === value)
  const display = selected?.label ?? value ?? ''
  const showCustom = allowCustom && query.trim() && !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} role="combobox" aria-expanded={open} aria-invalid={ariaInvalid} disabled={disabled} className={cn(triggerClass, className)}>
          <span className={cn('truncate', !display && 'text-faint')}>{display || placeholder}</span>
          <span className="flex items-center gap-1">
            {clearable && value && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear"
                className="rounded-full p-0.5 text-faint hover:bg-subtle hover:text-ink"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronsUpDown className="size-4 shrink-0 text-muted" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {showCustom && (
              <CommandItem
                value={`__custom__${query}`}
                onSelect={() => {
                  onChange(query.trim())
                  setQuery('')
                  setOpen(false)
                }}
              >
                Use “{query.trim()}”
              </CommandItem>
            )}
            {options.map((o) => (
              <CommandItem
                key={o.value}
                value={`${o.label} ${o.hint ?? ''}`}
                onSelect={() => {
                  onChange(o.value)
                  setQuery('')
                  setOpen(false)
                }}
              >
                <Check className={cn('text-ink', o.value === value ? 'opacity-100' : 'opacity-0')} />
                <span className="flex-1 truncate">{o.label}</span>
                {o.hint && <span className="text-xs text-faint">{o.hint}</span>}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Searchable multi-select with removable chips. */
export function MultiSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  max,
  allowCustom,
  id,
  className,
  'aria-invalid': ariaInvalid,
}: {
  value: string[]
  onChange: (value: string[]) => void
  options: readonly ComboOption[]
  placeholder?: string
  searchPlaceholder?: string
  max?: number
  allowCustom?: boolean
  id?: string
  className?: string
  'aria-invalid'?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v))
    else if (!max || value.length < max) onChange([...value, v])
  }
  const showCustom = allowCustom && query.trim() && !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase()) && !value.includes(query.trim())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} role="combobox" aria-expanded={open} aria-invalid={ariaInvalid} className={cn(triggerClass, 'py-1.5', className)}>
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {value.length === 0 && <span className="py-1 text-faint">{placeholder}</span>}
            {value.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 rounded-pill bg-subtle py-1 pr-1.5 pl-2.5 text-xs font-medium">
                {labelOf(v)}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${labelOf(v)}`}
                  className="rounded-full p-0.5 text-muted hover:bg-muted-surface hover:text-ink"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(v)
                  }}
                >
                  <X className="size-3" />
                </span>
              </span>
            ))}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {showCustom && (
              <CommandItem
                value={`__custom__${query}`}
                onSelect={() => {
                  toggle(query.trim())
                  setQuery('')
                }}
              >
                Add “{query.trim()}”
              </CommandItem>
            )}
            {options.map((o) => {
              const checked = value.includes(o.value)
              const blocked = !checked && !!max && value.length >= max
              return (
                <CommandItem key={o.value} value={o.label} disabled={blocked} onSelect={() => toggle(o.value)}>
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded-[0.3rem] border',
                      checked ? 'border-ink bg-ink text-white' : 'border-line-strong',
                    )}
                  >
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  {o.label}
                </CommandItem>
              )
            })}
          </CommandList>
          {max && <p className="border-t border-line px-3 py-2 text-xs text-faint">{value.length}/{max} selected</p>}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
