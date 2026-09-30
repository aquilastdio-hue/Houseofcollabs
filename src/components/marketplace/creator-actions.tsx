import * as React from 'react'
import { Clock3, GitCompareArrows, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDays, formatINR } from '@/lib/format'
import { RESPONSE_TIMES, labelFor } from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'
import { useCompare } from '@/contexts/compare-context'
import type { CreatorProfile } from '@/services/creators.service'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { SaveButton } from './save-button'
import { ReportButton } from './report-dialog'
import { SendBriefButton } from './send-brief-dialog'
import { firstName, isListed, scrollToSection, type ProfileMode } from './profile-utils'

/**
 * What the current viewer may do on a creator profile. Security lives in the
 * database; this only decides which actions to offer and why others are off.
 */
export function useCreatorAccess(creator: CreatorProfile) {
  const { session, role, user, profileLoading } = useAuth()
  const isOwner = !!user && user.id === creator.profile_id
  const isBrand = role === 'brand'
  const listed = isListed(creator)
  const name = firstName(creator.display_name)

  let blocked: string | null = null
  if (session) {
    if (profileLoading) blocked = 'Loading your account…'
    else if (isOwner) blocked = 'This is your own storefront.'
    else if (!role) blocked = 'Finish setting up your account to hire creators.'
    else if (!isBrand) blocked = 'Only brand accounts can hire creators.'
    else if (!listed) blocked = `${name}’s storefront isn’t live right now.`
  }
  const hireBlocked = blocked ?? (!creator.available || !listed ? `${name} isn’t taking new orders right now.` : null)

  return {
    signedIn: !!session,
    isOwner,
    isBrand,
    listed,
    /** Why brand-only actions (message, brief) are unavailable for a signed-in viewer. */
    blocked,
    /** Why ordering is unavailable (busy creator, wrong account type…). */
    hireBlocked,
    /** Brand tools: compare, send a brief. */
    brandTools: isBrand && listed && !isOwner,
    /** Guests see a sign-up prompt; brands get the wishlist picker. */
    canSave: listed && !isOwner && (!session || isBrand),
    canReport: !!session && !isOwner,
  }
}

/** Disabled control with a visible (hover/focus) and screen-reader explanation. */
export function WithReason({ reason, className, children }: { reason: string; className?: string; children: React.ReactNode }) {
  return (
    <Tooltip content={reason}>
      <span tabIndex={0} className={cn('focus-ring inline-flex rounded-pill', className)}>
        {children}
        <span className="sr-only">{reason}</span>
      </span>
    </Tooltip>
  )
}

type ActionButtonProps = { creator: CreatorProfile; size?: ButtonProps['size']; block?: boolean; className?: string }

/** Jumps to the services list, where each package has its own hire button. */
export function HireButton({ creator, size, block, className }: ActionButtonProps) {
  const access = useCreatorAccess(creator)
  return (
    <Button size={size} block={block} className={className} onClick={() => scrollToSection('services')}>
      {access.hireBlocked ? 'See services' : 'Hire'}
    </Button>
  )
}

export function CompareButton({ creator, size, block, className }: ActionButtonProps) {
  const { has, toggle } = useCompare()
  const active = has(creator.id)
  return (
    <Button
      variant={active ? 'accent' : 'secondary'}
      size={size}
      block={block}
      className={className}
      aria-pressed={active}
      onClick={() => toggle({ id: creator.id, name: creator.display_name, image: creator.profile_image_url })}
    >
      <GitCompareArrows /> {active ? 'Comparing' : 'Compare'}
    </Button>
  )
}

function StartingPrice({ creator, className }: { creator: CreatorProfile; className?: string }) {
  return creator.starting_price != null ? (
    <p className={cn('font-display font-semibold tabular-nums', className)}>{formatINR(creator.starting_price)}</p>
  ) : (
    <p className="font-medium text-muted">No services yet</p>
  )
}

/** Desktop sticky aside. */
export function CreatorActionCard({ creator }: { creator: CreatorProfile }) {
  const access = useCreatorAccess(creator)
  const response = labelFor(RESPONSE_TIMES, creator.response_time)

  return (
    <div className="rounded-panel border border-line bg-surface p-5 shadow-card">
      <p className="text-sm text-muted">Starting at</p>
      <StartingPrice creator={creator} className="mt-0.5 text-3xl" />
      <ul className="mt-4 space-y-2 text-sm text-ink-soft">
        <li className="flex items-center gap-2">
          <span className={cn('size-2 shrink-0 rounded-full', creator.available ? 'bg-success' : 'bg-faint')} aria-hidden />
          {creator.available ? 'Available for new orders' : 'Busy — not taking new orders'}
        </li>
        {creator.fastest_delivery_days != null && (
          <li className="flex items-center gap-2">
            <Clock3 className="size-4 shrink-0 text-muted" aria-hidden /> Delivery from {formatDays(creator.fastest_delivery_days)}
          </li>
        )}
        {response && (
          <li className="flex items-center gap-2">
            <Timer className="size-4 shrink-0 text-muted" aria-hidden /> Usually replies {response.toLowerCase()}
          </li>
        )}
      </ul>

      <div className="mt-5 flex flex-col gap-2">
        <HireButton creator={creator} size="lg" block />
        {(access.canSave || access.brandTools) && (
          <div className={cn('grid gap-2', access.brandTools && 'grid-cols-2')}>
            {access.canSave && <SaveButton creatorId={creator.id} variant="button" className="w-full" />}
            {access.brandTools && <CompareButton creator={creator} block />}
          </div>
        )}
        {access.brandTools && <SendBriefButton creator={creator} variant="ghost" block />}
      </div>

      {access.canReport && (
        <div className="mt-4 flex justify-center border-t border-line pt-3">
          <ReportButton creatorId={creator.id} creatorName={creator.display_name} size="xs" className="text-muted" />
        </div>
      )}
    </div>
  )
}

/** Secondary actions shown under the hero below `lg` (the sticky bar carries Hire + Message). */
export function CreatorQuickActions({ creator }: { creator: CreatorProfile }) {
  const access = useCreatorAccess(creator)
  if (!access.canSave && !access.brandTools && !access.canReport) return null
  return (
    <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
      {access.canSave && <SaveButton creatorId={creator.id} variant="button" />}
      {access.brandTools && <CompareButton creator={creator} />}
      {access.brandTools && <SendBriefButton creator={creator} />}
      {access.canReport && <ReportButton creatorId={creator.id} creatorName={creator.display_name} size="md" className="text-muted" />}
    </div>
  )
}

/**
 * Mobile/tablet sticky CTA. It is `sticky` (not fixed) as the last child of the
 * profile, so it stops at the end of the profile instead of covering the footer.
 * In the brand app it sits above the bottom tab bar and the compare tray.
 */
export function CreatorMobileBar({ creator, mode }: { creator: CreatorProfile; mode: ProfileMode }) {
  const { items } = useCompare()
  const offset =
    mode === 'brand'
      ? items.length > 0
        ? 'bottom-[max(8.75rem,calc(4.25rem+env(safe-area-inset-bottom)))] md:bottom-[5.25rem]'
        : 'bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-0'
      : 'bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'

  return (
    <div className={cn('sticky z-20 -mx-gutter mt-12 border-t border-line bg-surface/95 px-gutter py-3 backdrop-blur-md lg:hidden', offset)}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Starting at</p>
          <StartingPrice creator={creator} className="truncate text-lg" />
        </div>
        <HireButton creator={creator} />
      </div>
    </div>
  )
}
