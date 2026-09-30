import * as React from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
  dragging,
  over,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  creator: CreatorRanking
  rank: number
  dragging: boolean
  over: boolean
  onDragStart: () => void
  onDragEnter: () => void
  onDragEnd: () => void
}) {
  const pinned = !!creator.pinned_at

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
      draggable
      onDragStart={(e) => {
        // Firefox refuses to start a drag unless something is set.
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', creator.id)
        // The thing that follows the cursor is a clone of this row with the
        // rank stripped out.
        //
        // The browser's default preview is a snapshot taken at mousedown, so
        // it keeps showing the position the row started at while the real row
        // beneath already shows the new one — two different numbers for one
        // creator. Removing it entirely left nothing under the cursor, which
        // made the drag feel like it jumped between slots rather than moving.
        // A clone gives the smooth follow without the stale number.
        //
        // It has to be in the document for the browser to rasterise it, so it
        // is parked off-screen and removed on the next frame — by which point
        // the snapshot has been taken.
        const row = e.currentTarget
        const rect = row.getBoundingClientRect()
        const clone = row.cloneNode(true) as HTMLElement
        clone.querySelector('[data-rank]')?.remove()
        clone.style.position = 'fixed'
        clone.style.top = '-10000px'
        clone.style.left = '0'
        clone.style.width = `${rect.width}px`
        clone.classList.add('rounded-card', 'border', 'border-line', 'bg-surface', 'shadow-float')
        document.body.appendChild(clone)
        e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top)
        requestAnimationFrame(() => clone.remove())
        onDragStart()
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault()
        onDragEnd()
      }}
      className={cn(
        'flex flex-wrap items-center gap-4 px-4 py-3.5 transition-colors',
        pinned && 'bg-brand-soft/40',
        // The row being dragged keeps its full colour. Fading it made the
        // reordering hard to follow — the one row you are watching was the one
        // washed out, right when the list is rearranging underneath it. A ring
        // marks it instead, which reads as "this is the one you're holding"
        // without hiding it.
        dragging && 'ring-2 ring-brand ring-inset',
        over && !dragging && 'bg-subtle',
      )}
    >
      <span aria-hidden className="shrink-0 cursor-grab text-faint active:cursor-grabbing">
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
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [overId, setOverId] = React.useState<string | null>(null)

  const reorder = useAdminMutation((ids: string[]) => reorderCreators(ids), {
    invalidate: [rankingKey],
    success: () => 'Order saved',
  })

  const moveOver = (targetId: string) => {
    setOverId(targetId)
    if (!draggingId || draggingId === targetId) return
    setOrder((current) => {
      const list = [...(current ?? fetched)]
      const from = list.findIndex((c) => c.id === draggingId)
      const to = list.findIndex((c) => c.id === targetId)
      if (from < 0 || to < 0) return current
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
      return list
    })
  }

  const commit = () => {
    const moved = !!draggingId && !!order
    setDraggingId(null)
    setOverId(null)
    // Only write when something actually changed position.
    if (moved && order!.map((c) => c.id).join() !== fetched.map((c) => c.id).join()) {
      reorder.mutate(order!.map((c) => c.id))
    }
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
          <ul className="divide-y divide-line">
            {items.map((c, i) => (
              <Row
                key={c.id}
                creator={c}
                // While dragging, the position on screen is the truth; the
                // server-side rank only catches up after the save.
                rank={order ? i + 1 : c.rank_position}
                dragging={draggingId === c.id}
                over={overId === c.id}
                onDragStart={() => setDraggingId(c.id)}
                onDragEnter={() => moveOver(c.id)}
                onDragEnd={commit}
              />
            ))}
          </ul>
        </div>
      )}

      {total > PAGE_SIZE && (
        <Pagination className="mt-5" page={url.page} pageSize={PAGE_SIZE} total={total} onPageChange={url.setPage} label="creators" />
      )}
    </>
  )
}
