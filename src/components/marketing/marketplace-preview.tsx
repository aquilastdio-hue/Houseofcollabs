import * as React from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { site } from '@/config/site'
import { useCategories } from '@/hooks/use-catalog'
import type { CreatorSearchParams } from '@/services/creators.service'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LiveCreatorGrid } from './live-creator-grid'
import { Accent, SectionHeader } from './primitives'

const PREVIEW_COUNT = 8
const CHIP_LIMIT = 7

/** Home: category chips + a grid of top-rated live creators. */
export function MarketplacePreviewSection() {
  const categories = useCategories()
  const [category, setCategory] = React.useState('')
  const params = React.useMemo<CreatorSearchParams>(
    () => ({ sort: 'rating', pageSize: PREVIEW_COUNT, ...(category ? { category } : {}) }),
    [category],
  )
  const chips = (categories.data ?? []).slice(0, CHIP_LIMIT)
  const activeName = chips.find((c) => c.slug === category)?.name
  const exploreHref = category ? `/discover?category=${encodeURIComponent(category)}` : '/discover'

  return (
    <section aria-labelledby="marketplace-preview-title" className="py-section">
      <div className="container-page">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            titleId="marketplace-preview-title"
            eyebrow="Inside the marketplace"
            title={
              <>
                Real storefronts, <Accent>real prices</Accent>
              </>
            }
            description={`A live look at top-rated creators on ${site.name}. Every card shows a starting price, turnaround and rating — before you ever send a message.`}
          />
          <Button asChild variant="outline" size="lg" className="shrink-0 self-start md:self-auto">
            <Link to={exploreHref}>
              Explore all creators <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="no-scrollbar -mx-gutter mt-10 flex gap-2 overflow-x-auto px-gutter pb-1" role="group" aria-label="Filter the preview by category">
          <Chip active={!category} onClick={() => setCategory('')}>
            All creators
          </Chip>
          {categories.isPending &&
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-pill" />)}
          {chips.map((c) => (
            <Chip key={c.id} active={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name}
            </Chip>
          ))}
        </div>

        <div className="mt-8">
          <p className="sr-only" aria-live="polite">
            {activeName ? `Showing top-rated ${activeName} creators` : 'Showing top-rated creators'}
          </p>
          <LiveCreatorGrid
            params={params}
            count={PREVIEW_COUNT}
            emptyTitle={activeName ? `No ${activeName.toLowerCase()} creators yet` : 'No creators published yet'}
            emptyDescription={
              activeName
                ? 'Try another category, or browse the whole marketplace.'
                : 'Creators are setting up their storefronts. Browse the marketplace or create yours.'
            }
          />
        </div>
      </div>
    </section>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'focus-ring h-10 shrink-0 rounded-pill border px-4 text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-200',
        active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
