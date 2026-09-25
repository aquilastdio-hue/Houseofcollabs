import * as React from 'react'
import { Link, useLocation } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { checkFeature, type FeatureKey, type Requirement } from '@/lib/feature-requirements'
import { getPayoutMethod } from '@/services/earnings.service'
import { getRequirements } from '@/services/creators.service'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/states'
import { PayoutMethodForm } from './payout-method-form'
import { VerificationForm } from './verification-form'

/** One read of what the creator has, shared by every gate on the page. */
export function useRequirements(enabled = true) {
  const { creator } = useAuth()
  return useQuery({
    queryKey: qk.creators.requirements,
    queryFn: getRequirements,
    enabled: enabled && !!creator,
    staleTime: 30_000,
  })
}

export type FeatureGate = ReturnType<typeof useFeatureGate>

/**
 * Checks whether a creator can use `feature` before letting them start it.
 *
 * `run(action)` calls `action` straight away when nothing is missing. When
 * something is missing it opens a dialog listing only the missing pieces, and
 * runs `action` as soon as they're all satisfied — so the creator lands back
 * on what they set out to do rather than hunting for it again.
 */
export function useFeatureGate(feature: FeatureKey) {
  const query = useRequirements()
  const [open, setOpen] = React.useState(false)
  const pending = React.useRef<(() => void) | null>(null)
  const check = checkFeature(feature, query.data)

  // Requirements are satisfied while the dialog is open — resume immediately.
  React.useEffect(() => {
    if (!open || !check.ready || !pending.current) return
    const action = pending.current
    pending.current = null
    setOpen(false)
    action()
  }, [open, check.ready])

  const run = React.useCallback(
    (action: () => void) => {
      if (query.isPending) return
      if (check.ready) {
        action()
        return
      }
      pending.current = action
      setOpen(true)
    },
    [check.ready, query.isPending],
  )

  const cancel = React.useCallback((next: boolean) => {
    if (!next) pending.current = null
    setOpen(next)
  }, [])

  return { feature, open, setOpen: cancel, run, query, ...check }
}

function RequirementRow({ requirement, onCollect, resumeTo }: { requirement: Requirement; onCollect: () => void; resumeTo: string }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium">{requirement.label}</p>
          <p className="text-sm text-muted">{requirement.description}</p>
        </div>
      </div>
      {requirement.href ? (
        <Button asChild size="sm" variant="secondary" className="shrink-0">
          <Link to={`${requirement.href}${requirement.href.includes('?') ? '&' : '?'}next=${encodeURIComponent(resumeTo)}`}>
            {requirement.cta} <ArrowRight />
          </Link>
        </Button>
      ) : (
        <Button size="sm" variant="secondary" className="shrink-0" onClick={onCollect}>
          {requirement.cta} <ArrowRight />
        </Button>
      )}
    </li>
  )
}

function DoneRow({ requirement }: { requirement: Requirement }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden>
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      <span className="min-w-0 text-sm text-muted">
        {requirement.label}
        <span className="sr-only"> — done</span>
      </span>
    </li>
  )
}

const ICONS: Record<FeatureKey, React.ReactNode> = {
  charges: <Wallet />,
  go_live: <Sparkles />,
  withdraw: <Wallet />,
  verify: <ShieldCheck />,
  campaign: <Sparkles />,
}

/**
 * The dialog half of `useFeatureGate`. Shows only what's missing, collects the
 * two things that shouldn't cost a page change (payout details, verification)
 * in place, and links out for the rest carrying a `?next=` so the creator is
 * brought back.
 */
export function FeatureGateDialog({ gate }: { gate: FeatureGate }) {
  const { creator } = useAuth()
  const qc = useQueryClient()
  const location = useLocation()
  const [collecting, setCollecting] = React.useState<'payout' | 'verification' | null>(null)
  const resumeTo = `${location.pathname}${location.search}`

  const payoutMethod = useQuery({
    queryKey: qk.payouts.method,
    queryFn: () => getPayoutMethod(creator!.id),
    enabled: !!creator && collecting === 'payout',
  })

  React.useEffect(() => {
    if (!gate.open) setCollecting(null)
  }, [gate.open])

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.creators.requirements }),
      qc.invalidateQueries({ queryKey: qk.creators.all }),
      qc.invalidateQueries({ queryKey: qk.payouts.all }),
    ])

  let body: React.ReactNode
  if (gate.query.isPending) {
    body = <Skeleton className="h-40 rounded-card" />
  } else if (gate.query.isError) {
    body = <ErrorState error={gate.query.error} title="Couldn’t check your setup" onRetry={() => void gate.query.refetch()} />
  } else if (collecting === 'payout') {
    body = (
      <PayoutMethodForm
        method={payoutMethod.data ?? null}
        onSaved={() => void refresh().then(() => setCollecting(null))}
        onCancel={() => setCollecting(null)}
      />
    )
  } else if (collecting === 'verification') {
    body = <VerificationForm onSaved={() => void refresh().then(() => setCollecting(null))} onCancel={() => setCollecting(null)} />
  } else {
    body = (
      <>
        <p className="text-sm text-muted">{gate.spec.blurb}</p>
        <ul className="mt-4 divide-y divide-line">
          {gate.done.map((r) => (
            <DoneRow key={r.key} requirement={r} />
          ))}
          {gate.missing.map((r) => (
            <RequirementRow
              key={r.key}
              requirement={r}
              resumeTo={resumeTo}
              onCollect={() => setCollecting(r.key === 'payout' ? 'payout' : 'verification')}
            />
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">We’ll bring you straight back here once this is done.</p>
      </>
    )
  }

  return (
    <Modal
      open={gate.open}
      onOpenChange={gate.setOpen}
      size={collecting ? 'lg' : 'md'}
      title={
        <span className="flex items-center gap-2.5">
          <span className={cn('flex size-9 items-center justify-center rounded-full bg-brand-soft text-brand-ink [&_svg]:size-4')} aria-hidden>
            {ICONS[gate.feature]}
          </span>
          {collecting === 'payout' ? 'Set up your payout account' : collecting === 'verification' ? 'Verify your identity' : gate.spec.title}
        </span>
      }
    >
      {body}
    </Modal>
  )
}

/**
 * Shown on the page a gate sent the creator to. Confirms what they came for and
 * takes them back the moment it's satisfied.
 */
export function ResumeBanner({ satisfied, className }: { satisfied: boolean; className?: string }) {
  const location = useLocation()
  const next = new URLSearchParams(location.search).get('next')
  if (!next || !next.startsWith('/')) return null

  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border p-4',
        satisfied ? 'border-success/30 bg-success-soft' : 'border-brand-strong/30 bg-brand-soft',
        className,
      )}
    >
      <p className={cn('min-w-0 text-sm', satisfied ? 'text-success' : 'text-brand-ink')}>
        {satisfied ? 'All set — you can pick up where you left off.' : 'Finish this and we’ll take you straight back.'}
      </p>
      <Button asChild size="sm" variant={satisfied ? 'primary' : 'secondary'} className="shrink-0">
        <Link to={next}>
          {satisfied ? 'Continue' : 'Go back'} <ArrowRight />
        </Link>
      </Button>
    </div>
  )
}
