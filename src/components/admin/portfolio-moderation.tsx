import * as React from 'react'
import { Link } from 'react-router'
import { Eye, EyeOff, ImageOff } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatDate } from '@/lib/format'
import { moderatePortfolioItem } from '@/services/admin.service'
import { MediaTile } from '@/components/creator/portfolio-grid'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { PortfolioItem } from '@/types'
import { adminLists } from './admin-keys'
import { ExternalAnchor } from './detail'
import { useAdminMutation } from './use-admin-mutation'

export type ModerationItem = Pick<
  PortfolioItem,
  'id' | 'creator_id' | 'type' | 'title' | 'description' | 'media_url' | 'thumbnail_url' | 'brand_name' | 'platform' | 'is_hidden' | 'created_at'
> & { creator?: { id: string; display_name: string; slug: string } | null }

function PreviewDialog({ item, onClose }: { item: ModerationItem | null; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" className="bg-night text-white">
        <DialogTitle className="sr-only">{item?.title ?? 'Portfolio item'}</DialogTitle>
        <DialogDescription className="sr-only">{item?.description ?? 'Portfolio preview'}</DialogDescription>
        {item && (
          <div className="flex flex-col">
            <div className="flex max-h-[70dvh] items-center justify-center bg-black">
              {item.type === 'video' ? (
                <video src={item.media_url} poster={item.thumbnail_url ?? undefined} controls playsInline className="max-h-[70dvh] w-full" />
              ) : (
                <img src={item.media_url} alt={item.title ?? 'Portfolio item'} className="max-h-[70dvh] w-auto object-contain" />
              )}
            </div>
            <div className="space-y-1 p-5">
              {item.title && <p className="font-display text-lg font-semibold">{item.title}</p>}
              {item.brand_name && <p className="text-sm text-white/60">for {item.brand_name}</p>}
              {item.description && <p className="text-sm text-white/80">{item.description}</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Portfolio grid with admin hide / unhide. Hidden items disappear from the
 * public storefront but stay visible to the creator and admins.
 */
export function PortfolioModerationGrid({ items, showCreator, emptyTitle, emptyDescription }: { items: ModerationItem[]; showCreator?: boolean; emptyTitle?: string; emptyDescription?: string }) {
  const [preview, setPreview] = React.useState<ModerationItem | null>(null)
  const [pending, setPending] = React.useState<ModerationItem | null>(null)

  const moderate = useAdminMutation(({ id, hidden }: { id: string; hidden: boolean }) => moderatePortfolioItem(id, hidden), {
    invalidate: [adminLists.content, [...qk.admin.all, 'creator'], qk.creators.all],
    success: (_d, v) => (v.hidden ? 'Item hidden from the storefront' : 'Item is visible again'),
    onSuccess: () => setPending(null),
  })

  if (items.length === 0) {
    return <EmptyState compact icon={<ImageOff />} title={emptyTitle ?? 'No portfolio items'} description={emptyDescription} />
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2">
            <MediaTile
              item={item}
              className={item.is_hidden ? 'opacity-60' : undefined}
              onOpen={() => (item.type === 'link' ? window.open(item.media_url, '_blank', 'noopener,noreferrer') : setPreview(item))}
            >
              {item.is_hidden && (
                <span className="pointer-events-none absolute top-3 right-3">
                  <Badge tone="dark" size="sm">
                    <EyeOff /> Hidden
                  </Badge>
                </span>
              )}
            </MediaTile>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-xs">
                {showCreator && item.creator && (
                  <Link to={`/admin/creators/${item.creator.id}`} className="focus-ring block truncate rounded-sm font-medium text-ink hover:underline">
                    {item.creator.display_name}
                  </Link>
                )}
                <p className="truncate text-muted">{item.title ?? (item.type === 'link' ? 'External link' : item.type === 'video' ? 'Video' : 'Image')}</p>
                <p className="text-faint">{formatDate(item.created_at)}</p>
                {item.type === 'link' && <ExternalAnchor href={item.media_url} className="text-xs">Open link</ExternalAnchor>}
              </div>
              <Button
                variant={item.is_hidden ? 'secondary' : 'ghost'}
                size="xs"
                onClick={() => setPending(item)}
                aria-label={`${item.is_hidden ? 'Unhide' : 'Hide'} ${item.title ?? 'portfolio item'}`}
              >
                {item.is_hidden ? <Eye /> : <EyeOff />}
                {item.is_hidden ? 'Unhide' : 'Hide'}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <PreviewDialog item={preview} onClose={() => setPreview(null)} />

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.is_hidden ? 'Show this item again?' : 'Hide this portfolio item?'}
        description={
          pending?.is_hidden
            ? 'It will reappear on the creator’s public storefront.'
            : 'It disappears from the public storefront and search previews. The creator still sees it in their portfolio.'
        }
        confirmLabel={pending?.is_hidden ? 'Unhide item' : 'Hide item'}
        destructive={!pending?.is_hidden}
        loading={moderate.isPending}
        onConfirm={() => {
          if (pending) moderate.mutate({ id: pending.id, hidden: !pending.is_hidden })
        }}
      />
    </>
  )
}
