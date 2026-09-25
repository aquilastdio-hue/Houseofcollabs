import * as React from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, ShieldAlert, Zap } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatDateTime, formatINR, titleCase } from '@/lib/format'
import { processPayout, revealPayoutMethod, type AdminPayoutItem } from '@/services/admin.service'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup } from '@/components/ui/radio-group'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PAYOUT_STATUS_META, PAYOUT_TXN_STATUS_META, StatusBadge } from './admin-status'
import { adminLists } from './admin-keys'
import { ChoiceRow } from './choice'
import { CopyButton, DetailItem, DetailList, IdText } from './detail'
import { Notice } from './form-dialog'
import { PayoutMethodSummary, linkedEarnings, readPayoutSnapshot } from './payout-parts'
import { useAdminMutation } from './use-admin-mutation'

type PayoutAction = 'processing' | 'paid' | 'failed' | 'rejected' | 'razorpayx'

const ACTIONS: { value: PayoutAction; title: string; description: string; from: string[] }[] = [
  { value: 'paid', title: 'Mark paid', description: 'You sent the money manually. Add the bank UTR / UPI reference.', from: ['pending', 'processing'] },
  { value: 'processing', title: 'Mark processing', description: 'Transfer started but not confirmed yet. Reference optional.', from: ['pending'] },
  { value: 'razorpayx', title: 'Send via RazorpayX', description: 'Creates the payout through RazorpayX. Works only when RazorpayX is configured on the server.', from: ['pending'] },
  { value: 'failed', title: 'Mark failed', description: 'The transfer bounced or was reversed. Earnings return to the creator’s balance.', from: ['pending', 'processing'] },
  { value: 'rejected', title: 'Reject request', description: 'Decline the request (e.g. suspicious activity). Earnings return to the balance.', from: ['pending', 'processing'] },
]

const schema = z
  .object({
    action: z.enum(['processing', 'paid', 'failed', 'rejected', 'razorpayx']),
    reference: z.string().trim().max(100, 'Keep it under 100 characters'),
    note: z.string().trim().max(500, 'Keep it under 500 characters'),
  })
  .superRefine((v, ctx) => {
    if (v.action === 'paid' && v.reference.length < 3) ctx.addIssue({ code: 'custom', path: ['reference'], message: 'Add the transfer reference (UTR / UPI ref)' })
    if ((v.action === 'failed' || v.action === 'rejected') && v.note.length < 3) ctx.addIssue({ code: 'custom', path: ['note'], message: 'Add a note — the creator sees it' })
  })
type Values = z.infer<typeof schema>

type Revealed = Awaited<ReturnType<typeof revealPayoutMethod>>

function RevealRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate font-mono text-sm">{value}</span>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </span>
    </div>
  )
}

