import * as React from 'react'
import { ExternalLink, ImageOff, Link2, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHoverPlay } from '@/hooks/use-hover-play'
import { protectedVideoProps } from '@/lib/video'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SmartImage } from '@/components/shared/smart-image'
import type { PortfolioItem } from '@/types'

type Item = Pick<PortfolioItem, 'id' | 'type' | 'title' | 'description' | 'media_url' | 'thumbnail_url' | 'brand_name' | 'platform'>

/** Single portfolio tile (image / video / external link). */
export function MediaTile({ item, onOpen, className, children }: { item: Item; onOpen?: () => void; className?: string; children?: React.ReactNode }) {
  const isVideo = item.type === 'video'
  const hover = useHoverPlay()
  const Icon = item.type === 'link' ? Link2 : ImageOff
  return (
    <div className={cn('group relative overflow-hidden rounded-card border border-line bg-subtle', className)}>
      <button
        type="button"
        onClick={onOpen}
        // The video underneath takes no pointer events, so the hover handlers
        // belong here — this button is the whole media surface.
        {...hover.hoverProps}
        className="focus-ring block aspect-[4/5] w-full text-left"
        aria-label={`Open ${item.title ?? item.type}`}
      >
        {isVideo ? (
          // One element does both jobs: the still the tile sits at, and the
          // clip that plays under the pointer.
          //
          // `poster` is used when the item has a stored thumbnail. Almost none
          // do — nothing generates one for a video copied across from an
          // application — so `#t=0.1` covers the rest by asking the browser for
          // a frame just past the start. Asking for zero often paints nothing.
          //
          // `preload="metadata"` fetches the header and that frame, not the
          // whole file, so a grid of these stays cheap until one is hovered.
          <video
            {...hover.videoProps}
            src={`${item.media_url}#t=0.1`}
            poster={item.thumbnail_url ?? undefined}
            preload="metadata"
            muted
            loop
            playsInline
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
        ) : (
          <SmartImage
            src={item.type === 'image' ? item.media_url : item.thumbnail_url}
            alt={item.title ?? ''}
            className="absolute inset-0 size-full"
            imgClassName="transition-transform duration-700 ease-spring group-hover:scale-[1.04]"
            fallback={
              <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-sand-soft to-lilac-soft p-4 text-center text-ink-soft">
                <Icon className="size-6" />
                <span className="line-clamp-2 text-sm font-medium">{item.title ?? (item.type === 'link' ? 'External link' : 'Preview unavailable')}</span>
              </div>
            }
          />
        )}
        {item.type !== 'image' && (
          <span className="absolute top-3 left-3">
            <Badge tone="glass" size="sm">
              {item.type === 'video' ? <Play className="fill-ink" /> : <ExternalLink />}
              {item.type === 'video' ? 'Video' : item.platform ?? 'Link'}
            </Badge>
          </span>
        )}
        {(item.title || item.brand_name) && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/75 to-transparent p-3 pt-10 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            {item.title && <span className="block truncate text-sm font-medium">{item.title}</span>}
            {item.brand_name && <span className="block truncate text-xs text-white/75">for {item.brand_name}</span>}
          </span>
        )}
      </button>
      {children}
    </div>
  )
}

/** Masonry-like responsive grid with a lightbox for images/videos. */
export function PortfolioGrid({ items, className, columns = 'default' }: { items: Item[]; className?: string; columns?: 'default' | 'compact' }) {
  const [open, setOpen] = React.useState<Item | null>(null)
  return (
    <>
      <div
        className={cn(
          'grid gap-3 sm:gap-4',
          columns === 'compact' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
          className,
        )}
      >
        {items.map((item) => (
          <MediaTile
            key={item.id}
            item={item}
            onOpen={() => (item.type === 'link' ? window.open(item.media_url, '_blank', 'noopener,noreferrer') : setOpen(item))}
          />
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        {/* The default close is ink-on-light, which disappears against the
            black letterboxing around a portrait video. */}
        <DialogContent
          size="lg"
          className="bg-night text-white"
          closeClassName="bg-black/45 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
        >
          <DialogTitle className="sr-only">{open?.title ?? 'Portfolio item'}</DialogTitle>
          <DialogDescription className="sr-only">{open?.description ?? 'Portfolio preview'}</DialogDescription>
          {open && (
            <div className="flex flex-col">
              <div className="flex max-h-[75dvh] items-center justify-center bg-black">
                {open.type === 'video' ? (
                  // `nodownload` drops Download from the player's overflow menu,
                  // and blocking the context menu removes the "Save video as"
                  // route. Both are deterrents, not protection: the file sits in
                  // a public bucket, so anyone reading the network tab can still
                  // fetch it. Keeping it out of two casual paths is the point.
                  <video
                    src={open.media_url}
                    poster={open.thumbnail_url ?? undefined}
                    controls
                    {...protectedVideoProps}
                    autoPlay
                    playsInline
                    className="max-h-[75dvh] w-full"
                  />
                ) : (
                  <img src={open.media_url} alt={open.title ?? ''} className="max-h-[75dvh] w-auto object-contain" />
                )}
              </div>
              {(open.title || open.description) && (
                <div className="p-5">
                  {open.title && <p className="font-display text-lg font-semibold">{open.title}</p>}
                  {open.brand_name && <p className="text-sm text-white/60">for {open.brand_name}</p>}
                  {open.description && <p className="mt-2 text-sm text-white/80">{open.description}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
