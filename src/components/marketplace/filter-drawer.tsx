import * as React from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pluralize } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { searchCreators, type CreatorSearchParams } from '@/services/creators.service'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { FilterPanel } from './filter-panel'
import { clearFiltersPatch, pickFilters, type FilterValues, type ParamKey, type ParamsPatch } from './filter-utils'

/**
 * Mobile/tablet filters: a bottom sheet that edits a draft and applies it in
 * one go. The footer shows a live, server-side count for the draft.
 */
export function FilterDrawer({
  params,
  fixed,
  activeCount,
  onApply,
  className,
}: {
  params: CreatorSearchParams
  fixed: Partial<CreatorSearchParams>
  activeCount: number
  onApply: (patch: ParamsPatch) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<FilterValues>({})
  // Draft used for the live count: debounced while editing, seeded instantly on open.
  const [countDraft, setCountDraft] = React.useState<FilterValues>({})
  const hide = React.useMemo(() => Object.keys(fixed) as ParamKey[], [fixed])

  React.useEffect(() => {
    const t = window.setTimeout(() => setCountDraft(draft), 300)
    return () => window.clearTimeout(t)
  }, [draft])

  const countParams: CreatorSearchParams = { ...pickFilters(countDraft), q: params.q, ...fixed, page: 1, pageSize: 1 }
  const preview = useQuery({
    queryKey: qk.creators.search(countParams),
    queryFn: () => searchCreators(countParams),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const onOpenChange = (next: boolean) => {
    if (next) {
      const current = pickFilters(params)
      setDraft(current)
      setCountDraft(current)
    }
    setOpen(next)
  }

  const apply = () => {
    onApply({ ...clearFiltersPatch(), ...pickFilters(draft) })
    setOpen(false)
  }

  // Never show a count that belongs to a previous draft.
  const total = preview.isPlaceholderData ? undefined : preview.data?.total
  const applyLabel = total === undefined ? 'Show results' : `Show ${pluralize(total, 'creator')}`

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="secondary" size="sm" className={cn('shrink-0', className)} aria-label={activeCount ? `Filters, ${activeCount} active` : 'Filters'}>
          <SlidersHorizontal />
          Filters
          {activeCount > 0 && (
            <span aria-hidden className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-ink px-1.5 text-[0.6875rem] font-semibold text-brand">
              {activeCount}
            </span>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent
        side="bottom"
        title="Filters"
        description="Narrow creators down by budget, turnaround, audience and more."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setDraft({})}>
              Clear all
            </Button>
            <Button className="flex-1" onClick={apply} aria-live="polite">
              {applyLabel}
            </Button>
          </div>
        }
      >
        <FilterPanel idPrefix="drawer-filter" value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} hide={hide} />
      </DrawerContent>
    </Drawer>
  )
}
