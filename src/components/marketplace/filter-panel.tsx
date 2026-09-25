import * as React from 'react'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/format'
import {
  AGE_BOUNDS,
  CONTENT_TYPES,
  DELIVERY_OPTIONS,
  FOLLOWER_RANGES,
  GENDERS,
  INDIAN_STATES,
  LANGUAGES,
  PLATFORMS,
  POPULAR_CITIES,
  PRICE_BOUNDS,
} from '@/lib/constants'
import { useCategories, useCreatorTypes } from '@/hooks/use-catalog'
import { Combobox, MultiSelect } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SwitchRow } from '@/components/ui/switch'
import { RangeSlider } from '@/components/shared/range-slider'
import type { CreatorSearchParams } from '@/services/creators.service'
import { ChoiceChips, type ChoiceOption } from './choice-chips'
import { PlatformIcon } from './platform-icon'
import { canonicalCity, canonicalLanguages, canonicalState, followersLabel, type ParamKey, type ParamsPatch } from './filter-utils'

const CITY_OPTIONS = POPULAR_CITIES.map((c) => ({ value: c, label: c }))
const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }))
const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l, label: l }))
const ANY = 'any'

const DELIVERY_CHOICES: ChoiceOption[] = DELIVERY_OPTIONS.map((o) => ({
  value: o.value === undefined ? ANY : String(o.value),
  label: o.label.replace(/^Within /, ''),
}))

const FOLLOWER_CHOICES: ChoiceOption[] = FOLLOWER_RANGES.map((r, i) => ({ value: String(i), label: r.label }))

const RATING_CHOICES: ChoiceOption[] = [
  { value: ANY, label: 'Any' },
  { value: '4', label: '4.0+' },
  { value: '4.5', label: '4.5+' },
]

const GENDER_CHOICES: ChoiceOption[] = [
  { value: ANY, label: 'Any' },
  ...GENDERS.filter((g) => g.value !== 'prefer_not_to_say').map((g) => ({ value: g.value, label: g.label })),
]

const PLATFORM_CHOICES: ChoiceOption[] = [
  { value: ANY, label: 'Any' },
  ...PLATFORMS.map((p) => ({ value: p.value, label: p.label, icon: <PlatformIcon platform={p.value} /> })),
]

/** Keeps a chip group honest when the URL holds a value outside the presets (e.g. from smart search). */
function withCustom(options: ChoiceOption[], value: string, label: string | null) {
  return options.some((o) => o.value === value) || !label ? options : [...options, { value, label }]
}

