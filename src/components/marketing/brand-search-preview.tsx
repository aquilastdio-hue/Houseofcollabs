import * as React from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/format'
import { DELIVERY_OPTIONS, FOLLOWER_RANGES, POPULAR_CITIES } from '@/lib/constants'
import { useCategories } from '@/hooks/use-catalog'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'

const BUDGETS = [1_000, 2_500, 5_000, 10_000, 25_000, 50_000]
const BUDGET_OPTIONS = BUDGETS.map((v) => ({ value: String(v), label: `Up to ${formatINR(v)}` }))

const FOLLOWER_OPTIONS = FOLLOWER_RANGES.flatMap((range, i) =>
  range.min === undefined && range.max === undefined ? [] : [{ value: String(i), label: range.label }],
)

const DELIVERY_SELECT_OPTIONS = DELIVERY_OPTIONS.flatMap((o) => (o.value === undefined ? [] : [{ value: String(o.value), label: o.label }]))

const CITY_OPTIONS = POPULAR_CITIES.map((city) => ({ value: city, label: city }))

/**
 * Interactive search preview for the brands landing page. Submitting opens the
 * real marketplace with only the chosen filters in the query string.
 */
export function BrandSearchPreview({ className }: { className?: string }) {
  const navigate = useNavigate()
  const categories = useCategories()
  const [category, setCategory] = React.useState('')
  const [city, setCity] = React.useState('')
  const [budget, setBudget] = React.useState('')
  const [followers, setFollowers] = React.useState('')
  const [delivery, setDelivery] = React.useState('')

  const categoryOptions = React.useMemo(() => (categories.data ?? []).map((c) => ({ value: c.slug, label: c.name })), [categories.data])

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const sp = new URLSearchParams()
    if (category) sp.set('category', category)
    if (city.trim()) sp.set('city', city.trim())
    if (budget) sp.set('maxPrice', budget)
    const range = followers ? FOLLOWER_RANGES[Number(followers)] : undefined
    if (range?.min !== undefined) sp.set('minFollowers', String(range.min))
    if (range?.max !== undefined) sp.set('maxFollowers', String(range.max))
    if (delivery) sp.set('maxDelivery', delivery)
    const qs = sp.toString()
    navigate(qs ? `/discover?${qs}` : '/discover')
  }

  const chosen = [category, city.trim(), budget, followers, delivery].filter(Boolean).length

  return (
    <form
      onSubmit={onSubmit}
      aria-labelledby="brand-search-title"
      className={cn('relative rounded-panel border border-line bg-surface p-5 shadow-float sm:p-7', className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="brand-search-title" className="font-display text-display-sm font-semibold">
            Try a search
          </h2>
          <p className="mt-1 text-sm text-muted">Pick any filters — we’ll open the live marketplace with them applied.</p>
        </div>
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Search className="size-5" />
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="bsp-category" className="sm:col-span-2">
          <Select
            id="bsp-category"
            value={category}
            onValueChange={setCategory}
            options={categoryOptions}
            anyLabel="Any category"
            placeholder={categories.isPending ? 'Loading categories…' : 'Any category'}
            disabled={categories.isPending}
          />
        </Field>
        <Field label="Location" htmlFor="bsp-city">
          <Combobox
            id="bsp-city"
            value={city}
            onChange={setCity}
            options={CITY_OPTIONS}
            allowCustom
            clearable
            placeholder="Any city"
            searchPlaceholder="Search or type a city"
            emptyText="Type a city name to use it."
          />
        </Field>
        <Field label="Budget per video" htmlFor="bsp-budget">
          <Select id="bsp-budget" value={budget} onValueChange={setBudget} options={BUDGET_OPTIONS} anyLabel="Any budget" placeholder="Any budget" />
        </Field>
        <Field label="Followers" htmlFor="bsp-followers">
          <Select
            id="bsp-followers"
            value={followers}
            onValueChange={setFollowers}
            options={FOLLOWER_OPTIONS}
            anyLabel="Any audience size"
            placeholder="Any audience size"
          />
        </Field>
        <Field label="Delivery time" htmlFor="bsp-delivery">
          <Select
            id="bsp-delivery"
            value={delivery}
            onValueChange={setDelivery}
            options={DELIVERY_SELECT_OPTIONS}
            anyLabel="Any time"
            placeholder="Any time"
          />
        </Field>
      </div>

      <Button type="submit" size="lg" block className="mt-6">
        {chosen > 0 ? `Show matching creators` : 'Browse all creators'} <ArrowRight />
      </Button>
      <p className="mt-3 text-center text-xs text-faint">No account needed to browse. Sign up when you’re ready to order.</p>
    </form>
  )
}
