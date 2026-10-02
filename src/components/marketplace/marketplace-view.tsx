import * as React from 'react'
import { Link } from 'react-router'
import { ArrowRight, SearchX, Sparkles, Users } from 'lucide-react'
import { cn, range } from '@/lib/utils'
import { pluralize } from '@/lib/format'
import { PAGE_SIZE, SORT_OPTIONS } from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'
import { useCategories, useCreatorTypes } from '@/hooks/use-catalog'
import { searchFromParams, useCreatorSearch, useMarketplaceFilters } from '@/hooks/use-creators'
import { smartFiltersToParams, type SmartSearchResult } from '@/services/search.service'
import type { CreatorSearchParams } from '@/services/creators.service'
import type { CreatorCard as CreatorCardData } from '@/types'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { creatorListSchema } from '@/lib/structured-data'
import { CreatorCard, CreatorCardSkeleton, CreatorGrid } from './creator-card'
import { ActiveFilters } from './active-filters'
import { FilterDrawer } from './filter-drawer'
import { FilterPanel } from './filter-panel'
import { SmartSearchBar, type SearchMode } from './smart-search-bar'
import { buildFilterChips, clearFiltersPatch, countFilterGroups, type ParamKey, type ParamsPatch } from './filter-utils'

export type MarketplaceMode = 'brand' | 'public'

const NO_FIXED: Partial<CreatorSearchParams> = {}
/** The results column sits beside a filter sidebar from `lg`, so cards need wider tracks than the default grid. */
const GRID_CLASS = 'lg:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-3'

/**
 * Marketplace search used by `/brand/creators`, `/discover` and
 * `/categories/:slug`. The URL query string is the source of truth; all
 * filtering, sorting and pagination happen server-side in `search_creators`.
 */
