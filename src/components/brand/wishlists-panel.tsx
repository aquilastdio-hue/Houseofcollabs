import { Link } from 'react-router'
import { Heart } from 'lucide-react'
import { pluralize } from '@/lib/format'
import { useWishlists } from '@/hooks/use-wishlists'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { DashboardPanel, PanelRowsSkeleton } from './dashboard-panel'

const LIMIT = 3

/** Up to three saved-creator lists with counts and avatar stacks. */
export function WishlistsPanel({ className }: { className?: string }) {
  const lists = useWishlists()
  const items = (lists.data ?? []).slice(0, LIMIT)

  return (
    <DashboardPanel title="Wishlists" href="/brand/wishlists" className={className}>
      {lists.isPending ? (
        <PanelRowsSkeleton rows={LIMIT} />
      ) : lists.isError ? (
        <ErrorState compact error={lists.error} onRetry={() => void lists.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={<Heart />}
          title="No saved creators yet"
          description="Tap the heart on any creator to shortlist them for later."
          action={
            <Button asChild size="sm" variant="secondary">
              <Link to="/brand/creators">Browse creators</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((list) => {
            const creators = list.wishlist_items.map((i) => i.creator).filter((c) => !!c)
            return (
              <li key={list.id}>
                <Link
                  to="/brand/wishlists"
                  className="focus-ring flex items-center gap-3 rounded-control border border-line px-3 py-3 transition-colors hover:border-line-strong hover:bg-subtle/60"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-rose-soft text-rose">
                    <Heart className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{list.name}</span>
                    <span className="block text-xs text-muted">{pluralize(list.wishlist_items.length, 'creator')}</span>
                  </span>
                  {creators.length > 0 && (
                    <span className="flex shrink-0 -space-x-2" aria-hidden>
                      {creators.slice(0, 4).map((c) => (
                        <Avatar key={c.id} src={c.profile_image_url} name={c.display_name} size="sm" className="rounded-full ring-2 ring-surface" />
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </DashboardPanel>
  )
}