function FilterGroup({
  id,
  title,
  active,
  onClear,
  children,
}: {
  id: string
  title: string
  active?: boolean
  onClear?: () => void
  children: React.ReactNode
}) {
  return (
    <div role="group" aria-labelledby={id} className="border-b border-line py-5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-3 flex min-h-5 items-center justify-between gap-2">
        <h3 id={id} className="font-sans text-sm font-semibold tracking-normal text-ink">
          {title}
        </h3>
        {active && onClear && (
          <button type="button" onClick={onClear} className="focus-ring rounded-md text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
            Clear<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function CatalogError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <p className="text-sm text-muted">
      Couldn’t load {what}.{' '}
      <button type="button" onClick={onRetry} className="focus-ring rounded-md font-medium text-ink underline underline-offset-2">
        Retry
      </button>
    </p>
  )
}

/**
 * Controlled marketplace filters. The desktop sidebar applies every change to
 * the URL immediately; the mobile drawer collects a draft and applies it at once.
 */
export function FilterPanel({
  value,
  onChange,
  hide = [],
  idPrefix,
  className,
}: {
  value: CreatorSearchParams
  onChange: (patch: ParamsPatch) => void
  hide?: readonly ParamKey[]
  idPrefix: string
  className?: string
}) {
  const categories = useCategories()
  const creatorTypes = useCreatorTypes()
  const id = (name: string) => `${idPrefix}-${name}`

  const priceValue = React.useMemo<[number | undefined, number | undefined]>(() => [value.minPrice, value.maxPrice], [value.minPrice, value.maxPrice])
  const ageValue = React.useMemo<[number | undefined, number | undefined]>(() => [value.minAge, value.maxAge], [value.minAge, value.maxAge])

  const followerIndex = FOLLOWER_RANGES.findIndex((r) => r.min === value.minFollowers && r.max === value.maxFollowers)
  const followerValue = followerIndex >= 0 ? String(followerIndex) : 'custom'
  const followerChoices = withCustom(FOLLOWER_CHOICES, followerValue, followersLabel(value.minFollowers, value.maxFollowers))

  const deliveryValue = value.maxDelivery === undefined ? ANY : String(value.maxDelivery)
  const deliveryChoices = withCustom(DELIVERY_CHOICES, deliveryValue, value.maxDelivery === undefined ? null : `${value.maxDelivery} days`)

  const ratingValue = value.minRating === undefined ? ANY : String(value.minRating)
  const ratingChoices = withCustom(RATING_CHOICES, ratingValue, value.minRating === undefined ? null : `${value.minRating}+`)

  const genderValue = value.gender ?? ANY
  const genderChoices = withCustom(GENDER_CHOICES, genderValue, value.gender ?? null)
  const platformValue = value.platform ?? ANY
  const platformChoices = withCustom(PLATFORM_CHOICES, platformValue, value.platform ?? null)

  const languages = canonicalLanguages(value.languages)

  return (
    <div className={cn('flex flex-col', className)}>
      <FilterGroup id={id('quick')} title="Show only">
        <div className="space-y-4">
          <SwitchRow
            id={id('available')}
            label="Available now"
            description="Taking new orders"
            checked={!!value.available}
            onCheckedChange={(checked) => onChange({ available: checked || undefined })}
          />
          <SwitchRow
            id={id('verified')}
            label="Verified creators"
            description="Verified by the House of Collabs team"
            checked={!!value.verified}
            onCheckedChange={(checked) => onChange({ verified: checked || undefined })}
          />
        </div>
      </FilterGroup>

      {!hide.includes('category') && (
        <FilterGroup id={id('category-title')} title="Category" active={!!value.category} onClear={() => onChange({ category: undefined })}>
          {categories.isError ? (
            <CatalogError what="categories" onRetry={() => void categories.refetch()} />
          ) : (
            <Select
              id={id('category')}
              aria-label="Category"
              value={value.category?.toLowerCase() ?? ''}
              onValueChange={(v) => onChange({ category: v || undefined })}
              options={(categories.data ?? []).map((c) => ({ value: c.slug, label: c.name }))}
              anyLabel="All categories"
              placeholder={categories.isPending ? 'Loading categories…' : 'All categories'}
              disabled={categories.isPending}
            />
          )}
        </FilterGroup>
      )}

      <FilterGroup
        id={id('location-title')}
        title="Location"
        active={!!(value.city || value.state)}
        onClear={() => onChange({ city: undefined, state: undefined })}
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id('city')} className="text-xs font-medium text-muted">
              City
            </Label>
            <Combobox
              id={id('city')}
              value={canonicalCity(value.city) ?? ''}
              onChange={(v) => onChange({ city: v || undefined })}
              options={CITY_OPTIONS}
              placeholder="Any city"
              searchPlaceholder="Search or type a city…"
              emptyText="Type a city name to use it."
              allowCustom
              clearable
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id('state')} className="text-xs font-medium text-muted">
              State
            </Label>
            <Select
              id={id('state')}
              value={canonicalState(value.state) ?? ''}
              onValueChange={(v) => onChange({ state: v || undefined })}
              options={STATE_OPTIONS}
              anyLabel="Any state"
              placeholder="Any state"
            />
          </div>
        </div>
      </FilterGroup>

      <FilterGroup
        id={id('price-title')}
        title="Budget per service"
        active={value.minPrice !== undefined || value.maxPrice !== undefined}
        onClear={() => onChange({ minPrice: undefined, maxPrice: undefined })}
      >
        <RangeSlider
          min={PRICE_BOUNDS.min}
          max={PRICE_BOUNDS.max}
          step={PRICE_BOUNDS.step}
          value={priceValue}
          onChange={([min, max]) => onChange({ minPrice: min, maxPrice: max })}
          format={(n) => formatINR(n)}
          label="price"
        />
      </FilterGroup>

      <FilterGroup id={id('delivery-title')} title="Delivery time" active={value.maxDelivery !== undefined} onClear={() => onChange({ maxDelivery: undefined })}>
        <ChoiceChips
          aria-labelledby={id('delivery-title')}
          value={deliveryValue}
          options={deliveryChoices}
          onValueChange={(v) => onChange({ maxDelivery: v === ANY ? undefined : Number(v) })}
        />
      </FilterGroup>

      <FilterGroup
        id={id('followers-title')}
        title="Followers"
        active={value.minFollowers !== undefined || value.maxFollowers !== undefined}
        onClear={() => onChange({ minFollowers: undefined, maxFollowers: undefined })}
      >
        <ChoiceChips
          aria-labelledby={id('followers-title')}
          value={followerValue}
          options={followerChoices}
          onValueChange={(v) => {
            const range = FOLLOWER_RANGES[Number(v)]
            if (range) onChange({ minFollowers: range.min, maxFollowers: range.max })
          }}
        />
      </FilterGroup>

      <FilterGroup id={id('platform-title')} title="Platform" active={!!value.platform} onClear={() => onChange({ platform: undefined })}>
        <ChoiceChips
          aria-labelledby={id('platform-title')}
          value={platformValue}
          options={platformChoices}
          onValueChange={(v) => onChange({ platform: v === ANY ? undefined : v })}
        />
      </FilterGroup>

      <FilterGroup id={id('content-title')} title="Content format" active={!!value.contentType} onClear={() => onChange({ contentType: undefined })}>
        <Select
          id={id('content')}
          aria-label="Content format"
          value={value.contentType ?? ''}
          onValueChange={(v) => onChange({ contentType: v || undefined })}
          options={CONTENT_TYPES}
          anyLabel="Any format"
          placeholder="Any format"
        />
      </FilterGroup>

      <FilterGroup id={id('type-title')} title="Creator type" active={!!value.creatorType} onClear={() => onChange({ creatorType: undefined })}>
        {creatorTypes.isError ? (
          <CatalogError what="creator types" onRetry={() => void creatorTypes.refetch()} />
        ) : (
          <Select
            id={id('type')}
            aria-label="Creator type"
            value={value.creatorType ?? ''}
            onValueChange={(v) => onChange({ creatorType: v || undefined })}
            options={(creatorTypes.data ?? []).map((t) => ({ value: t.slug, label: t.name }))}
            anyLabel="Any type"
            placeholder={creatorTypes.isPending ? 'Loading types…' : 'Any type'}
            disabled={creatorTypes.isPending}
          />
        )}
      </FilterGroup>

      <FilterGroup id={id('rating-title')} title="Rating" active={value.minRating !== undefined} onClear={() => onChange({ minRating: undefined })}>
        <ChoiceChips
          aria-labelledby={id('rating-title')}
          value={ratingValue}
          options={ratingChoices}
          onValueChange={(v) => onChange({ minRating: v === ANY ? undefined : Number(v) })}
        />
      </FilterGroup>

      <FilterGroup id={id('gender-title')} title="Gender" active={!!value.gender} onClear={() => onChange({ gender: undefined })}>
        <ChoiceChips
          aria-labelledby={id('gender-title')}
          value={genderValue}
          options={genderChoices}
          onValueChange={(v) => onChange({ gender: v === ANY ? undefined : v })}
        />
      </FilterGroup>

      <FilterGroup
        id={id('age-title')}
        title="Age"
        active={value.minAge !== undefined || value.maxAge !== undefined}
        onClear={() => onChange({ minAge: undefined, maxAge: undefined })}
      >
        <RangeSlider
          min={AGE_BOUNDS.min}
          max={AGE_BOUNDS.max}
          value={ageValue}
          onChange={([min, max]) => onChange({ minAge: min, maxAge: max })}
          label="age"
        />
      </FilterGroup>

      <FilterGroup id={id('languages-title')} title="Languages" active={languages.length > 0} onClear={() => onChange({ languages: undefined })}>
        <label htmlFor={id('languages')} className="sr-only">
          Languages
        </label>
        <MultiSelect
          id={id('languages')}
          value={languages}
          onChange={(v) => onChange({ languages: v.length ? v : undefined })}
          options={LANGUAGE_OPTIONS}
          placeholder="Any language"
          searchPlaceholder="Search languages…"
        />
      </FilterGroup>
    </div>
  )
}
