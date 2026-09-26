import { Link } from 'react-router'
import { ArrowRight, ArrowUpRight, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toneFor } from '@/lib/constants'
import { useCategories } from '@/hooks/use-catalog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { categoryIcon } from './category-icon'
import { Accent, Reveal, SectionHeader } from './primitives'

/** Live category directory; each tile links to its category landing page. */
export function CategoryGrid({ className }: { className?: string }) {
  const query = useCategories()
  const gridClass = cn('grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5', className)

  if (query.isPending) {
    return (
      <div className={gridClass} aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-card" />
        ))}
      </div>
    )
  }
  if (query.isError) {
    return <ErrorState error={query.error} title="We couldn’t load categories" onRetry={() => void query.refetch()} compact />
  }
  if (query.data.length === 0) {
    return (
      <EmptyState
        compact
        icon={<LayoutGrid />}
        title="No categories to show yet"
        description="You can still search every published creator in the marketplace."
        action={
          <Button asChild size="sm">
            <Link to="/discover">Browse creators</Link>
          </Button>
        }
      />
    )
  }

  return (
    <ul className={gridClass}>
      {query.data.map((category, i) => {
        const tone = toneFor(category.color)
        const Icon = categoryIcon(category.icon)
        return (
          <Reveal as="li" key={category.id} delay={(i % 5) * 60}>
            <Link
              to={`/categories/${category.slug}`}
              className="focus-ring group flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-4 transition-[box-shadow,transform,border-color] duration-300 ease-spring hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-hover sm:p-5"
            >
              <span className="flex items-start justify-between gap-2">
                <span className={cn('flex size-11 items-center justify-center rounded-control transition-transform duration-300 ease-spring group-hover:-rotate-6', tone.bg, tone.fg)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="size-4 text-faint transition-[color,translate] duration-300 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
                />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">{category.name}</span>
              {category.description && <span className="line-clamp-2 text-sm leading-snug text-muted">{category.description}</span>}
            </Link>
          </Reveal>
        )
      })}
    </ul>
  )
}

export function CategoryDiscoverySection() {
  return (
    <section aria-labelledby="category-discovery-title" className="section-blend py-section">
      <div className="container-page">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            titleId="category-discovery-title"
            eyebrow="Creator discovery"
            title={
              <>
                Whatever you sell, there’s a <Accent>creator for it</Accent>
              </>
            }
            description="Start with a category and narrow down by city, language, budget and turnaround."
          />
          <Button asChild variant="ghost" size="lg" className="shrink-0 self-start md:self-auto">
            <Link to="/discover">
              Search all creators <ArrowRight />
            </Link>
          </Button>
        </div>
        <CategoryGrid className="mt-12" />
      </div>
    </section>
  )
}
