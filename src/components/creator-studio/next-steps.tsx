import { Link } from 'react-router'
import { ArrowRight, Image, ShieldCheck, Tags, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REQUIREMENTS, type RequirementKey } from '@/lib/feature-requirements'
import type { CreatorRequirements } from '@/services/creators.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRequirements } from './feature-gate'

/**
 * Feature-by-feature prompts on the dashboard, instead of one long onboarding.
 *
 * Each card is a single thing the creator could unlock next, and disappears the
 * moment it's done. Copy is written as an opportunity, not a demand — none of
 * this blocks them from using the platform.
 */
type Step = {
  key: RequirementKey
  icon: LucideIcon
  title: string
  blurb: string
  href: string
  /** The one that matters most gets the full-width treatment. */
  primary?: boolean
  show?: (r: CreatorRequirements) => boolean
}

const STEPS: Step[] = [
  {
    key: 'services',
    icon: Tags,
    title: 'Set your charges',
    blurb: 'Brands order fixed-price packages. Add one and you’re open for business.',
    href: '/creator/services',
    primary: true,
  },
  {
    key: 'portfolio',
    icon: Image,
    title: 'Show brands your work',
    blurb: 'A few samples make you far easier to shortlist.',
    href: '/creator/portfolio',
  },
  {
    key: 'payout',
    icon: Wallet,
    title: 'Set up payouts',
    blurb: 'Tell us where to send your earnings — we only need this before your first withdrawal.',
    href: '/creator/payouts',
  },
  {
    key: 'verification',
    icon: ShieldCheck,
    title: 'Verify your profile',
    blurb: 'A verified badge tells brands you are who you say you are.',
    href: '/creator/profile',
    // Nothing to chase while a check is already with our team.
    show: (r) => r.verification?.status !== 'pending',
  },
]

function StepCard({ step, primary }: { step: Step; primary: boolean }) {
  const Icon = step.icon
  return (
    <Card
      className={cn(
        'flex flex-col gap-4 p-5',
        primary ? 'border-brand-strong/30 bg-brand-soft sm:flex-row sm:items-center sm:justify-between sm:p-6' : 'sm:p-5',
      )}
    >
      <div className="flex min-w-0 items-start gap-4">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
            primary ? 'bg-brand-gradient text-white shadow-brand' : 'bg-subtle text-ink',
          )}
          aria-hidden
        >
          <Icon />
        </span>
        <div className="min-w-0">
          <h3 className={cn('font-display font-semibold tracking-tight', primary ? 'text-lg text-brand-ink' : 'text-base')}>{step.title}</h3>
          <p className="mt-0.5 text-sm text-ink-soft">{step.blurb}</p>
        </div>
      </div>
      <Button asChild size={primary ? 'lg' : 'sm'} variant={primary ? 'primary' : 'secondary'} className="shrink-0 self-start sm:self-auto">
        <Link to={step.href}>
          {REQUIREMENTS[step.key].cta} <ArrowRight />
        </Link>
      </Button>
    </Card>
  )
}

export function NextStepsCards({ className }: { className?: string }) {
  const query = useRequirements()

  if (query.isPending) return <Skeleton className={cn('h-28 rounded-card', className)} />
  if (query.isError || !query.data?.creator_id) return null

  const data = query.data
  const pendingVerification = data.verification?.status === 'pending'
  const open = STEPS.filter((s) => !REQUIREMENTS[s.key].done(data) && (s.show?.(data) ?? true))

  if (open.length === 0 && !pendingVerification) return null

  const primary = open.find((s) => s.primary)
  const rest = open.filter((s) => s !== primary)

  return (
    <div className={cn('space-y-4', className)}>
      {pendingVerification && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="flex min-w-0 items-center gap-3 text-sm">
            <ShieldCheck className="size-4 shrink-0 text-muted" aria-hidden />
            Your identity check is with our team.
          </span>
          <Badge tone="info" size="sm">
            Verification pending
          </Badge>
        </Card>
      )}
      {primary && <StepCard step={primary} primary />}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {rest.map((s) => (
            <StepCard key={s.key} step={s} primary={false} />
          ))}
        </div>
      )}
    </div>
  )
}
