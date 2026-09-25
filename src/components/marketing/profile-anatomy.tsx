import {
  BadgeCheck,
  Clock3,
  Images,
  IndianRupee,
  Info,
  Languages,
  Layers,
  MapPin,
  Play,
  RefreshCcw,
  Shapes,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { StarRating } from '@/components/shared/star-rating'
import { ServiceCard } from '@/components/creator/service-card'
import { EXAMPLE_UGC_ADDONS, EXAMPLE_UGC_SERVICE } from './examples'
import { Accent, Reveal, SectionHeader } from './primitives'

type Callout = { icon: LucideIcon; title: string; body: string }

type Row = { key: string; left: Callout[]; right: Callout[]; mock: React.ReactNode }

const ROWS: Row[] = [
  {
    key: 'header',
    left: [
      { icon: Shapes, title: 'Category', body: 'Primary and secondary categories, so you know what they’re best at.' },
      { icon: MapPin, title: 'Location', body: 'City and state — useful for regional campaigns and product shipping.' },
    ],
    right: [
      { icon: Users, title: 'Followers', body: 'Audience size from their linked social accounts, shown at a glance.' },
      { icon: Languages, title: 'Languages', body: 'Every language they create in, from Hindi and English to Tamil or Bengali.' },
    ],
    mock: <HeaderMock />,
  },
  {
    key: 'portfolio',
    left: [{ icon: Images, title: 'Portfolio', body: 'Real samples of past work — videos, photos and links — before you spend a rupee.' }],
    right: [{ icon: BadgeCheck, title: 'Verification & reviews', body: 'A verified badge where earned, and ratings from brands who ordered before.' }],
    mock: <PortfolioMock />,
  },
  {
    key: 'service',
    left: [
      { icon: IndianRupee, title: 'Price', body: 'A fixed price per service. The amount you see is the amount you pay.' },
      { icon: Clock3, title: 'Delivery time', body: 'How long the work takes, shown before you order and tracked after.' },
    ],
    right: [
      { icon: RefreshCcw, title: 'Revisions', body: 'How many rounds of changes are included in the price.' },
      { icon: Layers, title: 'Add-ons', body: 'Optional extras such as raw footage, faster delivery or ad usage rights.' },
    ],
    mock: <ServiceCard service={EXAMPLE_UGC_SERVICE} addons={EXAMPLE_UGC_ADDONS} className="shadow-float" />,
  },
]

export function ProfileAnatomySection() {
  return (
    <section aria-labelledby="anatomy-title" className="py-section">
      <div className="container-page">
        <SectionHeader
          align="center"
          titleId="anatomy-title"
          eyebrow="Anatomy of a creator profile"
          title={
            <>
              Everything you need to decide, <Accent>on one page</Accent>
            </>
          }
          description="Every storefront answers the same questions in the same place, so comparing creators takes minutes instead of a week of messages."
        />
        <div className="mt-8 flex justify-center">
          <p className="inline-flex items-start gap-2 rounded-card border border-line bg-surface px-4 py-3 text-sm text-muted sm:items-center">
            <Info className="mt-0.5 size-4 shrink-0 text-ink sm:mt-0" aria-hidden />
            <span>
              <strong className="font-semibold text-ink">Illustrative example.</strong> The name, numbers and prices below are made up to show the
              layout — real storefronts show each creator’s own details.
            </span>
          </p>
        </div>

        <div className="mt-14 space-y-10 lg:space-y-14">
          {ROWS.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)_minmax(0,1fr)] lg:items-center lg:gap-12"
            >
              <CalloutList items={row.left} side="left" className="order-2 lg:order-1" />
              <Reveal className="order-1 lg:order-2">
                <div className="relative">
                  <span className="absolute -top-3 left-4 z-10">
                    <Badge tone="dark" size="sm">
                      Example
                    </Badge>
                  </span>
                  {row.mock}
                </div>
              </Reveal>
              <CalloutList items={row.right} side="right" className="order-3" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CalloutList({ items, side, className }: { items: Callout[]; side: 'left' | 'right'; className?: string }) {
  return (
    <ul className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-8', className)}>
      {items.map(({ icon: Icon, title, body }) => (
        <li
          key={title}
          className={cn(
            'relative flex items-start gap-3 rounded-card border border-line bg-surface/80 p-4 lg:border-0 lg:bg-transparent lg:p-0',
            side === 'left' && 'lg:flex-row-reverse lg:text-right',
          )}
        >
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display font-semibold tracking-tight">{title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
          </div>
          <span
            aria-hidden
            className={cn(
              'absolute top-[1.125rem] hidden h-px w-10 bg-line-strong lg:block',
              side === 'left' ? '-right-12 after:absolute after:-top-[3px] after:right-0 after:size-[7px] after:rounded-full after:bg-ink' : '-left-12 after:absolute after:-top-[3px] after:left-0 after:size-[7px] after:rounded-full after:bg-ink',
            )}
          />
        </li>
      ))}
    </ul>
  )
}

function HeaderMock() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-float">
      <div aria-hidden className="h-24 bg-linear-to-r from-rose-soft via-sand-soft to-brand-soft" />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex items-end gap-3">
          <Avatar name="Example Creator" size="xl" className="rounded-full ring-4 ring-surface" />
          <div className="min-w-0 pb-1">
            <p className="flex items-center gap-1 font-display text-lg font-semibold">
              Example Creator <BadgeCheck className="size-4 shrink-0 fill-brand text-ink" aria-label="Verified" />
            </p>
            <p className="flex items-center gap-1 text-sm text-muted">
              <MapPin className="size-3.5" aria-hidden /> Jaipur, Rajasthan
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Badge tone="brand-soft">Skincare</Badge>
          <Badge tone="neutral">Beauty</Badge>
          <Badge tone="outline">
            <Users aria-hidden /> 48K followers
          </Badge>
          <Badge tone="outline">
            <Languages aria-hidden /> Hindi · English
          </Badge>
        </div>
      </div>
    </div>
  )
}

const TILE_TINTS = ['from-peach-soft to-rose-soft', 'from-sky-soft to-lilac-soft', 'from-brand-soft to-mint-soft']

function PortfolioMock() {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-float">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display font-semibold">Portfolio</p>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <StarRating value={5} size="xs" /> Reviews from brands
        </span>
      </div>
      <div aria-hidden className="mt-3 grid grid-cols-3 gap-2">
        {TILE_TINTS.map((tint, i) => (
          <div key={tint} className={cn('relative aspect-[4/5] overflow-hidden rounded-control bg-linear-to-br', tint)}>
            {i !== 1 && (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-pill bg-white/85 px-1.5 py-0.5 text-[0.625rem] font-medium text-ink">
                <Play className="size-2.5 fill-ink" /> Video
              </span>
            )}
            <span className="absolute inset-x-2 bottom-2 h-1.5 rounded-pill bg-white/70" />
          </div>
        ))}
      </div>
    </div>
  )
}
