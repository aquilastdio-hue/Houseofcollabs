import { Avatar as AvatarPrimitive } from 'radix-ui'
import { cn, hashIndex, initials } from '@/lib/utils'

const FALLBACK_TONES = [
  'bg-brand-soft text-brand-ink',
  'bg-lilac-soft text-lilac',
  'bg-rose-soft text-rose',
  'bg-sky-soft text-sky',
  'bg-peach-soft text-peach',
  'bg-mint-soft text-mint',
  'bg-sand-soft text-sand',
]

const SIZES = {
  xs: 'size-6 text-[0.625rem]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-lg',
  '2xl': 'size-24 text-2xl',
  '3xl': 'size-32 text-3xl',
} as const

export type AvatarProps = {
  src?: string | null
  name?: string | null
  size?: keyof typeof SIZES
  shape?: 'circle' | 'rounded'
  className?: string
  online?: boolean
}

export function Avatar({ src, name, size = 'md', shape = 'circle', className, online }: AvatarProps) {
  const tone = FALLBACK_TONES[hashIndex(name ?? '?', FALLBACK_TONES.length)]
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <AvatarPrimitive.Root
        className={cn(
          'inline-flex size-full shrink-0 items-center justify-center overflow-hidden bg-subtle font-semibold select-none',
          SIZES[size],
          shape === 'circle' ? 'rounded-full' : 'rounded-control',
        )}
      >
        {src && <AvatarPrimitive.Image src={src} alt={name ?? ''} className="size-full object-cover" loading="lazy" />}
        <AvatarPrimitive.Fallback delayMs={src ? 400 : 0} className={cn('flex size-full items-center justify-center', tone)}>
          {initials(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {online !== undefined && (
        <span
          className={cn(
            'absolute right-0 bottom-0 block size-2.5 rounded-full ring-2 ring-surface',
            online ? 'bg-success animate-pulse-dot' : 'bg-faint',
          )}
          aria-label={online ? 'Online' : 'Offline'}
        />
      )}
    </span>
  )
}
