import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Sparkles } from 'lucide-react'
import { cn, range } from '@/lib/utils'
import { useCategories } from '@/hooks/use-catalog'
import { searchFromParams } from '@/hooks/use-creators'
import { smartFiltersToParams, smartSearch } from '@/services/search.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const MAX_CHIPS = 10

/**
 * Natural-language creator search: "female skincare creators in Delhi under
 * ₹5,000" → marketplace filters (smart-search Edge Function with a local
 * rule-based fallback), plus quick category shortcuts.
 */
export function SmartSearchHero({ className }: { className?: string }) {
  const navigate = useNavigate()
  const headingId = React.useId()
  const inputId = React.useId()
  const chipsId = React.useId()
  const categories = useCategories()
  const [text, setText] = React.useState('')
  const [pending, setPending] = React.useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const query = text.trim()
    if (!query) {
      navigate('/brand/creators')
      return
    }
    setPending(true)
    try {
      const result = await smartSearch(query)
      const qs = searchFromParams(smartFiltersToParams(result.filters)).toString()
      navigate(`/brand/creators${qs ? `?${qs}` : ''}`)
    } catch {
      navigate(`/brand/creators?${new URLSearchParams({ q: query }).toString()}`)
    } finally {
      setPending(false)
    }
  }

  const chips = categories.data?.slice(0, MAX_CHIPS) ?? []

  return (
    <section aria-labelledby={headingId} className={cn('relative isolate overflow-hidden rounded-panel bg-night p-6 text-white sm:p-8', className)}>
      <div aria-hidden className="pointer-events-none absolute -top-28 -right-20 -z-10 size-80 rounded-full bg-brand/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 -z-10 size-72 rounded-full bg-lilac/25 blur-3xl" />

      <p className="eyebrow flex items-center gap-1.5 text-brand">
        <Sparkles className="size-3.5" aria-hidden /> Smart search
      </p>
      <h2 id={headingId} className="mt-2 font-display text-display-sm font-semibold text-white">
        Describe the creator you need
      </h2>
      <p className="mt-1 max-w-xl text-sm text-white/70">Type it the way you’d brief a colleague — we’ll turn it into marketplace filters.</p>

      <form onSubmit={onSubmit} role="search" className="mt-5 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Describe the creator you’re looking for
        </label>
        <Input
          id={inputId}
          inputSize="lg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Female skincare creators in Delhi under ₹5,000"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={300}
          className="border-transparent"
        />
        <Button type="submit" variant="accent" size="lg" loading={pending} className="h-13 shrink-0 sm:px-7">
          Search
          {!pending && <ArrowRight />}
        </Button>
      </form>

      {!(categories.isSuccess && chips.length === 0) && (
        <div className="mt-5">
          <p id={chipsId} className="mb-2 text-xs font-medium text-white/60">
            Popular categories
          </p>
          {categories.isError ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-white/70">
              Couldn’t load categories.
              <Button variant="ghost-inverse" size="xs" onClick={() => void categories.refetch()}>
                Try again
              </Button>
            </p>
          ) : (
            <ul aria-labelledby={chipsId} className="flex flex-wrap gap-2">
              {categories.isPending
                ? range(6).map((i) => (
                    <li key={i} aria-hidden>
                      <Skeleton className="h-8 w-24 rounded-pill bg-white/10" />
                    </li>
                  ))
                : chips.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/brand/creators?${new URLSearchParams({ category: c.slug }).toString()}`}
                        className="focus-ring inline-flex h-8 items-center rounded-pill border border-night-line bg-night-soft px-3.5 text-sm text-white/85 transition-colors hover:border-brand/60 hover:text-white"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
              {categories.isSuccess && (
                <li>
                  <Link
                    to="/brand/creators"
                    className="focus-ring inline-flex h-8 items-center gap-1 rounded-pill px-3 text-sm font-medium text-brand transition-colors hover:text-white"
                  >
                    All creators <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
