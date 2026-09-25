import * as React from 'react'
import { Link } from 'react-router'
import { Check, Heart, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useSavedCreators, useWishlistMutations, useWishlists } from '@/hooks/use-wishlists'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Wishlist heart. Brands pick one or more lists (default list pre-selected);
 * signed-out visitors are sent to sign up; creators don't see it.
 */
export function SaveButton({ creatorId, variant = 'overlay', className }: { creatorId: string; variant?: 'overlay' | 'button'; className?: string }) {
  const { role, session } = useAuth()
  const saved = useSavedCreators()
  const lists = useWishlists()
  const { toggle, create } = useWishlistMutations()
  const [newName, setNewName] = React.useState('')
  const inLists = saved.data?.[creatorId] ?? []
  const isSaved = inLists.length > 0

  const trigger =
    variant === 'overlay' ? (
      <button
        type="button"
        aria-label={isSaved ? 'Saved to wishlist' : 'Save to wishlist'}
        aria-pressed={isSaved}
        className={cn(
          'focus-ring flex size-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-card backdrop-blur-sm transition-transform hover:scale-105',
          className,
        )}
      >
        <Heart className={cn('size-4', isSaved && 'fill-ink')} />
      </button>
    ) : (
      <Button variant="secondary" className={className}>
        <Heart className={cn(isSaved && 'fill-ink')} /> {isSaved ? 'Saved' : 'Save'}
      </Button>
    )

  if (!session) {
    return (
      <Link to="/get-started?role=brand" onClick={(e) => e.stopPropagation()} aria-label="Sign up to save creators">
        {variant === 'overlay' ? (
          <span className={cn('flex size-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-card', className)}>
            <Heart className="size-4" />
          </span>
        ) : (
          <Button variant="secondary" className={className} asChild>
            <span>
              <Heart /> Save
            </span>
          </Button>
        )}
      </Link>
    )
  }
  if (role !== 'brand') return null

  return (
    <Popover>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 pt-1 pb-2 text-xs font-medium text-faint">Save to…</p>
        <ul className="max-h-56 overflow-y-auto">
          {(lists.data ?? []).map((l) => {
            const checked = inLists.includes(l.id)
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => toggle.mutate({ creatorId, wishlistId: l.id, save: !checked })}
                  className="flex w-full items-center gap-2.5 rounded-[0.6rem] px-2 py-2 text-left text-sm hover:bg-subtle"
                >
                  <span className={cn('flex size-4 items-center justify-center rounded-[0.3rem] border', checked ? 'border-ink bg-ink text-white' : 'border-line-strong')}>
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="text-xs text-faint">{l.wishlist_items.length}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <form
          className="mt-2 flex gap-1.5 border-t border-line pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            create.mutate(
              { name: newName.trim() },
              {
                onSuccess: (list) => {
                  setNewName('')
                  toggle.mutate({ creatorId, wishlistId: list.id, save: true })
                },
              },
            )
          }}
        >
          <Input inputSize="sm" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New list name" aria-label="New list name" maxLength={60} />
          <Button type="submit" size="icon-sm" variant="primary" aria-label="Create list" loading={create.isPending}>
            <Plus />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
