import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { Ellipsis, FolderHeart, Heart, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn, range } from '@/lib/utils'
import { pluralize } from '@/lib/format'
import { useWishlistMutations, useWishlists } from '@/hooks/use-wishlists'
import type { WishlistWithItems } from '@/services/wishlists.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { UnavailableCreatorCard, WishlistCreatorCard, WishlistFormDialog } from '@/components/marketplace/wishlist-parts'

type ListRef = Pick<WishlistWithItems, 'id' | 'name' | 'description'>

export default function Wishlists() {
  const lists = useWishlists()
  const { toggle, remove } = useWishlistMutations()
  const [searchParams, setSearchParams] = useSearchParams()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ListRef | null>(null)
  const [deleting, setDeleting] = React.useState<ListRef | null>(null)

  const data = lists.data ?? []
  const selected = data.find((l) => l.id === searchParams.get('list')) ?? data[0] ?? null
  const names = data.map((l) => l.name)

  const select = (id: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('list', id)
        return next
      },
      { replace: true },
    )

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  let content: React.ReactNode
  if (lists.isPending) {
    content = <WishlistsSkeleton />
  } else if (lists.isError) {
    content = <ErrorState error={lists.error} title="We couldn’t load your wishlists" onRetry={() => void lists.refetch()} />
  } else if (!selected) {
    content = (
      <EmptyState
        icon={<FolderHeart />}
        title="No lists yet"
        description="Create a list for each campaign and save creators to it from the marketplace."
        action={
          <Button onClick={openCreate}>
            <Plus /> New list
          </Button>
        }
      />
    )
  } else {
    const items = selected.wishlist_items
    const isRemoving = (creatorId: string) =>
      toggle.isPending && toggle.variables?.creatorId === creatorId && toggle.variables.wishlistId === selected.id
    const removeItem = (creatorId: string) => toggle.mutate({ creatorId, wishlistId: selected.id, save: false })

    content = (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* List selector: pills on mobile, sidebar on desktop */}
        <nav aria-label="Your lists" className="-mx-gutter lg:hidden">
          <ul className="no-scrollbar flex gap-2 overflow-x-auto px-gutter pb-1">
            {data.map((l) => {
              const active = l.id === selected.id
              return (
                <li key={l.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => select(l.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'focus-ring inline-flex h-9 items-center gap-2 rounded-pill border px-3.5 text-sm font-medium transition-colors',
                      active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                    )}
                  >
                    <span className="max-w-[12rem] truncate">{l.name}</span>
                    <span className={cn('text-xs tabular-nums', active ? 'text-brand' : 'text-muted')}>{l.wishlist_items.length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <nav aria-label="Your lists" className="hidden rounded-card border border-line bg-surface p-2 shadow-card lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:block">
          <ul className="space-y-0.5">
            {data.map((l) => {
              const active = l.id === selected.id
              const Icon = l.is_default ? Heart : FolderHeart
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => select(l.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'focus-ring flex w-full items-center gap-2.5 rounded-control px-3 py-2.5 text-left text-sm font-medium transition-colors',
                      active ? 'bg-ink text-white' : 'text-ink-soft hover:bg-subtle hover:text-ink',
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', active ? 'text-brand' : 'text-muted')} aria-hidden />
                    <span className="flex-1 truncate">{l.name}</span>
                    <span className={cn('rounded-pill px-2 text-xs tabular-nums', active ? 'bg-white/15 text-white' : 'bg-subtle text-muted')}>
                      {l.wishlist_items.length}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 border-t border-line pt-2">
            <Button variant="ghost" size="sm" block className="justify-start" onClick={openCreate}>
              <Plus /> New list
            </Button>
          </div>
        </nav>

        <section aria-labelledby="wishlist-heading" className="min-w-0">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="wishlist-heading" className="font-display text-display-sm font-semibold break-words">
                  {selected.name}
                </h2>
                {selected.is_default && <Badge tone="brand-soft">Default</Badge>}
              </div>
              {selected.description && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{selected.description}</p>}
              <p className="mt-1 text-sm text-muted">{pluralize(items.length, 'creator')}</p>
            </div>
            {!selected.is_default && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Options for ${selected.name}`}>
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(selected)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil /> Edit list
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => setDeleting(selected)}>
                    <Trash2 /> Delete list
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={<Heart />}
              title="Your wishlist is empty."
              description="Tap the heart on any creator card or profile to save them to this list."
              action={
                <Button asChild>
                  <Link to="/brand/creators">Find creators</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {items.map((item) => (
                <li key={item.id}>
                  {item.creator ? (
                    <WishlistCreatorCard creator={item.creator} onRemove={() => removeItem(item.creator_id)} removing={isRemoving(item.creator_id)} />
                  ) : (
                    <UnavailableCreatorCard onRemove={() => removeItem(item.creator_id)} removing={isRemoving(item.creator_id)} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="pb-24">
      <Seo title="Wishlists" noindex />
      <PageHeader
        title="Wishlists"
        description="Shortlist creators for each campaign, then compare and hire when you’re ready."
        actions={
          <Button onClick={openCreate}>
            <Plus /> New list
          </Button>
        }
      />
      {content}

      <WishlistFormDialog open={formOpen} onOpenChange={setFormOpen} list={editing} existingNames={names} onCreated={select} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="The list and its saved creators will be removed. The creators stay on House of Collabs and in your other lists."
        confirmLabel="Delete list"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null)
              const fallback = data.find((l) => l.is_default && l.id !== deleting.id) ?? data.find((l) => l.id !== deleting.id)
              if (fallback) select(fallback.id)
            },
          })
        }}
      />
    </div>
  )
}

function WishlistsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8" aria-busy>
      <p role="status" className="sr-only">
        Loading wishlists…
      </p>
      <div className="flex gap-2 lg:hidden">
        {range(3).map((i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-pill" />
        ))}
      </div>
      <div className="hidden space-y-2 rounded-card border border-line bg-surface p-2 lg:block">
        {range(4).map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {range(6).map((i) => (
            <Skeleton key={i} className="h-30 rounded-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
