import {
  AtSign,
  BadgeCheck,
  Clock3,
  Facebook,
  Images,
  Instagram,
  Layers,
  MapPin,
  Play,
  Plus,
  Store,
  Tag,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADDON_TYPES, DELIVERY_OPTIONS } from '@/lib/constants'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ServiceCard } from '@/components/creator/service-card'
import { EXAMPLE_REEL_ADDONS, EXAMPLE_REEL_SERVICE } from './examples'
import { Accent, IconChip, Reveal, SectionHeader, type Tone } from './primitives'

function BentoCard({
  icon,
  tone = 'brand',
  title,
  body,
  children,
  className,
  delay = 0,
}: {
  icon: LucideIcon
  tone?: Tone
  title: string
  body: string
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <Reveal delay={delay} className={className}>
      <article className="flex h-full flex-col gap-5 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
        <header className="flex items-start gap-3.5">
          <IconChip icon={icon} tone={tone} size="sm" />
          {/* min-w-0: a flex child defaults to min-width:auto and refuses to
              shrink below its content, which overflowed the grid on 320px screens. */}
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        </header>
        <div className="relative mt-auto rounded-card bg-subtle/80 p-4">
          <span className="absolute -top-2.5 right-3">
            <Badge tone="outline" size="sm">
              Example
            </Badge>
          </span>
          {children}
        </div>
      </article>
    </Reveal>
  )
}

const DELIVERY_CHIPS = DELIVERY_OPTIONS.filter((o) => o.value !== undefined).map((o) => o.label)
const ADDON_EXAMPLES = ADDON_TYPES.filter((a) => a.value !== 'custom')

const SOCIALS: { icon: LucideIcon; name: string }[] = [
  { icon: Instagram, name: 'Instagram' },
  { icon: Youtube, name: 'YouTube' },
  { icon: Facebook, name: 'Facebook' },
]

const PORTFOLIO_TINTS = ['from-peach-soft to-sand-soft', 'from-lilac-soft to-sky-soft', 'from-mint-soft to-brand-soft', 'from-rose-soft to-peach-soft']

export function StorefrontPreviewSection() {
  return (
    <section aria-labelledby="storefront-title" className="py-section">
      <div className="container-page">
        <SectionHeader
          titleId="storefront-title"
          eyebrow="Your creator storefront"
          title={
            <>
              One page that <Accent>sells your work</Accent> for you
            </>
          }
          description="Your storefront is what brands see when they find you. Here’s what goes on it — shown with example details."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <BentoCard icon={Store} title="Profile" body="Photo, bio, city, categories and the languages you create in." className="lg:col-span-3">
            <div className="flex items-center gap-3">
              <Avatar name="Example Creator" size="lg" className="rounded-full ring-4 ring-surface" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-display font-semibold">
                  Example Creator <BadgeCheck className="size-4 shrink-0 fill-brand text-ink" aria-label="Verified" />
                </p>
                <p className="flex items-center gap-1 text-xs text-muted">
                  <MapPin className="size-3" aria-hidden /> Kochi, Kerala
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">Food and travel stories told slowly — recipes, stays and hidden cafés along the coast.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="brand-soft" size="sm">
                Food
              </Badge>
              <Badge tone="neutral" size="sm">
                Travel
              </Badge>
              <Badge tone="outline" size="sm">
                Malayalam · English
              </Badge>
            </div>
          </BentoCard>

          <BentoCard
            icon={Tag}
            tone="lilac"
            title="Services & pricing"
            body="Fixed-price packages with what’s included, delivery time, revisions and add-ons."
            className="md:row-span-2 lg:col-span-3 lg:row-span-2"
            delay={80}
          >
            <ServiceCard service={EXAMPLE_REEL_SERVICE} addons={EXAMPLE_REEL_ADDONS} className="shadow-none" />
          </BentoCard>

          <BentoCard icon={Images} tone="peach" title="Portfolio" body="Your best videos, photos and links — the first thing brands open." className="lg:col-span-3">
            <div aria-hidden className="grid grid-cols-4 gap-2">
              {PORTFOLIO_TINTS.map((tint, i) => (
                <div key={tint} className={cn('relative aspect-[4/5] overflow-hidden rounded-control bg-linear-to-br', tint)}>
                  {i % 2 === 0 && (
                    <span className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-white/85">
                      <Play className="size-2.5 fill-ink text-ink" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </BentoCard>

          <BentoCard icon={Clock3} tone="sky" title="Delivery time" body="Choose how long each service takes. Faster turnaround can be an add-on." className="lg:col-span-2">
            <ul className="flex flex-wrap gap-1.5">
              {DELIVERY_CHIPS.map((label, i) => (
                <li
                  key={label}
                  className={cn(
                    'rounded-pill px-2.5 py-1 text-xs font-medium',
                    i === 2 ? 'bg-ink text-white' : 'bg-surface text-ink-soft ring-1 ring-line',
                  )}
                >
                  {label}
                </li>
              ))}
            </ul>
          </BentoCard>

          <BentoCard icon={Layers} tone="mint" title="Add-ons" body="Extras brands can add at checkout — each with its own price." className="lg:col-span-2">
            <ul className="space-y-1.5">
              {ADDON_EXAMPLES.map((addon) => (
                <li key={addon.value} className="flex items-center gap-2 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-line">
                    <Plus className="size-3" aria-hidden />
                  </span>
                  <span className="font-medium">{addon.label}</span>
                  <span className="truncate text-xs text-muted">{addon.description}</span>
                </li>
              ))}
            </ul>
          </BentoCard>

          <BentoCard
            icon={AtSign}
            tone="rose"
            title="Social accounts"
            body="Link your profiles so brands see your audience at a glance."
            className="md:col-span-2 lg:col-span-2"
          >
            <ul className="space-y-2">
              {SOCIALS.map(({ icon: Icon, name }) => (
                <li key={name} className="flex items-center gap-2.5 rounded-control bg-surface px-3 py-2 text-sm ring-1 ring-line">
                  <Icon className="size-4 shrink-0 text-ink" aria-hidden />
                  <span className="shrink-0 font-medium">{name}</span>
                  {/* min-w-0 + flex-1 so `truncate` can actually ellipsis: without it a
                      flex child keeps min-width:auto and forces the card wider than a
                      320px screen. shrink-0 keeps the icon and badge intact. */}
                  <span className="min-w-0 flex-1 truncate text-muted">@example.creator</span>
                  <Badge tone="success" size="sm" className="shrink-0">
                    Linked
                  </Badge>
                </li>
              ))}
            </ul>
          </BentoCard>
        </div>
      </div>
    </section>
  )
}
