import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, EllipsisVertical, ExternalLink, EyeOff, Images, Link2, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { AppError } from '@/lib/errors'
import { PLATFORMS } from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'
import { useCategories } from '@/hooks/use-catalog'
import type { CreatorProfile } from '@/services/creators.service'
import {
  createPortfolioItem,
  deletePortfolioItem,
  reorderPortfolio,
  updatePortfolioItem,
  uploadPortfolioMedia,
  type PortfolioInput,
} from '@/services/portfolio.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { FileUploader } from '@/components/shared/file-uploader'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { MediaTile } from '@/components/creator/portfolio-grid'
import type { PortfolioItem } from '@/types'
import {
  portfolioDetailsSchema,
  portfolioLinkSchema,
  type PortfolioDetailsInput,
  type PortfolioDetailsOutput,
  type PortfolioLinkInput,
  type PortfolioLinkOutput,
} from './schemas'
import { StudioSection } from './parts'
import { useMyPortfolio, useStudioSync } from './use-studio'

const RECOMMENDED_ITEMS = 3
const TYPE_LABEL: Record<PortfolioItem['type'], string> = { image: 'Photo', video: 'Video', link: 'Link' }

function detectPlatform(url: string) {
  const u = url.toLowerCase()
  if (u.includes('instagram.com')) return 'instagram'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('threads.com') || u.includes('threads.net')) return 'threads'
  if (/(^|\/\/|\.)x\.com/.test(u) || u.includes('twitter.com')) return 'x'
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook'
  return ''
}

