import { Link } from 'react-router'
import { ArrowRight, Clock3, RefreshCw, ShieldCheck, Tag } from 'lucide-react'
import { cn, range } from '@/lib/utils'
import { site } from '@/config/site'
import { useCreatorSearch } from '@/hooks/use-creators'
import type { CreatorSearchParams } from '@/services/creators.service'
import type { CreatorCard as CreatorCardData } from '@/types'
import { Avatar } from '@/components/ui/avatar'
import { CreatorCard, CreatorCardSkeleton } from '@/components/marketplace/creator-card'
import { stagger } from './primitives'

const HERO_PARAMS: CreatorSearchParams = { sort: 'relevance', pageSize: 6 }

/** Fan positions: [front/centre, back-left, back-right]. */
const FAN_SLOTS = [
  'left-1/2 top-2 z-10 -translate-x-1/2 -rotate-[1.5deg]',
  'left-0 top-20 z-0 -rotate-[8deg]',
  'right-0 top-14 z-0 rotate-[6deg]',
]

const GHOST_TINTS = [
  'from-brand-soft via-sand-soft to-lilac-soft',
  'from-sky-soft via-lilac-soft to-rose-soft',
  'from-peach-soft via-sand-soft to-mint-soft',
]

type ShowcaseState = 'loading' | 'error' | 'empty' | 'ready'

/**
 * "Marketplace preview" composition for the home hero: live creator cards
 * fanned out on desktop and a swipeable rail on smaller screens. With no
 * published creators it falls back to an abstract composition of UI shapes.
 *
 * `params` narrows which creators appear, so a format landing page can show the
 * people who actually sell that format rather than a general sample.
 */
export function HeroShowcase({ className, params = HERO_PARAMS }: { className?: string; params?: CreatorSearchParams }) {
  const query = useCreatorSearch(params)
  const creators = query.data?.items ?? []
  const state: ShowcaseState = query.isPending ? 'loading' : query.isError ? 'error' : creators.length === 0 ? 'empty' : 'ready'
  const retry = () => void query.refetch()
  const railItems: (CreatorCardData | undefined)[] = state === 'ready' ? creators : range(3).map(() => undefined)

  return (
    <div className={cn('relative', className)}>
      {/* Desktop: fanned cards */}
      {/* The cards used to sit on three tinted glows. They spilled past the
          section and tinted the page behind it, so the colour now comes from
          the cards themselves. */}
      <div className="relative isolate hidden h-[42rem] lg:block">
        {range(3).map((i) => {
          const creator = creators[i]
          if (state === 'ready' && !creator) return null
          return (
            <div
              key={creator?.id ?? `slot-${i}`}
              className={cn(
                'absolute w-[15.5rem] animate-fade-up transition-[rotate,translate] duration-500 ease-spring hover:z-30 hover:rotate-0 xl:w-[17rem]',
                FAN_SLOTS[i],
              )}
              style={stagger(i, 120, 150)}
            >
              <ShowcaseCard state={state} creator={creator} index={i} />
            </div>
          )
        })}

        <FloatingChip className="top-3 -left-3" delay={0}>
          <Clock3 /> Delivery dates upfront
        </FloatingChip>
        <FloatingChip className="top-[40%] -right-4" delay={1.5}>
          <Tag /> Fixed prices, no haggling
        </FloatingChip>
        <FloatingChip className="top-[52%] -left-6" delay={3}>
          <ShieldCheck /> Paid on approval
        </FloatingChip>

        {state === 'ready' && creators.length > 3 && <MoreCreatorsChip creators={creators.slice(3, 6)} />}
        {state === 'error' && <StatusChip tone="error" onRetry={retry} />}
        {state === 'empty' && <StatusChip tone="empty" />}
      </div>

      {/* Mobile + tablet: horizontal rail */}
      <div className="lg:hidden">
        <ul aria-label={`Creators on ${site.name}`} className="no-scrollbar -mx-gutter flex snap-x snap-mandatory scroll-px-gutter gap-4 overflow-x-auto px-gutter pt-2 pb-6">
          {railItems.map((creator, i) => (
            <li key={creator?.id ?? `rail-${i}`} className="w-64 shrink-0 snap-start animate-fade-up sm:w-72" style={stagger(i, 90, 150)}>
              <ShowcaseCard state={state} creator={creator} index={i} />
            </li>
          ))}
        </ul>
        {state === 'error' && <StatusChip tone="error" onRetry={retry} inline />}
        {state === 'empty' && <StatusChip tone="empty" inline />}
      </div>
    </div>
  )
}