export function MarketplaceView({
  mode,
  fixed = NO_FIXED,
  title,
  description,
  className,
}: {
  mode: MarketplaceMode
  /** Params the page pins (hidden from the filters), e.g. `{ category: slug }`. Pass a stable object. */
  fixed?: Partial<CreatorSearchParams>
  /** Renders a page header (with the page's single h1) above the search. */
  title?: string
  description?: string
  className?: string
}) {
  const { params, setParams } = useMarketplaceFilters(fixed)
  const search = useCreatorSearch(params, { track: mode === 'brand' })
  const categories = useCategories()
  const creatorTypes = useCreatorTypes()

  const fixedKeys = React.useMemo(() => Object.keys(fixed) as ParamKey[], [fixed])
  const [searchMode, setSearchMode] = React.useState<SearchMode>(() => (params.q ? 'keyword' : 'smart'))
  const [interpretation, setInterpretation] = React.useState<SmartSearchResult | null>(null)
  /** Bumped by "Clear all" so the search inputs start blank again. */
  const [searchKey, setSearchKey] = React.useState(0)
  const resultsRef = React.useRef<HTMLElement>(null)

  const lookups = { categories: categories.data, creatorTypes: creatorTypes.data }
  const activeCount = countFilterGroups(buildFilterChips(params, lookups, { exclude: fixedKeys }))
  const hasCriteria = activeCount > 0 || !!params.q
  const page = Math.max(1, params.page ?? 1)

  const applyPatch = (patch: ParamsPatch) => setParams(patch)
  // Router updates run in a transition; local state that describes the URL joins
  // the same transition so chips and results never disagree for a frame.
  const clearAll = () => {
    React.startTransition(() => {
      setInterpretation(null)
      setSearchKey((k) => k + 1)
    })
    setParams(clearFiltersPatch({ keyword: true }))
  }
  const applySmart = (result: SmartSearchResult) => {
    React.startTransition(() => setInterpretation(result))
    setParams(smartFiltersToParams(result.filters))
  }
  const goToPage = (next: number) => {
    setParams({ page: next }, { resetPage: false })
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const hrefFor = (c: CreatorCardData) => (mode === 'brand' ? `/brand/creators/${c.id}` : `/creators/${c.slug}`)
  const browseAllHref = mode === 'brand' ? '/brand/creators' : '/discover'

  let results: React.ReactNode
  if (search.isPending) {
    results = (
      <CreatorGrid className={GRID_CLASS}>
        {range(8).map((i) => (
          <CreatorCardSkeleton key={i} />
        ))}
      </CreatorGrid>
    )
  } else if (search.isError) {
    results = <ErrorState error={search.error} title="We couldn’t load creators" onRetry={() => void search.refetch()} />
  } else if (search.data.items.length === 0) {
    if (page > 1) {
      results = (
        <EmptyState
          icon={<SearchX />}
          title="Nothing on this page"
          description="There are fewer results than this page number — head back to the first page."
          action={<Button onClick={() => goToPage(1)}>Go to page 1</Button>}
        />
      )
    } else if (hasCriteria) {
      results = (
        <EmptyState
          icon={<SearchX />}
          title="No creators match your filters."
          description="Try a wider budget, a longer delivery time or a nearby city."
          action={
            <Button variant="secondary" onClick={clearAll}>
              Clear filters
            </Button>
          }
        />
      )
    } else if (fixedKeys.length > 0) {
      results = (
        <EmptyState
          icon={<Users />}
          title="No creators in this category yet."
          description="New creators are reviewed and published every week."
          action={
            <Button asChild variant="secondary">
              <Link to={browseAllHref}>Browse all creators</Link>
            </Button>
          }
        />
      )
    } else {
      results = <EmptyState icon={<Users />} title="No creators published yet." description="New creators are reviewed and published every week — check back soon." />
    }
  } else {
    results = (
      <>
        {/* The public grid describes itself to search engines. Each entry
            points at a storefront the visitor can actually click, so the list
            matches what is on screen. The brand workspace is noindex, so it
            has nothing to gain from it. */}
        {mode === 'public' && (
          <script type="application/ld+json">
            {JSON.stringify(creatorListSchema(search.data.items, 'Creators on House of Collabs'))}
          </script>
        )}
        <div aria-busy={search.isPlaceholderData} className={cn('transition-opacity duration-200', search.isPlaceholderData && 'pointer-events-none opacity-60')}>
          <CreatorGrid className={GRID_CLASS}>
            {search.data.items.map((creator, i) => (
              <CreatorCard key={creator.id} creator={creator} href={hrefFor(creator)} showCompare={mode === 'brand'} priority={i < 4} />
            ))}
          </CreatorGrid>
        </div>
        <Pagination className="mt-8" page={page} pageSize={PAGE_SIZE} total={search.data.total} onPageChange={goToPage} label="creators" />
      </>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {title && <PageHeader title={title} description={description} className="mb-0 sm:mb-0" />}
      {mode === 'public' && <PublicInvite params={params} />}

      <div className="flex flex-col gap-4">
        <SmartSearchBar
          key={searchKey}
          mode={searchMode}
          onModeChange={setSearchMode}
          keyword={params.q ?? ''}
          onKeywordChange={(q) => setParams({ q })}
          onSmartResult={applySmart}
          showExamples={!interpretation && !hasCriteria}
        />
        <ActiveFilters
          params={params}
          exclude={fixedKeys}
          interpretation={interpretation}
          lookups={lookups}
          showKeyword={searchMode === 'smart'}
          onRemove={applyPatch}
          onClearAll={clearAll}
        />
      </div>

      <div className="lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[17.5rem_minmax(0,1fr)]">
        <aside
          aria-labelledby="marketplace-filters-heading"
          className="hidden rounded-card border border-line bg-surface p-5 shadow-card lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:block lg:max-h-[calc(100dvh-var(--header-height)-3rem)] lg:overflow-y-auto"
        >
          <div className="mb-5 flex items-center justify-between gap-2">
            <h2 id="marketplace-filters-heading" className="font-display text-lg font-semibold tracking-tight">
              Filters
            </h2>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => setParams(clearFiltersPatch())}
                className="focus-ring rounded-md text-sm font-medium text-muted underline underline-offset-4 hover:text-ink"
              >
                Reset
              </button>
            )}
          </div>
          <FilterPanel idPrefix="sidebar-filter" value={params} onChange={applyPatch} hide={fixedKeys} />
        </aside>

        <section ref={resultsRef} aria-labelledby="marketplace-results-heading" className="min-w-0 scroll-mt-[calc(var(--header-height)+1rem)]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="marketplace-results-heading" aria-live="polite" className="font-display text-lg font-semibold tracking-tight">
              {search.data ? (
                pluralize(search.data.total, 'creator')
              ) : search.isError ? (
                'Creators'
              ) : (
                <span className="text-muted">Finding creators…</span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <FilterDrawer className="flex-1 sm:flex-none lg:hidden" params={params} fixed={fixed} activeCount={activeCount} onApply={applyPatch} />
              <div className="flex flex-1 items-center gap-2 sm:flex-none">
                <span className="hidden text-sm text-muted sm:inline" aria-hidden>
                  Sort
                </span>
                <Select
                  size="sm"
                  aria-label="Sort creators"
                  value={params.sort ?? 'relevance'}
                  onValueChange={(v) => setParams({ sort: v === 'relevance' ? undefined : v })}
                  options={SORT_OPTIONS}
                  className="sm:w-48"
                />
              </div>
            </div>
          </div>
          {results}
        </section>
      </div>
    </div>
  )
}

/** Public pages: invite brands to sign up, or hop signed-in brands into their workspace. */
function PublicInvite({ params }: { params: CreatorSearchParams }) {
  const { session, role, brand } = useAuth()
  const query = searchFromParams(params).toString()
  const workspaceHref = `/brand/creators${query ? `?${query}` : ''}`

  if (session && role !== 'brand') return null

  if (role === 'brand') {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">
          You’re signed in{brand?.brand_name ? ` as ${brand.brand_name}` : ''}. Compare, message and hire from your workspace.
        </p>
        <Button asChild size="sm" variant="secondary">
          <Link to={workspaceHref}>
            Open in workspace <ArrowRight />
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-brand-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div>
          <p className="font-medium text-ink">Hiring creators for your brand?</p>
          <p className="text-sm text-ink-soft">Create a free brand account to send briefs, save shortlists and place orders with secure payments.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link to={`/login?redirect=${encodeURIComponent(workspaceHref)}`}>Log in</Link>
        </Button>
        <Button asChild size="sm" variant="primary">
          <Link to="/get-started?role=brand">Sign up as a brand</Link>
        </Button>
      </div>
    </div>
  )
}
