import * as React from 'react'
import { useSearchParams } from 'react-router'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-utils'
import { Input } from '@/components/ui/input'

/** Positive page number from `?page=` (defaults to 1). */
export function readPage(sp: URLSearchParams) {
  const n = Number.parseInt(sp.get('page') ?? '', 10)
  return Number.isFinite(n) && n > 1 ? n : 1
}

/** Returns a copy of `sp` with the given keys set (or removed when null/''). */
export function patchParams(sp: URLSearchParams, patch: Record<string, string | null | undefined>) {
  const next = new URLSearchParams(sp)
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return next
}

/**
 * Search box mirrored (debounced) to a URL param. The URL stays the source of
 * truth, so back/forward navigation and shared links keep working. Changing
 * the query resets `?page=`.
 */
export function UrlSearchField({
  label,
  placeholder,
  param = 'q',
  delay = 350,
  className,
}: {
  label: string
  placeholder?: string
  param?: string
  delay?: number
  className?: string
}) {
  const id = React.useId()
  const [sp, setSp] = useSearchParams()
  const urlValue = (sp.get(param) ?? '').trim()
  const [text, setText] = React.useState(urlValue)
  const debounced = useDebounce(text, delay)
  const committed = React.useRef(urlValue)
  const lastDebounced = React.useRef(debounced)

  // URL → input (back/forward, links, "clear search" buttons elsewhere).
  React.useEffect(() => {
    if (urlValue !== committed.current) {
      committed.current = urlValue
      setText(urlValue)
    }
  }, [urlValue])

  const commit = React.useCallback(
    (value: string) => {
      const next = value.trim()
      if (next === committed.current) return
      committed.current = next
      setSp((prev) => patchParams(prev, { [param]: next, page: null }), { replace: true })
    },
    [param, setSp],
  )

  // Input → URL, only when the debounced text itself changes.
  React.useEffect(() => {
    if (debounced === lastDebounced.current) return
    lastDebounced.current = debounced
    commit(debounced)
  }, [debounced, commit])

  return (
    <form
      role="search"
      className={cn('w-full sm:w-72', className)}
      onSubmit={(e) => {
        e.preventDefault()
        commit(text)
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        leftIcon={<Search />}
        rightSlot={
          text ? (
            <button
              type="button"
              onClick={() => {
                setText('')
                commit('')
              }}
              className="focus-ring flex size-8 items-center justify-center rounded-full text-faint transition-colors hover:bg-subtle hover:text-ink"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : undefined
        }
      />
    </form>
  )
}
