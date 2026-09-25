import * as React from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Archive, Eye, EyeOff, Images, Mail, MailOpen, MessageSquareQuote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format'
import {
  listContactMessages,
  listPortfolioItems,
  listReviews,
  moderateReview,
  updateContactMessage,
} from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { StarRating } from '@/components/shared/star-rating'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterBar, FilterField } from '@/components/admin/filter-bar'
import { CONTACT_STATUS_META, REVIEW_STATUS_META, StatusBadge, metaOptions } from '@/components/admin/admin-status'
import { PortfolioModerationGrid, type ModerationItem } from '@/components/admin/portfolio-moderation'
import { adminLists } from '@/components/admin/admin-keys'
import { useAdminMutation } from '@/components/admin/use-admin-mutation'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'

const REVIEW_PAGE_SIZE = 20
const PORTFOLIO_PAGE_SIZE = 24
const CONTACT_PAGE_SIZE = 20

const TABS = ['reviews', 'portfolio', 'contact'] as const
type Tab = (typeof TABS)[number]

const REVIEW_STATUS_OPTIONS = metaOptions(REVIEW_STATUS_META)
const REVIEW_STATUS_VALUES = REVIEW_STATUS_OPTIONS.map((o) => o.value)
const CONTACT_STATUS_OPTIONS = metaOptions(CONTACT_STATUS_META)
const CONTACT_STATUS_VALUES = CONTACT_STATUS_OPTIONS.map((o) => o.value)
const VISIBILITY_OPTIONS = [
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
]

function ListSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-card" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
type ReviewRow = Awaited<ReturnType<typeof listReviews>>['items'][number]

