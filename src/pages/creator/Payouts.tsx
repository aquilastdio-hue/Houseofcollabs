import * as React from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowUpRight, Info, Wallet } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatDateTime, formatINR } from '@/lib/format'
import { useAuth } from '@/contexts/auth-context'
import { usePublicSettings } from '@/hooks/use-catalog'
import {
  getEarningsSummary,
  getPayoutMethod,
  listPayoutRequests,
  requestPayout,
  type PayoutRequestWithTransactions,
} from '@/services/earnings.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { PageHeader, SectionTitle } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { CreatorSetupRequired, ListSkeleton } from '@/components/creator-studio/parts'
import { FeatureGateDialog, ResumeBanner, useFeatureGate, useRequirements } from '@/components/creator-studio/feature-gate'
import {
  maskPayoutMethod,
  payoutMethodLabel,
  PayoutMethodForm,
  PayoutMethodSummary,
  snapshotMethod,
} from '@/components/creator-studio/payout-method-form'
import { PAYOUT_STATUS_META, PAYOUT_TXN_STATUS_META } from '@/components/creator-studio/status'
import { PAYOUT_NOTE_MAX } from '@/components/creator-studio/schemas'
import type { EarningsSummary, PayoutMethod } from '@/types'

/**
 * Reasons a withdrawal genuinely can't happen — a balance problem or one
 * already in flight. A missing payout method is *not* here: that is information
 * we simply haven't asked for yet, so the button opens the gate instead of
 * going dead. See `useFeatureGate('withdraw')` below.
 */
function blockedReason(s: EarningsSummary) {
  if (s.open_payout_request) return `You already have a payout of ${formatINR(s.open_payout_request.amount)} in progress.`
  if (s.available <= 0) return 'You don’t have an available balance yet.'
  if (s.available < s.minimum_payout) return `The minimum payout is ${formatINR(s.minimum_payout)} — you have ${formatINR(s.available)} available.`
  return null
}

