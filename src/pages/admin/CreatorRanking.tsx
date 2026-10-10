import * as React from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpToLine, ExternalLink, GripVertical, MoreHorizontal, Pin, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatNumber } from '@/lib/format'
import { listCreatorRankings, pinCreator, reorderCreators, setCreatorRating, type CreatorRanking } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/states'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Pagination } from '@/components/shared/pagination'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { CREATOR_STATUS_META, metaOptions } from '@/components/admin/admin-status'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'
import { useAdminMutation } from '@/components/admin/use-admin-mutation'
import { RatingStars } from '@/components/admin/rating-stars'
import type { CreatorStatus } from '@/types'

const PAGE_SIZE = 50
const STATUS_OPTIONS = metaOptions(CREATOR_STATUS_META)
const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value)
const rankingKey = [...qk.admin.all, 'creator-ranking'] as const


function Row({
  creator,
  rank,
}: {
  creator: CreatorRanking
  rank: number
}) {
  const pinned = !!creator.pinned_at
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: creator.id })

  const rate = useAdminMutation((rating: number | null) => setCreatorRating(creator.id, rating), {
    invalidate: [rankingKey],
    success: (_d, rating) => (rating ? `Rated ${rating}/5` : 'Rating cleared'),
  })

  const pin = useAdminMutation((next: boolean) => pinCreator(creator.id, next), {
    invalidate: [rankingKey],
    success: (_d, next) => (next ? 'Sent to the top' : 'Removed from the top'),
  })

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="listitem"
      aria-label={`Reorder ${creator.display_name}`}
      style={{
        transform: transform ? CSS.Transform.toString({ ...transform, x: 0 }) : undefined,
        transition,
      }}
      className={cn(
        'flex flex-wrap items-center gap-4 px-4 py-3.5 cursor-grab active:cursor-grabbing transition-colors',
        pinned && 'bg-brand-soft/40',
        isDragging && 'relative z-10 ring-2 ring-brand ring-inset shadow-float',
      )}
    >
      <span aria-hidden className="shrink-0 text-faint">
        <GripVertical className="size-4" />
      </span>
      <span data-rank className="w-8 shrink-0 text-sm font-semibold text-muted tabular-nums">
        {rank}
      </span>

      <Avatar src={creator.profile_image_url} name={creator.display_name} className="size-10 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/creators/${creator.slug}`} className="truncate font-medium text-ink hover:underline">
            {creator.display_name}
          </Link>
          {pinned && (
            <Badge tone="brand" className="gap-1">
              <Pin className="size-3" aria-hidden /> On top
            </Badge>
          )}
          {creator.status !== 'published' && <Badge tone="neutral">{CREATOR_STATUS_META[creator.status]?.label ?? creator.status}</Badge>}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {[creator.city, `${formatNumber(creator.followers_count)} followers`].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="shrink-0">
        <RatingStars value={creator.admin_rating} onChange={(r) => rate.mutate(r)} disabled={rate.isPending} size="sm" />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More for ${creator.display_name}`} loading={pin.isPending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => pin.mutate(!pinned)}>
            <ArrowUpToLine /> {pinned ? 'Remove from top' : 'Send on top'}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={`/admin/creators/${creator.id}`}>
              <Sparkles /> Open profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={`/creators/${creator.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink /> View storefront
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

export default function CreatorRankingPage() {
  const url = useUrlState()
  const search = url.get('q')
  const rawStatus = url.get('status')
  const status: CreatorStatus | '' = isOneOf(STATUS_VALUES, rawStatus) ? rawStatus : ''
  const filtered = !!search || !!status

  const query = useQuery({
    queryKey: [...rankingKey, { search, status, page: url.page }],
    queryFn: () => listCreatorRankings({ search, status, page: url.page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const fetched = query.data?.items ?? []
  const total = query.data?.total ?? 0

  // Dragging reorders a local copy so rows move under the cursor; the order is
  // only sent once the drag ends. Reset whenever the server sends a new list,
  // so a rating change or a filter never leaves a stale hand-made order on
  // screen. Keyed on ids rather than a boolean, because the list can change
  // length while a drag is not in progress.
  const [order, setOrder] = React.useState<CreatorRanking[] | null>(null)
  const fetchedKey = fetched.map((c) => c.id).join()
  React.useEffect(() => setOrder(null), [fetchedKey])

  const items = order ?? fetched
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const reorder = useAdminMutation((ids: string[]) => reorderCreators(ids), {
    invalidate: [rankingKey],
    success: () => 'Order saved',
  })

  const commit = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = items.findIndex((creator) => creator.id === active.id)
    const to = items.findIndex((creator) => creator.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(items, from, to)
    setOrder(next)
    reorder.mutate(next.map((creator) => creator.id))
  }

  return (
    <>
      <Seo title="Creator ranking" noindex />
      <PageHeader
        title="Creator ranking"
        description="The order creators appear in on the public creators page. Highest rated first, and anything sent to the top leads outright. Ratings are only ever visible here — never to the creator or to brands."
      />

      <FilterBar
        activeCount={(search ? 1 : 0) + (status ? 1 : 0)}
        onReset={() => url.update({ q: null, status: null })}
        search={<SearchInput value={search} onCommit={(q) => url.update({ q })} placeholder="Search name or city" label="Search creators" />}
      >
        <FilterField label="Status" htmlFor="ranking-status">
          <Select
            id="ranking-status"
            size="sm"
            value={status}
            onValueChange={(v) => url.update({ status: v })}
            options={STATUS_OPTIONS}
            anyLabel="All statuses"
          />
        </FilterField>
      </FilterBar>

      {items.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title="No creators here"
          description={filtered ? 'Try a different search or clear the filters.' : 'Creators appear here once they are approved.'}
        />
      ) : (
        <div className="rounded-panel border border-line bg-surface">
          <p className="border-b border-line px-4 py-2.5 text-sm text-muted">
            {formatNumber(total)} creator{total === 1 ? '' : 's'} · showing the live order · drag a row to place it by hand
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={commit}>
            <SortableContext items={items.map((creator) => creator.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-line">
                {items.map((c, i) => (
                  <Row key={c.id} creator={c} rank={order ? i + 1 : c.rank_position} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {total > PAGE_SIZE && (
        <Pagination className="mt-5" page={url.page} pageSize={PAGE_SIZE} total={total} onPageChange={url.setPage} label="creators" />
      )}
    </>
  )
}
