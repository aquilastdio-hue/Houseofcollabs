import * as React from 'react'
import { Link } from 'react-router'
import { BadgeCheck, CalendarDays, Cake, Images, Languages, MapPin, Package, Timer, TrendingUp, UserRound, type LucideIcon } from 'lucide-react'
import { cn, isDefined } from '@/lib/utils'
import { formatDate, formatINR, formatLocation, formatPercent } from '@/lib/format'
import { CONTENT_TYPES, GENDERS, RESPONSE_TIMES, labelFor } from '@/lib/constants'
import { isVideoUrl } from '@/utils/media'
import type { CreatorProfile, CreatorProfileService } from '@/services/creators.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/states'
import { ServiceCard } from '@/components/creator/service-card'
import { useHoverPlay } from '@/hooks/use-hover-play'
import { protectedVideoProps } from '@/lib/video'
import { PortfolioGrid } from '@/components/creator/portfolio-grid'
import { useCreatorAccess, WithReason } from './creator-actions'
import { firstName, profileLanguages, scrollToSection, signInHref, visiblePortfolio, visibleServices, type ProfileSectionId } from './profile-utils'

/** Section with an anchor target that clears the sticky header + section nav. */
export function ProfileSection({
  id,
  title,
  description,
  action,
  children,
}: {
  id: ProfileSectionId
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-[calc(var(--header-height)+4.5rem)]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} data-section-heading tabIndex={-1} className="font-display text-display-sm font-semibold focus:outline-none">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function useActiveSection(ids: readonly string[]) {
  const key = ids.join('|')
  const [active, setActive] = React.useState(ids[0])

  React.useEffect(() => {
    const list = key.split('|')
    let frame = 0
    const update = () => {
      frame = 0
      let current = list[0]
      for (const id of list) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 170) current = id
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      setActive(atBottom ? list[list.length - 1] : current)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [key])

  return active
}

/** Sticky in-page navigation with scroll-spy. */
export function ProfileSectionNav({ items }: { items: { id: ProfileSectionId; label: string; count?: number }[] }) {
  const active = useActiveSection(items.map((i) => i.id))
  return (
    <nav
      aria-label="Profile sections"
      className="sticky top-(--header-height) z-20 -mx-gutter mb-8 border-b border-line bg-canvas/90 px-gutter backdrop-blur-md lg:mx-0 lg:px-0"
    >
      <ul className="no-scrollbar flex gap-6 overflow-x-auto">
        {items.map((item) => {
          const current = active === item.id
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  scrollToSection(item.id)
                }}
                className={cn(
                  'focus-ring -mb-px flex items-center gap-1.5 border-b-2 py-3.5 text-sm font-medium whitespace-nowrap transition-colors',
                  current ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
                )}
              >
                {item.label}
                {item.count !== undefined && <span className="rounded-pill bg-subtle px-1.5 text-xs text-muted tabular-nums">{item.count}</span>}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function PortfolioSection({ creator }: { creator: CreatorProfile }) {
  const items = visiblePortfolio(creator)
  const name = firstName(creator.display_name)
  return (
    <ProfileSection id="portfolio" title="Portfolio" description={items.length > 0 ? `Recent work by ${name}. Tap a piece to view it.` : undefined}>
      {items.length > 0 ? (
        <PortfolioGrid items={items} columns="compact" />
      ) : (
        <EmptyState
          compact
          icon={<Images />}
          title="No portfolio yet"
          description={`${name} hasn’t shared samples yet — ask for recent work in a message.`}
        />
      )}
    </ProfileSection>
  )
}

function HireServiceAction({ creator, service }: { creator: CreatorProfile; service: CreatorProfileService }) {
  const access = useCreatorAccess(creator)
  const label = `Hire for ${formatINR(service.price)}`
  const reason = !service.active ? 'This service is paused.' : access.hireBlocked

  if (reason) {
    return (
      <WithReason reason={reason} className="w-full">
        <Button block disabled>
          {label}
        </Button>
      </WithReason>
    )
  }
  const checkout = `/brand/checkout/${service.id}`
  return (
    <Button asChild block>
      <Link to={access.signedIn ? checkout : signInHref(checkout)}>{label}</Link>
    </Button>
  )
}

export function ServicesSection({ creator }: { creator: CreatorProfile }) {
  const access = useCreatorAccess(creator)
  const services = visibleServices(creator, access.isOwner)
  return (
    <ProfileSection
      id="services"
      title="Services"
      description="Fixed prices, delivery times and revisions. Your payment is held securely until you approve the work."
    >
      {services.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              addons={service.service_addons}
              action={<HireServiceAction creator={creator} service={service} />}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          compact
          icon={<Package />}
          title="No services listed yet"
          description={`${firstName(creator.display_name)} hasn’t published a package yet. Send a message to discuss what you need.`}
        />
      )}
    </ProfileSection>
  )
}

type Detail = { icon: LucideIcon; label: string; value: string }

export function AboutSection({ creator }: { creator: CreatorProfile }) {
  const introVideo = useHoverPlay({ resetOnLeave: false })
  const name = firstName(creator.display_name)
  const languages = profileLanguages(creator)
  const response = labelFor(RESPONSE_TIMES, creator.response_time)
  const details: Detail[] = [
    creator.gender && creator.gender !== 'prefer_not_to_say' ? { icon: UserRound, label: 'Gender', value: labelFor(GENDERS, creator.gender) } : null,
    creator.age ? { icon: Cake, label: 'Age', value: `${creator.age} years` } : null,
    { icon: MapPin, label: 'Based in', value: formatLocation(creator.city, creator.state, creator.country) },
    languages.length > 0 ? { icon: Languages, label: 'Languages', value: languages.join(', ') } : null,
    creator.creator_type_info ? { icon: BadgeCheck, label: 'Creator type', value: creator.creator_type_info.name } : null,
    creator.engagement_rate != null ? { icon: TrendingUp, label: 'Engagement rate', value: formatPercent(creator.engagement_rate) } : null,
    response ? { icon: Timer, label: 'Response time', value: response } : null,
    creator.published_at ? { icon: CalendarDays, label: 'On House of Collabs since', value: formatDate(creator.published_at, 'MMM yyyy') } : null,
  ].filter(isDefined)

  return (
    <ProfileSection id="about" title={`About ${name}`}>
      {creator.bio ? (
        <p className="max-w-prose leading-relaxed whitespace-pre-line text-ink-soft">{creator.bio}</p>
      ) : (
        <p className="text-muted">{name} hasn’t written a bio yet.</p>
      )}

      {isVideoUrl(creator.intro_video_url) && (
        <video
          // Plays on hover, or on a press-and-hold by touch. It keeps its
          // place rather than rewinding, so this behaves like a player the
          // pointer happens to be steering, not a preview that resets.
          {...introVideo.videoProps}
          {...introVideo.hoverProps}
          src={creator.intro_video_url ?? undefined}
          controls
          {...protectedVideoProps}
          preload="metadata"
          playsInline
          aria-label={`Intro video from ${creator.display_name}`}
          // No fixed aspect. Creators shoot on phones, so most of these are
          // portrait, and forcing 16:9 letterboxed them inside a wide black
          // box. Capping the height and letting the width follow means the
          // element takes the video's own shape, whichever way it was shot.
          className="mt-6 max-h-120 w-auto max-w-full rounded-card bg-night"
        />
      )}

      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        {details.map((d) => (
          <div key={d.label} className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-subtle text-ink-soft">
              <d.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-muted">{d.label}</dt>
              <dd className="text-sm font-medium wrap-break-word">{d.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {creator.content_types.length > 0 && (
        <div className="mt-6">
          <h3 className="font-sans text-sm font-semibold tracking-normal">Content formats</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {creator.content_types.map((t) => (
              <li key={t}>
                <Badge tone="outline" size="lg">
                  {labelFor(CONTENT_TYPES, t)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ProfileSection>
  )
}
