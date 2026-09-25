import * as React from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { BadgeCheck, Clock3, GitCompareArrows, MapPin, UserX, X } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { formatDays, formatINR, formatLocation } from '@/lib/format'
import { useCompare } from '@/contexts/compare-context'
import { useWishlistMutations } from '@/hooks/use-wishlists'
import type { WishlistWithItems } from '@/services/wishlists.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip } from '@/components/ui/tooltip'
import { SmartImage } from '@/components/shared/smart-image'
import { RatingLabel } from '@/components/shared/star-rating'

export type WishlistItem = WishlistWithItems['wishlist_items'][number]
export type WishlistCreator = NonNullable<WishlistItem['creator']>

// Mirrors the `wishlists` table: name 1–60 chars, description ≤ 300.
const listSchema = z.object({
  name: z.string().trim().min(1, 'Give your list a name.').max(60, 'Keep it under 60 characters.'),
  description: z.string().trim().max(300, 'Keep it under 300 characters.'),
})
type ListInput = z.input<typeof listSchema>
type ListOutput = z.output<typeof listSchema>

/** Create a new list, or rename/describe an existing one (pass `list`). */
export function WishlistFormDialog({
  open,
  onOpenChange,
  list,
  existingNames,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  list?: Pick<WishlistWithItems, 'id' | 'name' | 'description'> | null
  existingNames: string[]
  onCreated?: (id: string) => void
}) {
  const { create, rename } = useWishlistMutations()
  const form = useForm<ListInput, unknown, ListOutput>({ resolver: zodResolver(listSchema), defaultValues: { name: '', description: '' } })
  const { errors } = form.formState
  const description = form.watch('description') ?? ''
  const pending = create.isPending || rename.isPending

  React.useEffect(() => {
    if (open) form.reset({ name: list?.name ?? '', description: list?.description ?? '' })
  }, [open, list, form])

  const onSubmit = form.handleSubmit((values) => {
    const current = list?.name.toLowerCase()
    const taken = existingNames.some((n) => n.toLowerCase() === values.name.toLowerCase() && n.toLowerCase() !== current)
    if (taken) {
      form.setError('name', { message: 'You already have a list with this name.' })
      return
    }
    if (list) {
      rename.mutate(
        { id: list.id, name: values.name, description: values.description || null },
        {
          onSuccess: () => {
            toast.success('List updated')
            onOpenChange(false)
          },
        },
      )
    } else {
      create.mutate(
        { name: values.name, description: values.description || undefined },
        {
          onSuccess: (created) => {
            onOpenChange(false)
            onCreated?.(created.id)
          },
        },
      )
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent size="sm">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{list ? 'Edit list' : 'New list'}</DialogTitle>
            <DialogDescription>{list ? 'Rename the list or update its note.' : 'Group creators for a campaign, launch or season.'}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Name" htmlFor="wishlist-name" error={errors.name?.message}>
              <Input id="wishlist-name" placeholder="Diwali campaign" maxLength={60} autoComplete="off" {...form.register('name')} />
            </Field>
            <Field
              label="Description"
              htmlFor="wishlist-description"
              optional
              error={errors.description?.message}
              hint={`${description.length}/300 · e.g. “Beauty creators for the festive gifting reels”`}
            >
              <Textarea id="wishlist-description" rows={3} maxLength={300} {...form.register('description')} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {list ? 'Save changes' : 'Create list'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Compact saved-creator card; the whole card links to the profile. */
export function WishlistCreatorCard({ creator, onRemove, removing }: { creator: WishlistCreator; onRemove: () => void; removing?: boolean }) {
  const { has, toggle } = useCompare()
  const comparing = has(creator.id)
  const image = creator.profile_image_url ?? creator.cover_image_url

  return (
    <article className="group relative flex h-full gap-3.5 rounded-card border border-line bg-surface p-3 shadow-card transition-[box-shadow,border-color] duration-300 hover:border-line-strong hover:shadow-card-hover">
      <SmartImage
        src={image}
        alt=""
        className="size-22 shrink-0 rounded-control sm:size-24"
        imgClassName="transition-transform duration-700 ease-spring group-hover:scale-[1.04]"
        fallback={
          <div className="flex size-full items-center justify-center bg-brand-soft font-display text-xl font-semibold text-brand-ink">{initials(creator.display_name)}</div>
        }
      />
      <div className="min-w-0 flex-1 py-0.5">
        <h3 className="flex items-center gap-1 font-sans text-base font-semibold tracking-normal">
          <Link
            to={`/brand/creators/${creator.id}`}
            className="truncate rounded-md outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:shadow-glow focus-visible:after:outline-2 focus-visible:after:outline-ink"
          >
            {creator.display_name}
          </Link>
          {creator.verified && <BadgeCheck role="img" aria-label="Verified" className="size-4 shrink-0 fill-brand text-ink" />}
        </h3>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
          <MapPin className="size-3 shrink-0" aria-hidden /> {formatLocation(creator.city, creator.state)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <RatingLabel rating={Number(creator.rating)} count={creator.review_count} className="text-xs" />
          {creator.fastest_delivery_days != null && (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden />
              <span className="sr-only">Delivery from </span>
              {formatDays(creator.fastest_delivery_days)}
            </span>
          )}
          {!creator.available && (
            <Badge tone="neutral" size="sm">
              Busy
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm">
          <span className="text-muted">From </span>
          <span className="font-display font-semibold tabular-nums">{creator.starting_price != null ? formatINR(creator.starting_price) : '—'}</span>
        </p>
      </div>
      <div className="relative z-10 flex shrink-0 flex-col gap-1.5">
        <Tooltip content="Remove from list">
          <Button variant="ghost" size="icon-xs" aria-label={`Remove ${creator.display_name} from this list`} onClick={onRemove} disabled={removing}>
            <X />
          </Button>
        </Tooltip>
        <Tooltip content={comparing ? 'Remove from compare' : 'Add to compare'}>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-pressed={comparing}
            aria-label={comparing ? `Remove ${creator.display_name} from compare` : `Add ${creator.display_name} to compare`}
            onClick={() => toggle({ id: creator.id, name: creator.display_name, image: creator.profile_image_url })}
            className={cn(comparing && 'bg-brand hover:bg-brand-strong')}
          >
            <GitCompareArrows />
          </Button>
        </Tooltip>
      </div>
    </article>
  )
}

/** Saved creator whose storefront is no longer public (RLS returns `creator: null`). */
export function UnavailableCreatorCard({ onRemove, removing }: { onRemove: () => void; removing?: boolean }) {
  return (
    <article className="flex h-full items-center gap-3.5 rounded-card border border-dashed border-line-strong bg-subtle/60 p-3">
      <span className="flex size-22 shrink-0 items-center justify-center rounded-control bg-muted-surface text-faint sm:size-24">
        <UserX className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-sans text-sm font-semibold tracking-normal text-ink-soft">Creator no longer available</h3>
        <p className="mt-0.5 text-xs text-muted">This profile was unpublished or removed.</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRemove} loading={removing}>
        Remove
      </Button>
    </article>
  )
}
