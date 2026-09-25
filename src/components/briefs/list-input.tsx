import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Small list editor: type an item, press Enter (or "Add"), remove with ×.
 * `chips` renders wrapped pills, `rows` a numbered list for longer items.
 * Wrap it in `Field` — `id` / aria props land on the text input.
 */
export function ListInput({
  id,
  value,
  onChange,
  onBlur,
  max,
  maxLength,
  placeholder,
  addLabel = 'Add',
  layout = 'chips',
  tone = 'neutral',
  validate,
  disabled,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  onBlur?: () => void
  max?: number
  maxLength?: number
  placeholder?: string
  addLabel?: string
  layout?: 'chips' | 'rows'
  tone?: 'neutral' | 'danger'
  /** Return an error message to reject the item. */
  validate?: (item: string) => string | null
  disabled?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}) {
  const [draft, setDraft] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const errorId = React.useId()
  const full = max !== undefined && value.length >= max

  const add = () => {
    const item = draft.trim().replace(/\s+/g, ' ')
    if (!item) return
    if (full) return setError(`You can add up to ${max}.`)
    if (maxLength && item.length > maxLength) return setError(`Keep each item under ${maxLength} characters (this one is ${item.length}).`)
    const problem = validate?.(item)
    if (problem) return setError(problem)
    if (value.some((v) => v.toLowerCase() === item.toLowerCase())) return setError('That’s already on the list.')
    onChange([...value, item])
    setDraft('')
    setError(null)
  }

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
    setError(null)
  }

  const describedBy = [ariaDescribedBy, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          disabled={disabled || full}
          placeholder={full ? `Limit of ${max} reached` : placeholder}
          aria-invalid={ariaInvalid || !!error || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError(null)
          }}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          autoComplete="off"
          enterKeyHint="done"
        />
        <Button type="button" variant="secondary" className="shrink-0" onClick={add} disabled={disabled || full || !draft.trim()}>
          <Plus /> {addLabel}
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3">
        {error ? (
          <p id={errorId} role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        ) : (
          <span />
        )}
        {max !== undefined && (
          <span className={cn('shrink-0 text-xs tabular-nums', full ? 'font-medium text-ink' : 'text-faint')}>
            {value.length}/{max}
          </span>
        )}
      </div>

      {value.length > 0 &&
        (layout === 'rows' ? (
          <ol className="divide-y divide-line overflow-hidden rounded-control border border-line bg-surface">
            {value.map((item, i) => (
              <li key={`${item}-${i}`} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-[0.6875rem] font-semibold text-muted tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 break-words">{item}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  className="focus-ring -my-0.5 shrink-0 rounded-full p-1 text-faint transition-colors hover:bg-subtle hover:text-ink"
                  aria-label={`Remove “${item}”`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {value.map((item, i) => (
              <li
                key={`${item}-${i}`}
                className={cn(
                  'inline-flex max-w-full items-center gap-1 rounded-pill py-1 pr-1 pl-3 text-sm',
                  tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-subtle text-ink',
                )}
              >
                <span className="min-w-0 break-words">{item}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  className={cn(
                    'focus-ring shrink-0 rounded-full p-1 transition-colors',
                    tone === 'danger' ? 'hover:bg-danger/10' : 'text-muted hover:bg-muted-surface hover:text-ink',
                  )}
                  aria-label={`Remove “${item}”`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
