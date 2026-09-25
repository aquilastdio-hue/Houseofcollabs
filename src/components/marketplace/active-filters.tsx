import { Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CreatorSearchParams } from '@/services/creators.service'
import type { SmartSearchResult } from '@/services/search.service'
import {
  buildFilterChips,
  removeKeys,
  smartChipApplies,
  smartChipKeys,
  type FilterLookups,
  type ParamKey,
  type ParamsPatch,
} from './filter-utils'

function Chip({ label, tone, onRemove }: { label: string; tone: 'smart' | 'plain'; onRemove: () => void }) {
  return (
    <li
      className={cn(
        'inline-flex h-8 max-w-full items-center gap-1 rounded-pill pr-1 pl-3 text-sm font-medium',
        tone === 'smart' ? 'bg-brand-soft text-brand-ink' : 'border border-line bg-surface text-ink-soft',
      )}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="focus-ring flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ink/10"
      >
        <X className="size-3.5" />
      </button>
    </li>
  )
}

/**
 * One row describing everything that narrows the results. After a smart search
 * it leads with "We understood:" and the parser's own wording; filters added by
 * hand afterwards follow as plain chips.
 */
export function ActiveFilters({
  params,
  exclude,
  interpretation,
  lookups,
  showKeyword,
  onRemove,
  onClearAll,
  className,
}: {
  params: CreatorSearchParams
  /** Keys fixed by the page (e.g. the category on a category page). */
  exclude: readonly ParamKey[]
  interpretation: SmartSearchResult | null
  lookups: FilterLookups
  /** Show the keyword as a chip (smart mode, where no input displays it). */
  showKeyword: boolean
  onRemove: (patch: ParamsPatch) => void
  onClearAll: () => void
  className?: string
}) {
  const smartChips = interpretation
    ? interpretation.chips.filter((chip) => {
        const keys = smartChipKeys(chip)
        if (keys.some((k) => exclude.includes(k))) return false
        if (chip.field === 'q' && !showKeyword) return false
        return smartChipApplies(chip, interpretation.filters, params)
      })
    : []
  const covered = new Set(smartChips.flatMap(smartChipKeys))
  const manualChips = buildFilterChips(params, lookups, { exclude, keyword: showKeyword }).filter((chip) => !chip.keys.some((k) => covered.has(k)))
  const nothingUnderstood = showKeyword && !!interpretation && interpretation.chips.length === 0
  const total = smartChips.length + manualChips.length

  if (total === 0 && !nothingUnderstood) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {smartChips.length > 0 && (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
          <Sparkles className="size-4 text-brand-ink" aria-hidden /> We understood:
        </span>
      )}
      {nothingUnderstood && (
        <p className="text-sm text-muted">
          We couldn’t spot any filters in “{interpretation.query}”. Try a niche, city, budget or delivery time.
        </p>
      )}
      {total > 0 && (
        <>
          <ul aria-label="Active filters" className="flex min-w-0 flex-wrap items-center gap-2">
            {smartChips.map((chip) => (
              <Chip key={`smart-${chip.field}`} tone="smart" label={chip.label} onRemove={() => onRemove(removeKeys(smartChipKeys(chip)))} />
            ))}
            {manualChips.map((chip) => (
              <Chip key={chip.id} tone="plain" label={chip.label} onRemove={() => onRemove(chip.remove)} />
            ))}
          </ul>
          <button
            type="button"
            onClick={onClearAll}
            className="focus-ring ml-1 rounded-md text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-ink"
          >
            Clear all
          </button>
        </>
      )}
    </div>
  )
}