function MediaPreview({ item }: { item: PortfolioItem }) {
  if (item.type === 'video') {
    return (
      <video
        src={item.media_url}
        poster={item.thumbnail_url ?? undefined}
        controls
        playsInline
        preload="metadata"
        className="max-h-72 w-full rounded-control bg-night"
      />
    )
  }
  if (item.type === 'image') {
    return <img src={item.media_url} alt={item.title ?? 'Portfolio image'} className="max-h-72 w-full rounded-control bg-subtle object-contain" />
  }
  return (
    <a
      href={item.media_url}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-ring flex items-center gap-3 rounded-control border border-line bg-subtle p-3 text-sm hover:border-line-strong"
    >
      <Link2 className="size-4 shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{item.media_url}</span>
      <ExternalLink className="size-4 shrink-0 text-muted" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

function PortfolioItemForm({ item, onDone }: { item: PortfolioItem; onDone: () => void }) {
  const sync = useStudioSync()
  const categories = useCategories()
  const form = useForm<PortfolioDetailsInput, unknown, PortfolioDetailsOutput>({
    resolver: zodResolver(portfolioDetailsSchema),
    defaultValues: {
      title: item.title ?? '',
      description: item.description ?? '',
      brand_name: item.brand_name ?? '',
      category_id: item.category_id ?? '',
      platform: item.platform ?? '',
    },
  })
  const { errors, isSubmitting } = form.formState

  const save = useMutation({
    mutationFn: async (values: PortfolioDetailsOutput) => {
      const row = await updatePortfolioItem(item.id, {
        title: values.title || null,
        description: values.description || null,
        brand_name: values.brand_name || null,
        category_id: values.category_id || null,
        platform: values.platform,
      })
      await sync(qk.portfolio.mine)
      return row
    },
    meta: { successMessage: 'Details saved' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
      onDone()
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  const categoryOptions = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Edit details</DialogTitle>
        <DialogDescription>A title and the brand it was made for help brands understand your work.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <MediaPreview item={item} />
        {item.is_hidden && (
          <p className="flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
            Our moderation team hid this item, so it isn’t shown on your storefront.
          </p>
        )}
        <Field label="Title" htmlFor="portfolio-title" optional error={errors.title?.message}>
          <Input id="portfolio-title" maxLength={120} placeholder="e.g. Summer skincare routine reel" {...form.register('title')} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Made for" htmlFor="portfolio-brand" optional hint="The brand this was created for." error={errors.brand_name?.message}>
            <Input id="portfolio-brand" maxLength={80} placeholder="Brand name" {...form.register('brand_name')} />
          </Field>
          <Field label="Category" htmlFor="portfolio-category" optional error={errors.category_id?.message}>
            <Controller
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <Select
                  id="portfolio-category"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={categoryOptions}
                  anyLabel="No category"
                  disabled={categories.isPending}
                />
              )}
            />
          </Field>
        </div>
        <Field label="Platform" htmlFor="portfolio-platform" optional error={errors.platform?.message}>
          <Controller
            control={form.control}
            name="platform"
            render={({ field }) => (
              <Select id="portfolio-platform" value={field.value} onValueChange={field.onChange} options={PLATFORMS} anyLabel="Not specified" />
            )}
          />
        </Field>
        <Field label="Description" htmlFor="portfolio-description" optional error={errors.description?.message}>
          <Textarea id="portfolio-description" rows={3} maxLength={1000} placeholder="The brief, your idea and the results." {...form.register('description')} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Save details
        </Button>
      </DialogFooter>
    </form>
  )
}

function PortfolioLinkForm({ onCreate, onDone }: { onCreate: (values: PortfolioLinkOutput) => Promise<unknown>; onDone: () => void }) {
  const form = useForm<PortfolioLinkInput, unknown, PortfolioLinkOutput>({
    resolver: zodResolver(portfolioLinkSchema),
    defaultValues: { url: '', title: '', brand_name: '', platform: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await onCreate(values)
      toast.success('Link added to your portfolio')
      onDone()
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Add a link</DialogTitle>
        <DialogDescription>Link to a post or video you’re proud of, like an Instagram reel or a YouTube video.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <Field label="Link" htmlFor="link-url" required error={errors.url?.message}>
          <Input
            id="link-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://www.instagram.com/reel/…"
            {...form.register('url', {
              onBlur: () => {
                if (form.getValues('platform')) return
                const detected = detectPlatform(form.getValues('url'))
                if (detected) form.setValue('platform', detected, { shouldDirty: true })
              },
            })}
          />
        </Field>
        <Field label="Title" htmlFor="link-title" optional error={errors.title?.message}>
          <Input id="link-title" maxLength={120} placeholder="e.g. Festive haul for a D2C fashion label" {...form.register('title')} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Platform" htmlFor="link-platform" optional error={errors.platform?.message}>
            <Controller
              control={form.control}
              name="platform"
              render={({ field }) => (
                <Select id="link-platform" value={field.value} onValueChange={field.onChange} options={PLATFORMS} anyLabel="Not specified" />
              )}
            />
          </Field>
          <Field label="Made for" htmlFor="link-brand" optional error={errors.brand_name?.message}>
            <Input id="link-brand" maxLength={80} placeholder="Brand name" {...form.register('brand_name')} />
          </Field>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Add link
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Upload / link / edit / reorder / delete portfolio pieces. Items hidden by
 * moderation stay visible here with a badge.
 */
export function PortfolioManager({
  creator,
  title = 'Portfolio',
  description = 'Upload your best photos and videos, or link to posts on Instagram and YouTube.',
  className,
}: {
  creator: CreatorProfile
  title?: string
  description?: string
  className?: string
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const sync = useStudioSync()
  const portfolio = useMyPortfolio(creator.id)
  const items = React.useMemo(() => portfolio.data ?? [], [portfolio.data])
  const uploaderRef = React.useRef<HTMLDivElement>(null)
  const sortRef = React.useRef(0)
  const [linkOpen, setLinkOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PortfolioItem | null>(null)
  const [deleting, setDeleting] = React.useState<PortfolioItem | null>(null)

  const requireUserId = () => {
    if (!user) throw new AppError('Your session expired. Please sign in again.', { kind: 'auth', code: 'AUTH_REQUIRED' })
    return user.id
  }

  /** Appends new items after the current last one (uploads can finish in a batch). */
  const nextSortOrder = () => {
    const base = items.reduce((max, i) => Math.max(max, i.sort_order + 1), items.length)
    const next = Math.max(base, sortRef.current)
    sortRef.current = next + 1
    return next
  }

  const create = useMutation({
    mutationFn: async (input: PortfolioInput) => {
      const row = await createPortfolioItem(creator.id, input)
      await sync(qk.portfolio.mine)
      return row
    },
  })

  const reorder = useMutation({
    mutationFn: (order: { id: string; sort_order: number }[]) => reorderPortfolio(order),
    onMutate: async (order) => {
      await qc.cancelQueries({ queryKey: qk.portfolio.mine })
      const previous = qc.getQueryData<PortfolioItem[]>(qk.portfolio.mine)
      const next = new Map(order.map((o) => [o.id, o.sort_order]))
      qc.setQueryData<PortfolioItem[]>(qk.portfolio.mine, (old) =>
        old?.map((i) => ({ ...i, sort_order: next.get(i.id) ?? i.sort_order })).sort((a, b) => a.sort_order - b.sort_order),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(qk.portfolio.mine, context.previous)
    },
    onSettled: () => sync(qk.portfolio.mine),
  })

  const remove = useMutation({
    mutationFn: async (item: PortfolioItem) => {
      await deletePortfolioItem(item)
      await sync(qk.portfolio.mine)
    },
    meta: { successMessage: 'Removed from your portfolio' },
  })

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(target, 0, moved)
    const order = next.map((item, i) => ({ id: item.id, sort_order: i, before: item.sort_order })).filter((o) => o.before !== o.sort_order)
    reorder.mutate(order.map(({ id, sort_order }) => ({ id, sort_order })))
  }

  const openFilePicker = () => {
    uploaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    uploaderRef.current?.querySelector<HTMLButtonElement>('button')?.click()
  }

  const visibleCount = items.filter((i) => !i.is_hidden).length

  return (
    <StudioSection
      className={className}
      title={title}
      description={description}
      action={
        <Button type="button" variant="secondary" size="sm" onClick={() => setLinkOpen(true)}>
          <Link2 /> Add link
        </Button>
      }
    >
      <div ref={uploaderRef}>
        <FileUploader
          bucket="creator-portfolio"
          kinds={['image', 'video']}
          maxFiles={10}
          upload={(file) => uploadPortfolioMedia(requireUserId(), file)}
          onUploaded={(media) =>
            create.mutate({
              type: media.type,
              media_url: media.media_url,
              thumbnail_url: media.thumbnail_url,
              storage_path: media.storage_path,
              width: media.width,
              height: media.height,
              duration_seconds: media.duration_seconds,
              sort_order: nextSortOrder(),
            })
          }
          label="Drag photos or videos here"
          hint="JPG, PNG, WebP, GIF, MP4, WebM or MOV · up to 50 MB each · up to 10 at a time"
          compact={items.length > 0}
        />
      </div>

      {portfolio.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="rounded-card" style={{ aspectRatio: '4 / 5' }} />
          ))}
        </div>
      ) : portfolio.isError ? (
        <ErrorState error={portfolio.error} title="Couldn’t load your portfolio" onRetry={() => void portfolio.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Images />}
          title="Your portfolio is empty."
          description="Upload photos and videos of your best work — brands decide faster when they can see it."
          action={
            <>
              <Button type="button" onClick={openFilePicker}>
                <Upload /> Upload files
              </Button>
              <Button type="button" variant="secondary" onClick={() => setLinkOpen(true)}>
                <Link2 /> Add a link
              </Button>
            </>
          }
        />
      ) : (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="tabular-nums">
              {items.length} item{items.length === 1 ? '' : 's'}
            </span>
            {visibleCount < RECOMMENDED_ITEMS && (
              <Badge tone="warning" size="sm">
                Add {RECOMMENDED_ITEMS - visibleCount} more — {RECOMMENDED_ITEMS}+ recommended
              </Badge>
            )}
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {items.map((item, i) => {
              const name = item.title || TYPE_LABEL[item.type]
              return (
                <li key={item.id} className="min-w-0">
                  <MediaTile item={item} onOpen={() => setEditing(item)} className={cn(item.is_hidden && 'opacity-60')} />
                  <div className="mt-2 flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      {item.brand_name && <p className="truncate text-xs text-muted">for {item.brand_name}</p>}
                      {item.is_hidden && (
                        <Badge tone="danger" size="sm" className="mt-1">
                          <EyeOff /> Hidden by moderation
                        </Badge>
                      )}
                    </div>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Actions for ${name}`}>
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setEditing(item)}>
                          <Pencil /> Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={i === 0 || reorder.isPending} onSelect={() => move(i, -1)}>
                          <ArrowLeft /> Move left
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={i === items.length - 1 || reorder.isPending} onSelect={() => move(i, 1)}>
                          <ArrowRight /> Move right
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => setDeleting(item)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              )
            })}
            <li className="min-w-0">
              <button
                type="button"
                onClick={openFilePicker}
                className="focus-ring flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-strong bg-surface/60 text-sm font-medium text-muted transition-colors hover:border-ink hover:text-ink"
                style={{ aspectRatio: '4 / 5' }}
              >
                <Plus className="size-5" aria-hidden />
                Add more
              </button>
            </li>
          </ul>
        </div>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent size="md">
          {linkOpen && (
            <PortfolioLinkForm
              onDone={() => setLinkOpen(false)}
              onCreate={(values) =>
                create.mutateAsync({
                  type: 'link',
                  media_url: values.url,
                  title: values.title || null,
                  brand_name: values.brand_name || null,
                  platform: values.platform,
                  sort_order: nextSortOrder(),
                })
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="md">{editing && <PortfolioItemForm key={editing.id} item={editing} onDone={() => setEditing(null)} />}</DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this portfolio item?"
        description="It’s removed from your storefront and the file is deleted. This can’t be undone."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting)
            setDeleting(null)
          } catch {
            // The mutation cache already surfaced the error.
          }
        }}
      />
    </StudioSection>
  )
}
