import * as React from 'react'
import { MessageSquareQuote } from 'lucide-react'
import { cn, range } from '@/lib/utils'
import { pluralize } from '@/lib/format'
import { useCreatorReviews } from '@/hooks/use-creators'
import type { CreatorProfile } from '@/services/creators.service'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Pagination } from '@/components/shared/pagination'
import { ReviewCard } from '@/components/shared/review-card'
import { StarRating } from '@/components/shared/star-rating'
import { ProfileSection } from './creator-profile-sections'
import { firstName, scrollToSection } from './profile-utils'

/** Matches the default page size of `getCreatorReviews`. */
const REVIEWS_PAGE_SIZE = 6

export function ReviewsSection({ creator }: { creator: CreatorProfile }) {
  const [page, setPage] = React.useState(1)
  const reviews = useCreatorReviews(creator.id, page)
  const rating = Number(creator.rating)

  let body: React.ReactNode
  if (reviews.isPending) {
    body = (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy>
        {range(2).map((i) => (
          <Skeleton key={i} className="h-48 rounded-card" />
        ))}
      </div>
    )
  } else if (reviews.isError) {
    body = <ErrorState compact error={reviews.error} title="We couldn’t load reviews" onRetry={() => void reviews.refetch()} />
  } else if (reviews.data.items.length === 0) {
    body = (
      <EmptyState
        compact
        icon={<MessageSquareQuote />}
        title="No reviews yet"
        description={`Reviews appear here after brands complete orders with ${firstName(creator.display_name)}.`}
      />
    )
  } else {
    body = (
      <>
        <div aria-busy={reviews.isPlaceholderData} className={cn('grid gap-4 transition-opacity md:grid-cols-2', reviews.isPlaceholderData && 'opacity-60')}>
          {reviews.data.items.map((r) => (
            <ReviewCard
              key={r.id}
              rating={r.rating}
              comment={r.comment}
              authorName={r.brand_name ?? 'Brand'}
              authorImage={r.brand_logo_url}
              subtitle={r.service_title}
              date={r.created_at}
              response={r.response}
              responderName={creator.display_name}
            />
          ))}
        </div>
        <Pagination
          className="mt-6"
          page={page}
          pageSize={REVIEWS_PAGE_SIZE}
          total={reviews.data.total}
          label="reviews"
          onPageChange={(next) => {
            setPage(next)
            scrollToSection('reviews')
          }}
        />
      </>
    )
  }

  return (
    <ProfileSection
      id="reviews"
      title="Reviews"
      description={creator.review_count > 0 ? 'From brands that ordered on House of Collabs.' : undefined}
      action={
        creator.review_count > 0 ? (
          <div className="flex items-center gap-2.5">
            <span className="font-display text-3xl font-semibold tabular-nums">{rating.toFixed(1)}</span>
            <div>
              <StarRating value={rating} />
              <p className="text-xs text-muted">{pluralize(creator.review_count, 'review')}</p>
            </div>
          </div>
        ) : undefined
      }
    >
      {body}
    </ProfileSection>
  )
}
