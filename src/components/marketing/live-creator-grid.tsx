import { Link } from 'react-router'
import { ArrowRight, UserRoundSearch } from 'lucide-react'
import { cn, range } from '@/lib/utils'
import { useCreatorSearch } from '@/hooks/use-creators'
import type { CreatorSearchParams } from '@/services/creators.service'
import { Button } from '@/components/ui/button'
import { CreatorCard, CreatorCardSkeleton, CreatorGrid } from '@/components/marketplace/creator-card'
import { EmptyState, ErrorState } from '@/components/shared/states'

/**
 * Hides trailing cards so every breakpoint ends on a complete row.
 *
 * The grid is two columns on phones, three at `lg` and four from `xl`, and the
 * preview fetches twenty. The old limits predate the two-column phone layout:
 * four cards was two rows, which is a very short look at a marketplace on the
 * screen most people arrive on. Sixteen is eight rows there, and eighteen keeps
 * `lg` on six complete rows of three — a wider screen should never show fewer
 * creators than a narrow one. The remainder is one tap away either way, on
 * "Explore all creators".
 */
function trimClass(index: number) {
  return cn(index >= 16 && 'max-[479px]:hidden', index >= 18 && 'lg:max-xl:hidden')
}

/**
 * Grid of live creator storefronts with the four async states. Used by the
 * home marketplace preview and the brands landing page.
 */
export function LiveCreatorGrid({
  params,
  count,
  className,
  emptyTitle = 'No storefronts to show here yet',
  emptyDescription = 'Try another category, or browse every published creator in the marketplace.',
}: {
  params: CreatorSearchParams
  count: number
  className?: string
  emptyTitle?: string
  emptyDescription?: string
}) {
  const query = useCreatorSearch(params)
  const gridClass = cn('3xl:grid-cols-4', className)

  if (query.isPending) {
    return (
      <CreatorGrid className={gridClass}>
        {range(count).map((i) => (
          <div key={i} className={trimClass(i)}>
            <CreatorCardSkeleton />
          </div>
        ))}
      </CreatorGrid>
    )
  }

  if (query.isError) {
    return <ErrorState error={query.error} title="We couldn’t load creators" onRetry={() => void query.refetch()} />
  }

  const items = query.data.items.slice(0, count)
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<UserRoundSearch />}
        title={emptyTitle}
        description={emptyDescription}
        action={
          <>
            <Button asChild size="sm">
              <Link to="/discover">
                Explore all creators <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/get-started?role=creator">Join as a creator</Link>
            </Button>
          </>
        }
      />
    )
  }

  return (
    <div aria-busy={query.isPlaceholderData || undefined} className={cn('transition-opacity duration-300', query.isPlaceholderData && 'opacity-60')}>
      <CreatorGrid className={gridClass}>
        {items.map((creator, i) => (
          <CreatorCard key={creator.id} creator={creator} href={`/creators/${creator.slug}`} className={trimClass(i)} />
        ))}
      </CreatorGrid>
    </div>
  )
}