function PayoutRequestCard({ request }: { request: PayoutRequestWithTransactions }) {
  const meta = PAYOUT_STATUS_META[request.status]
  const snap = snapshotMethod(request.payout_method_snapshot)
  const reference = request.payout_transactions.find((t) => t.provider_reference)?.provider_reference
  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold tabular-nums">{formatINR(request.amount)}</p>
          <p className="text-sm text-muted">Requested {formatDateTime(request.created_at)}</p>
        </div>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs text-faint">Sent to</dt>
          <dd className="truncate">
            {payoutMethodLabel(snap.method_type)} · {maskPayoutMethod(snap)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-faint">Processed</dt>
          <dd>{request.processed_at ? formatDateTime(request.processed_at) : 'Not yet'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-faint">Reference (UTR)</dt>
          <dd className="truncate font-mono text-xs leading-5">{reference ?? '—'}</dd>
        </div>
      </dl>
      {request.notes && (
        <p className="mt-3 text-sm">
          <span className="text-muted">Your note: </span>
          {request.notes}
        </p>
      )}
      {request.admin_note && (
        <p className="mt-3 rounded-control bg-subtle px-3 py-2.5 text-sm">
          <span className="font-medium">From our team: </span>
          {request.admin_note}
        </p>
      )}
      {request.payout_transactions.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-muted">Transfers</p>
          <ul className="divide-y divide-line rounded-control border border-line">
            {request.payout_transactions.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                <span className="font-medium tabular-nums">{formatINR(t.amount)}</span>
                <Badge tone={PAYOUT_TXN_STATUS_META[t.status].tone} size="sm">
                  {PAYOUT_TXN_STATUS_META[t.status].label}
                </Badge>
                <span className="font-mono text-xs text-ink-soft">{t.provider_reference ?? 'Reference pending'}</span>
                <span className="text-xs text-muted">{formatDateTime(t.created_at)}</span>
                {t.failure_reason && <span className="w-full text-xs text-danger">{t.failure_reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

function PayoutMethodCard({ method, loading, error, onRetry, inProgress }: {
  method: PayoutMethod | null | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  inProgress: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Payout method</h2>
          <p className="text-sm text-muted">Where we send your money.</p>
        </div>
        {method && !editing && (
          <Button type="button" variant="secondary" size="sm" disabled={inProgress} onClick={() => setEditing(true)}>
            Change
          </Button>
        )}
      </div>
      {inProgress && (
        <p className="mt-4 flex items-start gap-2 rounded-control bg-info-soft px-3 py-2.5 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          You can change your payout details after the current payout is processed.
        </p>
      )}
      <div className="mt-4">
        {loading ? (
          <Skeleton className="h-20 w-full rounded-card" />
        ) : error ? (
          <ErrorState compact error={error} title="Couldn’t load your payout method" onRetry={onRetry} />
        ) : method && !editing ? (
          <PayoutMethodSummary method={method} />
        ) : (
          <PayoutMethodForm
            method={method ?? null}
            disabled={inProgress}
            onSaved={() => setEditing(false)}
            onCancel={method ? () => setEditing(false) : undefined}
          />
        )}
      </div>
    </Card>
  )
}

export default function Payouts() {
  const { creator } = useAuth()
  const qc = useQueryClient()
  const settings = usePublicSettings()
  const summary = useQuery({ queryKey: qk.earnings.summary, queryFn: getEarningsSummary, enabled: !!creator })
  const method = useQuery({ queryKey: qk.payouts.method, queryFn: () => getPayoutMethod(creator!.id), enabled: !!creator })
  const requests = useQuery({ queryKey: qk.payouts.requests, queryFn: listPayoutRequests, enabled: !!creator })
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [note, setNote] = React.useState('')

  const request = useMutation({
    mutationFn: (notes: string) => requestPayout(notes || undefined),
    onSuccess: async (res) => {
      toast.success('Payout requested', { description: `We’ll send ${formatINR(res.payout_request.amount)} to your account and notify you at each step.` })
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.earnings.all }),
        qc.invalidateQueries({ queryKey: qk.payouts.all }),
        qc.invalidateQueries({ queryKey: qk.dashboard.creator }),
      ])
    },
  })

  const s = summary.data
  const hasMethod = !!method.data || !!s?.has_payout_method
  const reason = s ? blockedReason(s) : null
  const gate = useFeatureGate('withdraw')
  const requirements = useRequirements()
  const inProgress = !!s?.open_payout_request
  const holdDays = Number(settings.data?.earning_hold_days ?? 0)

  return (
    <>
      <Seo title="Payouts" noindex />
      <PageHeader title="Payouts" description="Withdraw your available balance to your UPI ID or bank account." />
      <ResumeBanner satisfied={requirements.data?.payout.configured ?? false} />
      {!creator ? (
        <CreatorSetupRequired />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-8">
            {summary.isPending ? (
              <Skeleton className="h-60 w-full rounded-card" />
            ) : summary.isError ? (
              <ErrorState error={summary.error} title="Couldn’t load your balance" onRetry={() => void summary.refetch()} />
            ) : (
              <Card className="overflow-hidden">
                <div className="bg-night p-5 text-white sm:p-6">
                  <p className="flex items-center gap-2 text-sm text-white/70">
                    <Wallet className="size-4" aria-hidden /> Available to withdraw
                  </p>
                  <p className="mt-1 font-display text-display-md font-semibold tabular-nums">{formatINR(summary.data.available)}</p>
                  <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/70">
                    <div className="flex gap-1.5">
                      <dt>Pending</dt>
                      <dd className="font-medium text-white tabular-nums">{formatINR(summary.data.pending)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>In payout</dt>
                      <dd className="font-medium text-white tabular-nums">{formatINR(summary.data.in_payout)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>Paid out</dt>
                      <dd className="font-medium text-white tabular-nums">{formatINR(summary.data.paid)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <p id="payout-status" className="text-sm text-muted">
                    {reason ??
                      (hasMethod
                        ? `We’ll send your full available balance to your ${method.data ? `${payoutMethodLabel(method.data.method_type)} (${maskPayoutMethod(method.data)})` : 'payout method'}.`
                        : 'We’ll ask where to send it when you request your first payout.')}
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    className="shrink-0"
                    disabled={!!reason || gate.query.isPending}
                    aria-describedby="payout-status"
                    onClick={() => gate.run(() => setConfirmOpen(true))}
                  >
                    <ArrowUpRight /> Request payout
                  </Button>
                </div>
                {summary.data.open_payout_request && (
                  <div className="border-t border-line bg-info-soft/60 px-5 py-3 text-sm text-info sm:px-6">
                    {formatINR(summary.data.open_payout_request.amount)} requested {formatDateTime(summary.data.open_payout_request.created_at)} —{' '}
                    {PAYOUT_STATUS_META[summary.data.open_payout_request.status].label.toLowerCase()}.
                  </div>
                )}
              </Card>
            )}

            <section aria-labelledby="payout-history">
              <SectionTitle title={<span id="payout-history">Payout history</span>} />
              {requests.isPending ? (
                <ListSkeleton rows={3} itemClassName="h-32" />
              ) : requests.isError ? (
                <ErrorState error={requests.error} title="Couldn’t load your payouts" onRetry={() => void requests.refetch()} />
              ) : requests.data.length === 0 ? (
                <EmptyState
                  icon={<Wallet />}
                  title="No payouts yet"
                  description="When you request a payout, you can track its status and transfer reference here."
                />
              ) : (
                <ul className="space-y-3">
                  {requests.data.map((r) => (
                    <PayoutRequestCard key={r.id} request={r} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="min-w-0 space-y-6" aria-label="Payout settings">
            <PayoutMethodCard
              method={method.data}
              loading={method.isPending}
              error={method.error}
              onRetry={() => void method.refetch()}
              inProgress={inProgress}
            />
            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold tracking-tight">Payout policy</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-ink-soft">
                <li>
                  Minimum payout: <span className="font-medium text-ink">{s ? formatINR(s.minimum_payout) : '—'}</span>. Each request withdraws your full available
                  balance.
                </li>
                <li>
                  {holdDays > 0
                    ? `Earnings become withdrawable ${holdDays} day${holdDays === 1 ? '' : 's'} after an order is completed.`
                    : 'Earnings become withdrawable as soon as an order is completed.'}
                </li>
                <li>Our finance team reviews each request and transfers it to your UPI ID or bank account. You’re notified at every step, and the transfer reference appears here once it’s paid.</li>
                <li>You can have one payout in progress at a time, and payout details are locked until it’s processed.</li>
              </ul>
              <Link to="/payout-policy" className="mt-4 inline-flex text-sm font-medium text-ink underline underline-offset-2">
                Read the full payout policy
              </Link>
            </Card>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) setNote('')
        }}
        title={s ? `Request a payout of ${formatINR(s.available)}?` : 'Request a payout?'}
        description={method.data ? `We’ll send it to your ${payoutMethodLabel(method.data.method_type)} · ${maskPayoutMethod(method.data)}.` : undefined}
        confirmLabel="Request payout"
        loading={request.isPending}
        onConfirm={async () => {
          try {
            await request.mutateAsync(note.trim())
            setConfirmOpen(false)
            setNote('')
          } catch {
            // The mutation cache already surfaced the error.
          }
        }}
      >
        <Field label="Note for our team" htmlFor="payout-note" optional hint={`${note.length}/${PAYOUT_NOTE_MAX}`}>
          <Textarea
            id="payout-note"
            rows={3}
            maxLength={PAYOUT_NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything we should know about this payout?"
          />
        </Field>
      </ConfirmDialog>

      <FeatureGateDialog gate={gate} />
    </>
  )
}