/** Payout review + processing: audited reveal of full details, then a status action. */
export function PayoutDialog({ payout, onClose }: { payout: AdminPayoutItem | null; onClose: () => void }) {
  const [revealed, setRevealed] = React.useState<Revealed | null>(null)
  const open = !!payout
  const status = payout?.status ?? 'pending'
  const available = ACTIONS.filter((a) => a.from.includes(status))
  const closed = available.length === 0

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { action: 'paid', reference: '', note: '' } })
  const action = form.watch('action')
  const e = form.formState.errors

  React.useEffect(() => {
    setRevealed(null)
    form.reset({ action: 'paid', reference: '', note: '' })
  }, [payout?.id, form])

  const reveal = useMutation({ mutationFn: (id: string) => revealPayoutMethod(id), onSuccess: setRevealed })
  const process = useAdminMutation((v: Values & { id: string }) => processPayout({ payout_request_id: v.id, action: v.action, reference: v.reference || undefined, note: v.note || undefined }), {
    invalidate: [adminLists.payouts, qk.admin.stats],
    success: (_d, v) =>
      v.action === 'paid' ? 'Payout marked paid' : v.action === 'processing' ? 'Payout marked processing' : v.action === 'razorpayx' ? 'Payout sent to RazorpayX' : v.action === 'failed' ? 'Payout marked failed' : 'Payout request rejected',
    onSuccess: onClose,
  })

  if (!payout) return null
  const snapshot = readPayoutSnapshot(payout.payout_method_snapshot)
  const earnings = linkedEarnings(payout)
  const txns = [...(payout.payout_transactions ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const busy = process.isPending
  const onSubmit = form.handleSubmit((v) => process.mutate({ ...v, id: payout.id }))
  const current = ACTIONS.find((a) => a.value === action)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{closed ? 'Payout details' : 'Process payout'}</DialogTitle>
          <DialogDescription>
            {formatINR(payout.amount, { precise: true })} requested {formatDateTime(payout.created_at)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <DialogBody className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line p-3">
              {payout.creator ? (
                <Link to={`/admin/creators/${payout.creator.id}`} className="focus-ring flex min-w-0 items-center gap-3 rounded-control" onClick={onClose}>
                  <Avatar src={payout.creator.profile_image_url} name={payout.creator.display_name} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium hover:underline">{payout.creator.display_name}</span>
                    <span className="block text-xs text-muted">@{payout.creator.slug}</span>
                  </span>
                </Link>
              ) : (
                <span className="text-sm text-muted">Creator unavailable</span>
              )}
              <span className="flex items-center gap-2">
                <span className="font-display text-xl font-semibold tabular-nums">{formatINR(payout.amount, { precise: true })}</span>
                <StatusBadge meta={PAYOUT_STATUS_META} value={payout.status} />
              </span>
            </div>

            <DetailList>
              <DetailItem label="Method on file (masked)">
                <PayoutMethodSummary snapshot={snapshot} />
              </DetailItem>
              <DetailItem label="Linked earnings">
                {earnings.count > 0 ? `${earnings.count} order${earnings.count === 1 ? '' : 's'} · ${formatINR(earnings.amount, { precise: true })}` : 'None linked'}
              </DetailItem>
              {payout.notes && (
                <DetailItem label="Creator note" className="sm:col-span-2">
                  <span className="whitespace-pre-line">{payout.notes}</span>
                </DetailItem>
              )}
              {payout.admin_note && (
                <DetailItem label="Admin note" className="sm:col-span-2">
                  <span className="whitespace-pre-line">{payout.admin_note}</span>
                </DetailItem>
              )}
              {payout.processed_at && <DetailItem label="Processed">{formatDateTime(payout.processed_at)}</DetailItem>}
              <DetailItem label="Request id">
                <IdText value={payout.id} />
              </DetailItem>
            </DetailList>

            {(payout.creator_earnings ?? []).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-faint">Orders covered</p>
                <ul className="flex flex-wrap gap-1.5">
                  {(payout.creator_earnings ?? []).map((er) => (
                    <li key={er.id}>
                      <Link to={`/admin/orders/${er.order_id}`} onClick={onClose} className="focus-ring inline-flex items-center gap-1 rounded-pill border border-line px-2.5 py-1 text-xs hover:border-line-strong hover:bg-subtle">
                        {formatINR(er.net_amount, { precise: true })}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!closed && (
              <section aria-labelledby="payout-reveal" className="rounded-control border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="payout-reveal" className="text-sm font-semibold">
                    Full payout details
                  </h3>
                  {!revealed && (
                    <Button type="button" variant="secondary" size="xs" loading={reveal.isPending} onClick={() => reveal.mutate(payout.id)}>
                      {!reveal.isPending && <Eye />} Reveal payout details
                    </Button>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-warning">
                  <ShieldAlert className="size-3.5 shrink-0" aria-hidden /> Revealing the full account number or UPI id is recorded in the audit log.
                </p>
                {revealed && (
                  <div className="mt-3 divide-y divide-line rounded-control bg-subtle px-3">
                    <RevealRow label="Method" value={titleCase(revealed.method_type)} />
                    <RevealRow label="Account holder" value={revealed.account_holder_name} />
                    <RevealRow label="UPI id" value={revealed.upi_id} />
                    <RevealRow label="Account number" value={revealed.bank_account_number} />
                    <RevealRow label="IFSC" value={revealed.ifsc_code} />
                    <RevealRow label="Bank" value={revealed.bank_name} />
                  </div>
                )}
                {revealed && snapshot.methodType && revealed.method_type !== snapshot.methodType && (
                  <Notice tone="warning" className="mt-3">
                    The creator changed their payout method after requesting this payout. Confirm with them before sending money.
                  </Notice>
                )}
              </section>
            )}

            {txns.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-faint">Transactions</p>
                <ul className="divide-y divide-line rounded-control border border-line">
                  {txns.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <StatusBadge meta={PAYOUT_TXN_STATUS_META} value={t.status} size="sm" />
                          <span className="text-muted">{titleCase(t.provider)}</span>
                          <span className="tabular-nums">{formatINR(t.amount, { precise: true })}</span>
                        </p>
                        {t.provider_reference && <IdText value={t.provider_reference} className="mt-1" />}
                        {t.failure_reason && <p className="mt-1 text-xs text-danger">{t.failure_reason}</p>}
                      </div>
                      <span className="text-xs text-faint">{formatDateTime(t.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {closed ? (
              <Notice tone="info">This payout is {PAYOUT_STATUS_META[payout.status].label.toLowerCase()} — no further actions are available.</Notice>
            ) : (
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm font-semibold">Action</legend>
                <RadioGroup value={action} onValueChange={(v) => form.setValue('action', v as PayoutAction, { shouldValidate: form.formState.isSubmitted })} aria-label="Payout action">
                  {available.map((a) => (
                    <ChoiceRow
                      key={a.value}
                      id={`payout-${a.value}`}
                      value={a.value}
                      checked={action === a.value}
                      title={a.title}
                      description={a.description}
                      icon={a.value === 'razorpayx' ? <Zap aria-hidden /> : undefined}
                    />
                  ))}
                </RadioGroup>
                {(action === 'paid' || action === 'processing') && (
                  <Field
                    label={action === 'paid' ? 'Transfer reference' : 'Reference'}
                    htmlFor="payout-reference"
                    required={action === 'paid'}
                    optional={action === 'processing'}
                    error={e.reference?.message}
                    hint="Bank UTR, UPI transaction id or payout id."
                  >
                    <Input id="payout-reference" autoComplete="off" maxLength={100} {...form.register('reference')} />
                  </Field>
                )}
                <Field
                  label={action === 'failed' || action === 'rejected' ? 'Note for the creator' : 'Note'}
                  htmlFor="payout-note"
                  required={action === 'failed' || action === 'rejected'}
                  optional={!(action === 'failed' || action === 'rejected')}
                  error={e.note?.message}
                >
                  <Textarea id="payout-note" rows={2} maxLength={500} {...form.register('note')} />
                </Field>
              </fieldset>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              {closed ? 'Close' : 'Cancel'}
            </Button>
            {!closed && current && (
              <Button type="submit" variant={action === 'failed' || action === 'rejected' ? 'danger' : 'primary'} loading={busy}>
                {current.title}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