function ReviewsTab() {
  const url = useUrlState()
  const raw = url.get('review_status')
  const status: 'published' | 'hidden' | '' = isOneOf(REVIEW_STATUS_VALUES, raw) ? raw : ''
  const [pending, setPending] = React.useState<ReviewRow | null>(null)

  const params = { status, page: url.page, pageSize: REVIEW_PAGE_SIZE }
  const query = useQuery({
    queryKey: qk.admin.content({ kind: 'reviews', ...params }),
    queryFn: () => listReviews(params),
    placeholderData: keepPreviousData,
  })

  const moderate = useAdminMutation(({ id, next }: { id: string; next: 'published' | 'hidden' }) => moderateReview(id, next), {
    invalidate: [adminLists.content, qk.creators.all],
    success: (_d, v) => (v.next === 'hidden' ? 'Review hidden' : 'Review published again'),
    onSuccess: () => setPending(null),
  })

  if (query.isError) return <ErrorState error={query.error} title="Couldn’t load reviews" onRetry={() => void query.refetch()} />

  const nextStatus = pending?.status === 'hidden' ? 'published' : 'hidden'

  return (
    <div className="space-y-5">
      <FilterBar activeCount={status ? 1 : 0} onReset={() => url.update({ review_status: null })}>
        <FilterField label="Status" htmlFor="review-status">
          <Select
            id="review-status"
            size="sm"
            value={status}
            onValueChange={(v) => url.update({ review_status: v })}
            options={REVIEW_STATUS_OPTIONS}
            anyLabel="All reviews"
          />
        </FilterField>
      </FilterBar>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuote />}
          title={status ? `No ${status} reviews` : 'No reviews yet'}
          description={status ? 'Try the other status.' : 'Reviews appear here once brands rate completed orders.'}
        />
      ) : (
        <div className={cn('space-y-3', query.isPlaceholderData && 'opacity-60 transition-opacity')}>
          {query.data.items.map((review) => (
            <Card key={review.id} className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating value={review.rating} />
                    <StatusBadge meta={REVIEW_STATUS_META} value={review.status === 'hidden' ? 'hidden' : 'published'} size="sm" />
                    <span className="text-xs text-muted">{formatRelative(review.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted">
                    {review.brand ? <span className="font-medium text-ink">{review.brand.brand_name}</span> : 'A brand'} reviewed{' '}
                    {review.creator ? (
                      <Link to={`/admin/creators/${review.creator.id}`} className="focus-ring rounded-sm font-medium text-ink hover:underline">
                        {review.creator.display_name}
                      </Link>
                    ) : (
                      'a creator'
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button asChild variant="ghost" size="xs">
                    <Link to={`/admin/orders/${review.order_id}`}>View order</Link>
                  </Button>
                  <Button
                    variant={review.status === 'hidden' ? 'secondary' : 'ghost'}
                    size="xs"
                    onClick={() => setPending(review)}
                    aria-label={`${review.status === 'hidden' ? 'Publish' : 'Hide'} review`}
                  >
                    {review.status === 'hidden' ? <Eye /> : <EyeOff />}
                    {review.status === 'hidden' ? 'Publish' : 'Hide'}
                  </Button>
                </div>
              </div>
              {review.comment && <p className="text-sm whitespace-pre-wrap text-ink-soft">{review.comment}</p>}
              {review.response && (
                <div className="rounded-control border-l-2 border-line bg-subtle px-4 py-3">
                  <p className="mb-1 text-xs font-medium text-muted">Creator’s reply</p>
                  <p className="text-sm whitespace-pre-wrap text-ink-soft">{review.response}</p>
                </div>
              )}
            </Card>
          ))}
          <Pagination page={url.page} pageSize={REVIEW_PAGE_SIZE} total={query.data.total} onPageChange={url.setPage} label="reviews" />
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={nextStatus === 'hidden' ? 'Hide this review?' : 'Publish this review again?'}
        description={
          nextStatus === 'hidden'
            ? 'It stops showing on the creator’s storefront and stops counting toward their rating.'
            : 'It goes back on the creator’s storefront and counts toward their rating again.'
        }
        confirmLabel={nextStatus === 'hidden' ? 'Hide review' : 'Publish review'}
        destructive={nextStatus === 'hidden'}
        loading={moderate.isPending}
        onConfirm={() => {
          if (pending) moderate.mutate({ id: pending.id, next: nextStatus })
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------
function PortfolioTab() {
  const url = useUrlState()
  const raw = url.get('visibility')
  const visibility = raw === 'hidden' || raw === 'visible' ? raw : ''
  const hidden = visibility === '' ? undefined : visibility === 'hidden'

  const params = { hidden, page: url.page, pageSize: PORTFOLIO_PAGE_SIZE }
  const query = useQuery({
    queryKey: qk.admin.content({ kind: 'portfolio', ...params }),
    queryFn: () => listPortfolioItems(params),
    placeholderData: keepPreviousData,
  })

  if (query.isError) return <ErrorState error={query.error} title="Couldn’t load portfolio items" onRetry={() => void query.refetch()} />

  return (
    <div className="space-y-5">
      <FilterBar activeCount={visibility ? 1 : 0} onReset={() => url.update({ visibility: null })}>
        <FilterField label="Visibility" htmlFor="portfolio-visibility">
          <Select
            id="portfolio-visibility"
            size="sm"
            value={visibility}
            onValueChange={(v) => url.update({ visibility: v })}
            options={VISIBILITY_OPTIONS}
            anyLabel="Everything"
          />
        </FilterField>
      </FilterBar>

      {query.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-4/5 rounded-card" />
          ))}
        </div>
      ) : (
        <div className={cn('space-y-5', query.isPlaceholderData && 'opacity-60 transition-opacity')}>
          <PortfolioModerationGrid
            items={query.data.items as ModerationItem[]}
            showCreator
            emptyTitle={visibility === 'hidden' ? 'Nothing is hidden' : 'No portfolio items yet'}
            emptyDescription={
              visibility === 'hidden'
                ? 'Items you hide from a storefront will collect here.'
                : 'Creators’ portfolio pieces show up here for moderation as they upload them.'
            }
          />
          {query.data.total > 0 && (
            <Pagination page={url.page} pageSize={PORTFOLIO_PAGE_SIZE} total={query.data.total} onPageChange={url.setPage} label="items" />
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contact messages
// ---------------------------------------------------------------------------
function ContactTab() {
  const url = useUrlState()
  const raw = url.get('contact_status')
  const status: 'new' | 'read' | 'archived' | '' = isOneOf(CONTACT_STATUS_VALUES, raw) ? raw : ''

  const params = { status, page: url.page, pageSize: CONTACT_PAGE_SIZE }
  const query = useQuery({
    queryKey: qk.admin.contact(params),
    queryFn: () => listContactMessages(params),
    placeholderData: keepPreviousData,
  })

  const update = useAdminMutation(({ id, next }: { id: string; next: 'new' | 'read' | 'archived' }) => updateContactMessage(id, next), {
    invalidate: [adminLists.contact, adminLists.content],
    success: (_d, v) => (v.next === 'archived' ? 'Message archived' : v.next === 'read' ? 'Marked as read' : 'Marked as unread'),
  })

  if (query.isError) return <ErrorState error={query.error} title="Couldn’t load messages" onRetry={() => void query.refetch()} />

  return (
    <div className="space-y-5">
      <FilterBar activeCount={status ? 1 : 0} onReset={() => url.update({ contact_status: null })}>
        <FilterField label="Status" htmlFor="contact-status">
          <Select
            id="contact-status"
            size="sm"
            value={status}
            onValueChange={(v) => url.update({ contact_status: v })}
            options={CONTACT_STATUS_OPTIONS}
            anyLabel="All messages"
          />
        </FilterField>
      </FilterBar>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<Mail />}
          title={status ? `No ${status} messages` : 'No messages yet'}
          description={status ? 'Try another status.' : 'Messages sent from the public contact form land here.'}
        />
      ) : (
        <div className={cn('space-y-3', query.isPlaceholderData && 'opacity-60 transition-opacity')}>
          {query.data.items.map((m) => {
            const statusValue = m.status === 'read' ? 'read' : m.status === 'archived' ? 'archived' : 'new'
            return (
              <Card key={m.id} className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{m.name}</p>
                      <StatusBadge meta={CONTACT_STATUS_META} value={statusValue} size="sm" />
                      {m.topic && (
                        <Badge tone="outline" size="sm">
                          {m.topic}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      <a href={`mailto:${m.email}`} className="focus-ring rounded-sm hover:underline">
                        {m.email}
                      </a>
                      {m.company && <> · {m.company}</>} · {formatDateTime(m.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {m.status !== 'archived' && (
                      <Button
                        variant="ghost"
                        size="xs"
                        loading={update.isPending && update.variables?.id === m.id}
                        onClick={() => update.mutate({ id: m.id, next: m.status === 'read' ? 'new' : 'read' })}
                      >
                        {m.status === 'read' ? <Mail /> : <MailOpen />}
                        {m.status === 'read' ? 'Mark unread' : 'Mark read'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      loading={update.isPending && update.variables?.id === m.id}
                      onClick={() => update.mutate({ id: m.id, next: m.status === 'archived' ? 'read' : 'archived' })}
                    >
                      <Archive />
                      {m.status === 'archived' ? 'Restore' : 'Archive'}
                    </Button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap text-ink-soft">{m.message}</p>
              </Card>
            )
          })}
          <Pagination page={url.page} pageSize={CONTACT_PAGE_SIZE} total={query.data.total} onPageChange={url.setPage} label="messages" />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
export default function Content() {
  const url = useUrlState()
  const raw = url.get('tab')
  const tab: Tab = isOneOf(TABS, raw) ? raw : 'reviews'

  // Counts for the tab labels — cheap head requests, one page each.
  const pendingContact = useQuery({
    queryKey: qk.admin.contact({ status: 'new', page: 1, pageSize: 1 }),
    queryFn: () => listContactMessages({ status: 'new', page: 1, pageSize: 1 }),
  })
  const hiddenPortfolio = useQuery({
    queryKey: qk.admin.content({ kind: 'portfolio', hidden: true, page: 1, pageSize: 1 }),
    queryFn: () => listPortfolioItems({ hidden: true, page: 1, pageSize: 1 }),
  })

  return (
    <>
      <Seo title="Content moderation" noindex />
      <PageHeader
        eyebrow="Trust & safety"
        title="Content"
        description="Reviews, portfolio pieces and messages from the contact form. Hiding content never deletes it — the creator keeps their copy and every action is audited."
      />

      <Tabs value={tab} onValueChange={(v) => url.update({ tab: v === 'reviews' ? null : v })}>
        <TabsList className="mb-5" variant="underline">
          <TabsTrigger value="reviews">
            <MessageSquareQuote /> Reviews
          </TabsTrigger>
          <TabsTrigger value="portfolio">
            <Images /> Portfolio
            {!!hiddenPortfolio.data?.total && (
              <Badge tone="neutral" size="sm">
                {formatNumber(hiddenPortfolio.data.total)} hidden
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contact">
            <Mail /> Contact
            {!!pendingContact.data?.total && (
              <Badge tone="brand" size="sm">
                {formatNumber(pendingContact.data.total)}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Each tab owns its own URL params, so remount on switch to reset paging. */}
        <TabsContent value="reviews">{tab === 'reviews' && <ReviewsTab />}</TabsContent>
        <TabsContent value="portfolio">{tab === 'portfolio' && <PortfolioTab />}</TabsContent>
        <TabsContent value="contact">{tab === 'contact' && <ContactTab />}</TabsContent>
      </Tabs>
    </>
  )
}
