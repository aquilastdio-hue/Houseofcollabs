import { formatCompact, formatINR, titleCase } from '@/lib/format'
import { CONTENT_TYPES, GENDERS, INDIAN_STATES, LANGUAGES, PLATFORMS, POPULAR_CITIES, labelFor } from '@/lib/constants'
import type { CreatorSearchParams } from '@/services/creators.service'
import type { SmartSearchChip, SmartSearchFilters } from '@shared/smart-search-parser'
import type { Category, CreatorTypeRow } from '@/types'

/**
 * Pure helpers shared by the marketplace filter panel, the active-filter chips
 * and the mobile filter drawer. URL params stay the single source of truth;
 * these only describe, compare and patch them.
 */

export type ParamKey = keyof CreatorSearchParams
export type ParamsPatch = Partial<CreatorSearchParams>

/** Every manual filter (not the keyword, sort or page). */
export const FILTER_KEYS = [
  'category',
  'city',
  'state',
  'minPrice',
  'maxPrice',
  'minFollowers',
  'maxFollowers',
  'maxDelivery',
  'gender',
  'minAge',
  'maxAge',
  'languages',
  'creatorType',
  'contentType',
  'platform',
  'verified',
  'available',
  'minRating',
] as const satisfies readonly ParamKey[]

export type FilterValues = Pick<CreatorSearchParams, (typeof FILTER_KEYS)[number]>

/** Patch that sets the given keys to `undefined` (removes them from the URL). */
export function removeKeys(keys: readonly ParamKey[]): ParamsPatch {
  const patch: ParamsPatch = {}
  for (const k of keys) patch[k] = undefined
  return patch
}

/** Patch that removes every filter — and the keyword too when asked. */
export function clearFiltersPatch(opts: { keyword?: boolean } = {}): ParamsPatch {
  return removeKeys(opts.keyword ? [...FILTER_KEYS, 'q'] : FILTER_KEYS)
}

export function pickFilters(params: CreatorSearchParams): FilterValues {
  const out: Record<string, unknown> = {}
  for (const k of FILTER_KEYS) if (params[k] !== undefined) out[k] = params[k]
  return out as FilterValues
}

function norm(v: unknown) {
  return typeof v === 'string' ? v.trim().toLowerCase() : v
}

/** Case-insensitive equality; arrays compare as sets. */
export function sameValue(a: unknown, b: unknown) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = Array.isArray(a) ? a.map(norm) : []
    const y = Array.isArray(b) ? b.map(norm) : []
    return x.length === y.length && x.every((v) => y.includes(v))
  }
  return norm(a) === norm(b)
}

// ---------------------------------------------------------------------------
// Canonical casing (URLs may carry `city=delhi`, the parser may say "Jammu And Kashmir")
// ---------------------------------------------------------------------------
function canonical(list: readonly string[], value?: string | null) {
  if (!value) return undefined
  const v = value.trim().toLowerCase()
  return list.find((x) => x.toLowerCase() === v) ?? value
}

export const canonicalCity = (value?: string | null) => canonical(POPULAR_CITIES, value)
export const canonicalState = (value?: string | null) => canonical(INDIAN_STATES, value)
export const canonicalLanguages = (values?: string[]) => (values ?? []).map((l) => canonical(LANGUAGES, l) ?? l)

// ---------------------------------------------------------------------------
// Human labels
// ---------------------------------------------------------------------------
export function priceLabel(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `${formatINR(min)} – ${formatINR(max)}`
  if (max !== undefined) return `Under ${formatINR(max)}`
  if (min !== undefined) return `From ${formatINR(min)}`
  return null
}

export function followersLabel(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `${formatCompact(min)} – ${formatCompact(max)} followers`
  if (min !== undefined) return `${formatCompact(min)}+ followers`
  if (max !== undefined) return `Under ${formatCompact(max)} followers`
  return null
}

export function ageLabel(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `Age ${min}–${max}`
  if (min !== undefined) return `Age ${min}+`
  if (max !== undefined) return `Age up to ${max}`
  return null
}

export const deliveryLabel = (days: number) => (days <= 1 ? 'Within 24 hours' : `Within ${days} days`)
export const ratingLabel = (rating: number) => `Rated ${rating}+`

