import * as React from 'react'
import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Underlined inline link for body copy (internal routes or mailto/external). */
export function TextLink({ to, children, className, inverse }: { to: string; children: React.ReactNode; className?: string; inverse?: boolean }) {
  const classes = cn(
    'focus-ring rounded-sm font-medium underline underline-offset-4 transition-[text-decoration-color]',
    inverse ? 'text-white decoration-white/30 hover:decoration-white' : 'text-ink decoration-ink/25 hover:decoration-ink',
    className,
  )
  if (/^(mailto:|tel:|https?:)/.test(to)) {
    const external = to.startsWith('http')
    return (
      <a href={to} className={classes} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {children}
      </a>
    )
  }
  return (
    <Link to={to} className={classes}>
      {children}
    </Link>
  )
}

/** Offset used by in-page anchors so headings clear the sticky navbar. */
export const ANCHOR_OFFSET = 'scroll-mt-[calc(var(--header-height)+1.5rem)]'

/** Staggered entrance helper: `style={stagger(2)}` → 160ms delay. */
export function stagger(index: number, step = 80, base = 0): React.CSSProperties {
  return { animationDelay: `${base + index * step}ms` }
}

/** Italic serif accent word(s) inside display headlines. */
export function Accent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-serif font-normal tracking-[-0.015em] italic', className)}>{children}</span>
}

/** Limelight highlighter stroke painted behind a word. */
export function Marker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('relative isolate whitespace-nowrap', className)}>
      <span aria-hidden className="absolute inset-x-[-0.06em] bottom-[0.08em] -z-10 h-[0.4em] -skew-x-6 rounded-[0.12em] bg-brand" />
      {children}
    </span>
  )
}

export function Eyebrow({ children, className, inverse }: { children: React.ReactNode; className?: string; inverse?: boolean }) {
  return (
    <p className={cn('eyebrow inline-flex items-center gap-2', inverse ? 'text-white/60' : 'text-muted', className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-brand ring-4 ring-brand/25" />
      {children}
    </p>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  inverse,
  action,
  titleId,
  size = 'lg',
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  align?: 'left' | 'center'
  inverse?: boolean
  action?: React.ReactNode
  titleId?: string
  size?: 'lg' | 'xl'
  className?: string
}) {
  const center = align === 'center'
  return (
    <div className={cn('flex flex-col gap-4', center ? 'mx-auto max-w-3xl items-center text-center' : 'max-w-2xl', className)}>
      {eyebrow && <Eyebrow inverse={inverse}>{eyebrow}</Eyebrow>}
      <h2
        id={titleId}
        className={cn('font-display font-semibold', size === 'xl' ? 'text-display-xl' : 'text-display-lg', inverse ? 'text-white' : 'text-ink')}
      >
        {title}
      </h2>
      {description && <p className={cn('text-base leading-relaxed sm:text-lg', inverse ? 'text-white/70' : 'text-muted')}>{description}</p>}
      {action && <div className={cn('mt-2 flex flex-wrap items-center gap-3', center && 'justify-center')}>{action}</div>}
    </div>
  )
}

/** Blurred colour glow used behind hero compositions and dark panels. */
// The brand accent is highly saturated, so its glow runs at a much lower
// opacity than the softer tints — otherwise it washes the whole section pink.
const GLOW_TONES = {
  brand: 'bg-brand/14',
  violet: 'bg-brand-deep/14',
  sun: 'bg-sun/20',
  lilac: 'bg-lilac/25',
  peach: 'bg-peach/20',
  sky: 'bg-sky/20',
  rose: 'bg-rose/20',
} as const

export function Glow({ className, tone = 'brand' }: { className?: string; tone?: keyof typeof GLOW_TONES }) {
  return <div aria-hidden className={cn('pointer-events-none absolute rounded-full blur-3xl', GLOW_TONES[tone], className)} />
}

/** Grain texture + brand/violet glows for `bg-night` surfaces (parent must be `relative overflow-hidden`). */
export function NightBackdrop({ variant = 'default' }: { variant?: 'default' | 'soft' }) {
  return (
    <>
      <div aria-hidden className="bg-grain pointer-events-none absolute inset-0 opacity-70" />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-40 -left-40 size-[34rem] rounded-full blur-3xl',
          variant === 'soft' ? 'bg-brand/10' : 'bg-brand/20',
        )}
      />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-48 -bottom-56 size-[38rem] rounded-full blur-3xl',
          variant === 'soft' ? 'bg-lilac/20' : 'bg-lilac/30',
        )}
      />
    </>
  )
}

/** Faint dot grid that fades out towards the edges. */
export function DotGrid({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-line-strong)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]',
        className,
      )}
    />
  )
}

export type Tone = 'brand' | 'lilac' | 'sky' | 'peach' | 'mint' | 'rose' | 'sand' | 'ink' | 'night'

const CHIP_TONES: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-ink',
  lilac: 'bg-lilac-soft text-lilac',
  sky: 'bg-sky-soft text-sky',
  peach: 'bg-peach-soft text-peach',
  mint: 'bg-mint-soft text-mint',
  rose: 'bg-rose-soft text-rose',
  sand: 'bg-sand-soft text-sand',
  ink: 'bg-ink text-brand',
  night: 'bg-white/10 text-brand',
}

const CHIP_SIZES = {
  sm: 'size-8 rounded-[0.7rem] [&_svg]:size-4',
  md: 'size-11 rounded-control [&_svg]:size-5',
  lg: 'size-14 rounded-card [&_svg]:size-6',
} as const

export function IconChip({ icon: Icon, tone = 'brand', size = 'md', className }: { icon: LucideIcon; tone?: Tone; size?: keyof typeof CHIP_SIZES; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center', CHIP_SIZES[size], CHIP_TONES[tone], className)}>
      <Icon />
    </span>
  )
}

/** Fades content up once it scrolls into view (content stays visible without IntersectionObserver). */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'li'
}) {
  const ref = React.useRef<HTMLElement | null>(null)
  const [visible, setVisible] = React.useState(() => typeof window === 'undefined' || typeof IntersectionObserver === 'undefined')

  React.useEffect(() => {
    const el = ref.current
    if (visible || !el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  const props = {
    className: cn(visible ? 'animate-fade-up' : 'opacity-0', className),
    style: visible ? { animationDelay: `${delay}ms` } : undefined,
  }
  return Tag === 'li' ? (
    <li ref={(node) => void (ref.current = node)} {...props}>
      {children}
    </li>
  ) : (
    <div ref={(node) => void (ref.current = node)} {...props}>
      {children}
    </div>
  )
}
