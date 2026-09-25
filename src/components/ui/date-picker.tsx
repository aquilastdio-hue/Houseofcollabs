import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { CalendarDays, X } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

/** Date picker that works with ISO `yyyy-MM-dd` strings (DB `date` columns). */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  minDate,
  id,
  className,
  clearable = true,
  'aria-invalid': ariaInvalid,
}: {
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  minDate?: Date
  id?: string
  className?: string
  clearable?: boolean
  'aria-invalid'?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const date = value ? new Date(`${value}T00:00:00`) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-invalid={ariaInvalid}
          className={cn(
            'focus-ring flex h-11 w-full items-center gap-2.5 rounded-control border border-line bg-surface px-3.5 text-left text-sm transition-[border-color] hover:border-line-strong aria-invalid:border-danger',
            className,
          )}
        >
          <CalendarDays className="size-4 text-muted" />
          <span className={cn('flex-1', !date && 'text-faint')}>{date ? format(date, 'd MMM yyyy') : placeholder}</span>
          {clearable && date && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date"
              className="rounded-full p-0.5 text-faint hover:bg-subtle hover:text-ink"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <DayPicker
          mode="single"
          selected={date}
          defaultMonth={date ?? minDate}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(d) => {
            onChange(d ? format(d, 'yyyy-MM-dd') : null)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
