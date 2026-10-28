import { Link } from 'react-router'
import { CalendarClock, Check, ChevronRight, ExternalLink, Gift, IndianRupee, Megaphone, MapPin, Tag, Users, X } from 'lucide-react'
import { cn, range } from '@/lib/utils'
import { formatCompact, formatDate, formatINR, formatRelative } from '@/lib/format'
import { PLATFORMS, labelFor } from '@/lib/constants'
import type { ApplicationStatus, Campaign, CampaignMatch, CampaignStatus, CreatorCampaign } from '@/services/campaigns.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionCard } from '@/components/brand/section-card'

// ---------------------------------------------------------------- status --

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_review: { label: 'In review', tone: 'warning' },
  live: { label: 'Live', tone: 'success' },
  rejected: { label: 'Needs changes', tone: 'danger' },
  closed: { label: 'Closed', tone: 'outline' },
}

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Applied', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Not selected', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'outline' },
}

export function CampaignStatusBadge({ status, size = 'md' }: { status: CampaignStatus; size?: 'sm' | 'md' }) {
  const m = CAMPAIGN_STATUS_META[status]
  return (
    <Badge tone={m.tone} size={size}>
      {m.label}
    </Badge>
  )
}

export function ApplicationStatusBadge({ status, size = 'md' }: { status: ApplicationStatus; size?: 'sm' | 'md' }) {
  const m = APPLICATION_STATUS_META[status]
  return (
    <Badge tone={m.tone} size={size}>
      {m.label}
    </Badge>
  )
}

// --------------------------------------------------------------- wording --

/** "₹8,000 per creator + product", "₹8,000 per creator", "Product (barter)". */
export function compensationText(c: Pick<Campaign, 'compensation' | 'fee_per_creator'>) {
  const fee = c.fee_per_creator != null ? `${formatINR(c.fee_per_creator)} per creator` : 'Paid'
  if (c.compensation === 'paid') return fee
  if (c.compensation === 'barter') return 'Product (barter)'
  return `${fee} + product`
}

export function followersText(c: Pick<Campaign, 'min_followers' | 'max_followers'>) {
  const { min_followers: min, max_followers: max } = c
  if (min != null && max != null) return `${formatCompact(min)}–${formatCompact(max)} followers`
  if (min != null) return `${formatCompact(min)}+ followers`
  if (max != null) return `Up to ${formatCompact(max)} followers`
  return 'Any follower count'
}

export function isApplyClosed(c: Pick<Campaign, 'apply_by' | 'status'>) {
  if (c.status !== 'live') return true
  if (!c.apply_by) return false
  return c.apply_by < new Date().toISOString().slice(0, 10)
}

// ----------------------------------------------------------------- match --

