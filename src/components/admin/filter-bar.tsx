import * as React from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce, useIsDesktop } from '@/hooks/use-utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, type InputProps } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'

/**
 * Search + filters row. Desktop: filters inline. Below `lg`: a "Filters"
 * button opens a drawer with the same controls (rendered once, so ids stay unique).
 */
export function FilterBar({
  search,
  children,
  activeCount = 0,
  onReset,
  toolbar,
  className,
}: {
  search?: React.ReactNode
  children?: React.ReactNode
  activeCount?: number
  onReset?: () => void
  /** Extra content under the filters (preset chips, active filter chips…). */
  toolbar?: React.ReactNode
  className?: string
}) {
  const isDesktop = useIsDesktop()
  const [open, setOpen] = React.useState(false)
  const hasFilters = React.Children.count(children) > 0

  return (
    <div className={cn('mb-5 flex flex-col gap-3', className)}>
      {(search || (hasFilters && !isDesktop)) && (
        <div className="flex items-center gap-2">
          {search && <div className="min-w-0 flex-1">{search}</div>}
          {hasFilters && !isDesktop && (
            <Drawer open={open} onOpenChange={setOpen}>
              <DrawerTrigger asChild>
                <Button variant="secondary" size="sm" className="ml-auto shrink-0">
                  <SlidersHorizontal /> Filters
                  {activeCount > 0 && (
                    <Badge tone="dark" size="sm" aria-label={`${activeCount} active`}>
                      {activeCount}
                    </Badge>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent
                side="right"
                title="Filters"
                description="Narrow down the list."
                footer={
                  <div className="flex gap-2">
                    {onReset && (
                      <Button variant="ghost" onClick={onReset} disabled={activeCount === 0}>
                        Reset
                      </Button>
                    )}
                    <Button block onClick={() => setOpen(false)}>
                      Show results
                    </Button>
                  </div>
                }
              >
                <div className="flex flex-col gap-4">{children}</div>
              </DrawerContent>
            </Drawer>
          )}
        </div>
      )}
      {hasFilters && isDesktop && (
        <div className="flex flex-wrap items-end gap-3">
          {children}
          {onReset && activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <X /> Clear filters
            </Button>
          )}
        </div>
      )}
      {toolbar}
    </div>
  )
}

/** Labelled filter control; fixed width inline on desktop, full width in the drawer. */
export function FilterField({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex w-full flex-col gap-1.5 lg:w-44', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted">
        {label}
      </Label>
      {children}
    </div>
  )
}

/**
 * Text input that commits its value after the user stops typing. Stays in
 * sync when the committed value changes elsewhere (e.g. "Clear filters").
 */
export function DebouncedInput({
  value,
  onCommit,
  delay = 400,
  ...props
}: Omit<InputProps, 'value' | 'onChange' | 'defaultValue'> & { value: string; onCommit: (value: string) => void; delay?: number }) {
  const [text, setText] = React.useState(value)
  const debounced = useDebounce(text, delay)
  const latest = React.useRef({ value, onCommit })
  React.useLayoutEffect(() => {
    latest.current = { value, onCommit }
  })
  React.useEffect(() => {
    setText(value)
  }, [value])
  React.useEffect(() => {
    if (debounced !== latest.current.value) latest.current.onCommit(debounced)
  }, [debounced])
  return <Input value={text} onChange={(e) => setText(e.target.value)} {...props} />
}

export function SearchInput({
  value,
  onCommit,
  placeholder,
  label = 'Search',
  id,
}: {
  value: string
  onCommit: (value: string) => void
  placeholder: string
  label?: string
  id?: string
}) {
  return (
    <DebouncedInput
      id={id}
      type="search"
      inputSize="sm"
      value={value}
      onCommit={(v) => onCommit(v.trim())}
      placeholder={placeholder}
      aria-label={label}
      leftIcon={<Search />}
      maxLength={120}
    />
  )
}

/** Removable chip for an active filter (e.g. "Brand: Acme"). */
export function FilterChip({ label, onRemove }: { label: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-pill border border-line bg-surface py-1 pr-1 pl-3 text-xs font-medium text-ink shadow-card">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        className="focus-ring inline-flex size-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </span>
  )
}

/** Group of toggle buttons (one pressed at a time) — quick presets, ranges, views. */
export function ToggleGroup<V extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: V | null
  onChange: (value: V) => void
  options: readonly { value: V; label: React.ReactNode; count?: number }[]
  label: string
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn('no-scrollbar -mx-1 flex max-w-full items-center gap-1.5 overflow-x-auto px-1 py-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-sm font-medium whitespace-nowrap transition-colors',
              active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
            )}
          >
            {o.label}
            {typeof o.count === 'number' && o.count > 0 && (
              <span className={cn('rounded-pill px-1.5 text-[0.6875rem] font-semibold tabular-nums', active ? 'bg-brand text-white' : 'bg-subtle text-ink-soft')}>
                {o.count > 999 ? '999+' : o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
