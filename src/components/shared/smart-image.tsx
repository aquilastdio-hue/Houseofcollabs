import * as React from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Lazy image with fade-in and a graceful fallback when the URL fails. */
export function SmartImage({
  src,
  alt,
  className,
  imgClassName,
  fallback,
  eager,
}: {
  src?: string | null
  alt: string
  className?: string
  imgClassName?: string
  fallback?: React.ReactNode
  eager?: boolean
}) {
  const [state, setState] = React.useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error')
  React.useEffect(() => setState(src ? 'loading' : 'error'), [src])
  return (
    <div className={cn('relative overflow-hidden bg-subtle', className)}>
      {src && state !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
          className={cn('size-full object-cover transition-opacity duration-500', state === 'loaded' ? 'opacity-100' : 'opacity-0', imgClassName)}
        />
      )}
      {state === 'error' &&
        (fallback ?? (
          <div className="flex size-full items-center justify-center text-faint">
            <ImageOff className="size-6" aria-hidden />
          </div>
        ))}
    </div>
  )
}
