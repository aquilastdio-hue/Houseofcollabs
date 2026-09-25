import * as React from 'react'
import { ExternalLink, Film, Link2, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SmartImage } from '@/components/shared/smart-image'
import type { PortfolioItem } from '@/types'

type Item = Pick<PortfolioItem, 'id' | 'type' | 'title' | 'description' | 'media_url' | 'thumbnail_url' | 'brand_name' | 'platform'>

/** Single portfolio tile (image / video / external link). */
export function MediaTile({ item, onOpen, className, children }: { item: Item; onOpen?: () => void; className?: string; children?: React.ReactNode }) {
  const poster = item.type === 'image' ? item.media_url : item.thumbnail_url
  const Icon = item.type === 'video' ? Film : Link2
  return (
    <div className={cn('group relative overflow-hidden rounded-card border border-line bg-subtle', className)}>
      <button type="button" onClick={onOpen} className="focus-ring block aspect-[4/5] w-full text-left" aria-label={`Open ${item.title ?? item.type}`}>
        <SmartImage
          src={poster}
          alt={item.title ?? ''}
          className="absolute inset-0 size-full"
          imgClassName="transition-transform duration-700 ease-spring group-hover:scale-[1.04]"
          fallback={
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-sand-soft to-lilac-soft p-4 text-center text-ink-soft">
              <Icon className="size-6" />
              <span className="line-clamp-2 text-sm font-medium">{item.title ?? (item.type === 'link' ? 'External link' : 'Video')}</span>
            </div>
          }
        />
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
        <DialogContent size="lg" className="bg-night text-white">
          <DialogTitle className="sr-only">{open?.title ?? 'Portfolio item'}</DialogTitle>
          <DialogDescription className="sr-only">{open?.description ?? 'Portfolio preview'}</DialogDescription>
          {open && (
            <div className="flex flex-col">
              <div className="flex max-h-[75dvh] items-center justify-center bg-black">
                {open.type === 'video' ? (
                  <video src={open.media_url} poster={open.thumbnail_url ?? undefined} controls autoPlay playsInline className="max-h-[75dvh] w-full" />
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