/** Requirement-by-requirement, so a creator (or brand) sees exactly what fits. */
export function MatchList({ campaign, match }: { campaign: Campaign; match: CampaignMatch | null }) {
  if (!match) return null
  const rows = [
    { ok: match.category, label: campaign.categories.length ? campaign.categories.map((c) => c.name).join(', ') : 'Any category' },
    { ok: match.followers, label: followersText(campaign) },
    { ok: match.city, label: campaign.cities.length ? campaign.cities.join(', ') : 'Any city' },
  ]
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex items-start gap-2">
          {r.ok ? (
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Matches" />
          ) : (
            <X className="mt-0.5 size-4 shrink-0 text-faint" aria-label="Doesn’t match" />
          )}
          <span className={cn(!r.ok && 'text-muted')}>{r.label}</span>
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------------ card --

/** One row in any campaigns list; links to the detail page for that dashboard. */
export function CampaignCard({ campaign, perspective }: { campaign: Campaign | CreatorCampaign; perspective: 'creator' | 'brand' | 'admin' }) {
  const c = campaign as CreatorCampaign
  const closed = isApplyClosed(campaign)
  return (
    <Link
      to={`/${perspective}/campaigns/${campaign.id}`}
      className="group focus-ring flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition-[box-shadow,border-color] duration-300 hover:border-line-strong hover:shadow-card-hover sm:p-5 md:flex-row md:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <Avatar src={campaign.brand.logo} name={campaign.brand.name} size="lg" shape="rounded" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate font-medium">{campaign.title}</p>
            {perspective !== 'creator' && <CampaignStatusBadge status={campaign.status} size="sm" />}
            {perspective === 'creator' && c.invited && (
              <Badge tone="brand" size="sm">
                Invited
              </Badge>
            )}
            {perspective === 'creator' && c.my_application && <ApplicationStatusBadge status={c.my_application.status} size="sm" />}
            {perspective === 'creator' && !c.my_application && c.match?.matches && (
              <Badge tone="success" size="sm">
                Good match
              </Badge>
            )}
          </div>
          <p className="truncate text-sm text-muted">{campaign.brand.name}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <li className="inline-flex items-center gap-1">
              {campaign.compensation === 'barter' ? <Gift className="size-3.5" aria-hidden /> : <IndianRupee className="size-3.5" aria-hidden />}
              {compensationText(campaign)}
            </li>
            <li className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              {campaign.creators_needed} {campaign.creators_needed === 1 ? 'creator' : 'creators'}
            </li>
            <li className={cn('inline-flex items-center gap-1', closed && campaign.status === 'live' && 'text-danger')}>
              <CalendarClock className="size-3.5" aria-hidden />
              {campaign.apply_by ? `Apply by ${formatDate(campaign.apply_by)}` : 'No deadline'}
            </li>
            {perspective !== 'creator' && (
              <li>
                {campaign.applications.total} applied · {campaign.applications.accepted} accepted
              </li>
            )}
            {perspective === 'admin' && campaign.submitted_at && <li>Submitted {formatRelative(campaign.submitted_at)}</li>}
          </ul>
        </div>
      </div>
      <ChevronRight className="hidden size-5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 md:block" aria-hidden />
    </Link>
  )
}

export function CampaignListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="space-y-3" aria-hidden>
      {range(count).map((i) => (
        <li key={i} className="flex items-start gap-3.5 rounded-card border border-line bg-surface p-4 sm:p-5">
          <Skeleton className="size-12 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-4 w-2/3 max-w-80" />
            <Skeleton className="h-3 w-1/3 max-w-40" />
            <Skeleton className="h-3 w-3/4 max-w-96" />
          </div>
        </li>
      ))}
    </ul>
  )
}

// -------------------------------------------------------------- overview --

function Item({ icon: Icon, label, children }: { icon: typeof Tag; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-subtle text-ink-soft" aria-hidden>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  )
}

/** The whole campaign, as every dashboard shows it. */
export function CampaignOverview({ campaign, aside }: { campaign: Campaign; aside?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionCard title="The brief">
        <p className="text-sm whitespace-pre-line text-ink-soft">{campaign.brief}</p>
      </SectionCard>

      <SectionCard title="What creators will make">
        <p className="text-sm whitespace-pre-line text-ink-soft">{campaign.deliverables}</p>
        {campaign.platforms.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {campaign.platforms.map((p) => (
              <Badge key={p} tone="neutral" size="sm">
                {labelFor(PLATFORMS, p) || p}
              </Badge>
            ))}
          </div>
        )}
        {campaign.reference_links.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm">
            {campaign.reference_links.map((href) => (
              <li key={href}>
                <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1.5 text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                  <span className="truncate">{href.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="size-3.5 shrink-0 text-faint" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Item icon={campaign.compensation === 'barter' ? Gift : IndianRupee} label="Payment">
            {compensationText(campaign)}
            {campaign.compensation !== 'paid' && campaign.barter_details && (
              <p className="mt-0.5 text-xs font-normal text-muted">{campaign.barter_details}</p>
            )}
          </Item>
          <Item icon={Users} label="Creators needed">
            {campaign.creators_needed}
          </Item>
          <Item icon={CalendarClock} label="Apply by">
            {campaign.apply_by ? formatDate(campaign.apply_by) : 'No deadline'}
          </Item>
          <Item icon={Megaphone} label="Who it’s for">
            {campaign.categories.length ? campaign.categories.map((c) => c.name).join(', ') : 'Any category'}
            <p className="mt-0.5 text-xs font-normal text-muted">{followersText(campaign)}</p>
          </Item>
          <Item icon={MapPin} label="Cities">
            {campaign.cities.length ? campaign.cities.join(', ') : 'Anywhere'}
          </Item>
        </div>
      </SectionCard>
      {aside}
    </div>
  )
}

/** Brand name + logo header used at the top of every campaign page. */
export function CampaignBrandLine({ campaign }: { campaign: Campaign }) {
  return (
    <span className="flex items-center gap-2 text-sm text-muted">
      <Avatar src={campaign.brand.logo} name={campaign.brand.name} size="xs" shape="rounded" />
      {campaign.brand.name}
    </span>
  )
}