// ---------------------------------------------------------------------------
// Active filter chips
// ---------------------------------------------------------------------------
export type FilterChip = {
  id: string
  /** Chips in the same group count once in "Filters (n)". */
  group: string
  label: string
  /** URL keys this chip describes. */
  keys: ParamKey[]
  /** Patch that removes this chip. */
  remove: ParamsPatch
}

export type FilterLookups = {
  categories?: Pick<Category, 'slug' | 'name'>[]
  creatorTypes?: Pick<CreatorTypeRow, 'slug' | 'name'>[]
}

export function buildFilterChips(
  params: CreatorSearchParams,
  lookups: FilterLookups,
  opts: { exclude?: readonly ParamKey[]; keyword?: boolean } = {},
): FilterChip[] {
  const exclude = opts.exclude ?? []
  const chips: FilterChip[] = []
  const add = (id: string, label: string, keys: ParamKey[], remove: ParamsPatch = removeKeys(keys), group = id) => {
    if (keys.some((k) => exclude.includes(k))) return
    chips.push({ id, group, label, keys, remove })
  }

  if (opts.keyword && params.q) add('q', `“${params.q}”`, ['q'])
  if (params.category) {
    const slug = params.category.toLowerCase()
    add('category', lookups.categories?.find((c) => c.slug === slug)?.name ?? titleCase(params.category), ['category'])
  }
  if (params.city) add('city', canonicalCity(params.city) ?? params.city, ['city'])
  if (params.state) add('state', canonicalState(params.state) ?? params.state, ['state'])
  const price = priceLabel(params.minPrice, params.maxPrice)
  if (price) add('price', price, ['minPrice', 'maxPrice'])
  if (params.maxDelivery !== undefined) add('delivery', deliveryLabel(params.maxDelivery), ['maxDelivery'])
  const followers = followersLabel(params.minFollowers, params.maxFollowers)
  if (followers) add('followers', followers, ['minFollowers', 'maxFollowers'])
  if (params.platform) add('platform', labelFor(PLATFORMS, params.platform) || titleCase(params.platform), ['platform'])
  if (params.contentType) add('contentType', labelFor(CONTENT_TYPES, params.contentType), ['contentType'])
  if (params.creatorType) {
    add('creatorType', lookups.creatorTypes?.find((t) => t.slug === params.creatorType)?.name ?? titleCase(params.creatorType), ['creatorType'])
  }
  if (params.gender) add('gender', labelFor(GENDERS, params.gender) || titleCase(params.gender), ['gender'])
  const age = ageLabel(params.minAge, params.maxAge)
  if (age) add('age', age, ['minAge', 'maxAge'])
  const languages = canonicalLanguages(params.languages)
  for (const lang of languages) {
    add(`lang:${lang}`, lang, ['languages'], { languages: languages.filter((l) => l !== lang) }, 'languages')
  }
  if (params.minRating !== undefined) add('rating', ratingLabel(params.minRating), ['minRating'])
  if (params.available) add('available', 'Available now', ['available'])
  if (params.verified) add('verified', 'Verified', ['verified'])
  return chips
}

export function countFilterGroups(chips: FilterChip[]) {
  return new Set(chips.filter((c) => c.id !== 'q').map((c) => c.group)).size
}

// ---------------------------------------------------------------------------
// Smart-search interpretation chips
// ---------------------------------------------------------------------------
const SMART_CHIP_KEYS: Partial<Record<keyof SmartSearchFilters, ParamKey[]>> = {
  minPrice: ['minPrice', 'maxPrice'],
  maxPrice: ['minPrice', 'maxPrice'],
  minFollowers: ['minFollowers', 'maxFollowers'],
  maxFollowers: ['minFollowers', 'maxFollowers'],
  minAge: ['minAge', 'maxAge'],
  maxAge: ['minAge', 'maxAge'],
}

export function smartChipKeys(chip: SmartSearchChip): ParamKey[] {
  return SMART_CHIP_KEYS[chip.field] ?? [chip.field]
}

/** True while the URL still carries the values the smart search set for this chip. */
export function smartChipApplies(chip: SmartSearchChip, filters: SmartSearchFilters, params: CreatorSearchParams) {
  const parsed: CreatorSearchParams = filters
  return smartChipKeys(chip).every((k) => parsed[k] === undefined || sameValue(params[k], parsed[k]))
}