function ShowcaseCard({ state, creator, index }: { state: ShowcaseState; creator?: CreatorCardData; index: number }) {
  if (state === 'loading') return <CreatorCardSkeleton />
  if (state === 'ready' && creator) return <CreatorCard creator={creator} href={`/creators/${creator.slug}`} priority={index < 3} />
  return <GhostCard tint={GHOST_TINTS[index % GHOST_TINTS.length]!} />
}

/** Neutral UI-shape stand-in for a creator card (no names, prices or numbers). */
function GhostCard({ tint }: { tint: string }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className={cn('relative aspect-[4/5] bg-linear-to-br', tint)}>
        <div className="absolute top-3 left-3 h-5 w-16 rounded-pill bg-white/70" />
        <div className="absolute top-3 right-3 size-9 rounded-full bg-white/80" />
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-2.5">
          <div className="size-10 shrink-0 rounded-full bg-white/85 ring-2 ring-white/60" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 rounded-pill bg-white/85" />
            <div className="h-2.5 w-1/2 rounded-pill bg-white/60" />
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex gap-1.5">
          <div className="h-5 w-16 rounded-pill bg-brand-soft" />
          <div className="h-5 w-12 rounded-pill bg-subtle" />
        </div>
        <div className="space-y-1.5">
          <div className="h-2.5 w-full rounded-pill bg-subtle" />
          <div className="h-2.5 w-4/5 rounded-pill bg-subtle" />
        </div>
        <div className="flex items-end justify-between border-t border-line pt-3">
          <div className="space-y-1.5">
            <div className="h-2 w-12 rounded-pill bg-subtle" />
            <div className="h-4 w-20 rounded-pill bg-muted-surface" />
          </div>
          <div className="h-8 w-16 rounded-pill bg-ink" />
        </div>
      </div>
    </div>
  )
}

function FloatingChip({ children, className, delay }: { children: React.ReactNode; className?: string; delay: number }) {
  return (
    <div className={cn('absolute z-20 animate-float', className)} style={{ animationDelay: `${delay}s` }}>
      {/* The chip sits on a light surface, so the label stays ink; only the icon
          gets the brand fill (and therefore white). */}
      <p className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface/90 py-2 pr-4 pl-2 text-sm font-medium text-ink shadow-float backdrop-blur-md [&_svg]:size-3.5 [&>svg]:box-content [&>svg]:rounded-full [&>svg]:bg-brand [&>svg]:p-1.5 [&>svg]:text-white">
        {children}
      </p>
    </div>
  )
}

function MoreCreatorsChip({ creators }: { creators: CreatorCardData[] }) {
  return (
    <Link
      to="/discover"
      className="focus-ring group absolute bottom-0 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-3 rounded-pill border border-line bg-surface py-1.5 pr-4 pl-1.5 text-sm font-medium whitespace-nowrap shadow-float transition-colors hover:border-line-strong"
    >
      <span className="flex -space-x-2">
        {creators.map((c) => (
          <Avatar key={c.id} src={c.profile_image_url} name={c.display_name} size="sm" className="rounded-full ring-2 ring-surface" />
        ))}
      </span>
      More creators to discover
      <ArrowRight className="size-4 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" />
    </Link>
  )
}

function StatusChip({ tone, onRetry, inline }: { tone: 'error' | 'empty'; onRetry?: () => void; inline?: boolean }) {
  const wrapper = inline ? 'mt-1 flex justify-center' : 'absolute inset-x-0 bottom-2 z-20 flex justify-center'
  if (tone === 'error') {
    return (
      <div className={wrapper} role="alert">
        <p className="inline-flex items-center gap-3 rounded-pill border border-line bg-surface py-1.5 pr-1.5 pl-4 text-sm shadow-float">
          Live creators couldn’t load right now.
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring inline-flex items-center gap-1.5 rounded-pill bg-ink px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink-soft"
          >
            <RefreshCw className="size-3.5" /> Retry
          </button>
        </p>
      </div>
    )
  }
  return (
    <div className={wrapper}>
      <Link
        to="/get-started?role=creator"
        className="focus-ring group inline-flex items-center gap-2 rounded-pill border border-line bg-surface py-2 pr-4 pl-4 text-sm font-medium shadow-float transition-colors hover:border-line-strong"
      >
        Your storefront could be the first one here
        <ArrowRight className="size-4 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" />
      </Link>
    </div>
  )
}
