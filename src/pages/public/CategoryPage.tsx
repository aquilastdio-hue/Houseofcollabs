import * as React from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Compass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { toAppError } from '@/lib/errors'
import { toneFor } from '@/lib/constants'
import { getCategoryBySlug } from '@/services/catalog.service'
import { useCategories } from '@/hooks/use-catalog'
import type { Category } from '@/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Seo } from '@/components/shared/seo'
import { SmartImage } from '@/components/shared/smart-image'
import { CategoryIcon } from '@/components/marketplace/category-icon'
import { MarketplaceView } from '@/components/marketplace/marketplace-view'

export default function CategoryPage() {
  const { slug = '' } = useParams()
  const key = slug.toLowerCase()
  const category = useQuery({
    queryKey: [...qk.categories, 'slug', key],
    queryFn: () => getCategoryBySlug(key),
    enabled: !!key,
    staleTime: 10 * 60_000,
  })
  const fixed = React.useMemo(() => ({ category: key }), [key])

  const missing = (category.isSuccess && (!category.data || !category.data.active)) || (category.isError && toAppError(category.error).kind === 'not_found')
  if (missing) {
    return (
      <div className="container-page py-section">
        <Seo title="Category not found" noindex />
        <h1 className="sr-only">Category not found</h1>
        <EmptyState
          icon={<Compass />}
          title="We couldn’t find that category"
          description="It may have been renamed or retired. Browse every creator or pick another category."
          action={
            <Button asChild>
              <Link to="/discover">Browse all creators</Link>
            </Button>
          }
        />
        <OtherCategories current={key} className="mt-8 justify-center" />
      </div>
    )
  }

  if (category.isError) {
    return (
      <div className="container-page py-section">
        <Seo title="Creators by category" noindex />
        <h1 className="sr-only">Creators by category</h1>
        <ErrorState error={category.error} onRetry={() => void category.refetch()} />
      </div>
    )
  }

  const data = category.data ?? null
  return (
    <>
      {data ? (
        <Seo
          title={`${data.name} creators`}
          description={`Hire ${data.name.toLowerCase()} creators across India with fixed prices and delivery times.${data.description ? ` ${data.description}` : ''}`}
          image={data.image_url}
        />
      ) : (
        <Seo title="Creators by category" />
      )}
      <CategoryHero category={data} />
      <div className="container-page py-8 sm:py-10">
        <MarketplaceView key={key} mode="public" fixed={fixed} />
      </div>
    </>
  )
}

function CategoryHero({ category }: { category: Category | null }) {
  const tone = toneFor(category?.color)
  return (
    <section className={cn('border-b border-line', tone.bg)}>
      <div className="container-page grid grid-cols-1 gap-8 pt-8 pb-10 sm:pt-10 sm:pb-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <Breadcrumb items={[{ label: 'Discover', href: '/discover' }, { label: category?.name ?? 'Category' }]} />
          {category ? (
            <>
              <div className="flex items-center gap-3">
                <span className={cn('flex size-11 items-center justify-center rounded-control bg-surface/80 shadow-card', tone.fg)}>
                  <CategoryIcon icon={category.icon} />
                </span>
                <p className={cn('eyebrow', tone.fg)}>Category</p>
              </div>
              <h1 className="mt-4 font-display text-display-lg font-semibold">
                {category.name} <span className="font-serif font-normal italic">creators</span>
              </h1>
              {category.description && <p className="mt-3 max-w-2xl text-lg text-ink-soft">{category.description}</p>}
            </>
          ) : (
            <div aria-busy className="space-y-4">
              <h1 className="sr-only">Creators by category</h1>
              <Skeleton className="size-11" />
              <Skeleton className="h-12 w-72 max-w-full" />
              <Skeleton className="h-5 w-full max-w-xl" />
            </div>
          )}
          <OtherCategories current={category?.slug} className="mt-6" />
        </div>
        {category?.image_url && (
          <SmartImage src={category.image_url} alt="" eager className="hidden aspect-[4/3] w-80 rounded-hero shadow-card lg:block" />
        )}
      </div>
    </section>
  )
}

function OtherCategories({ current, className }: { current?: string; className?: string }) {
  const categories = useCategories()
  const others = (categories.data ?? []).filter((c) => c.slug !== current)
  if (others.length === 0) return null
  return (
    <nav aria-label="Other categories">
      <ul className={cn('flex flex-wrap gap-2', className)}>
        {others.map((c) => (
          <li key={c.id}>
            <Link
              to={`/categories/${c.slug}`}
              className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-pill border border-ink/10 bg-surface/70 px-3 text-sm font-medium text-ink-soft transition-colors hover:border-ink/25 hover:bg-surface hover:text-ink"
            >
              <CategoryIcon icon={c.icon} className="size-3.5" />
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
