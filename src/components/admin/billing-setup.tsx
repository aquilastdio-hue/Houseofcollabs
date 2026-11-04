import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { GST_STATES, cleanId, gstinProblem, isValidPan } from '@/lib/gst'
import { listSettings, updateSetting } from '@/services/admin.service'
import { deleteTaxRate, getBillingEntity, listTaxRates, saveBillingEntity, saveTaxRate, type BillingEntity, type TaxRate } from '@/services/billing.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SwitchRow } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/states'
import { SectionCard } from '@/components/brand/section-card'
import { FormDialog, Notice } from '@/components/admin/form-dialog'
import { istToday } from './billing-overview'

export const TAX_CODES: Record<string, { label: string; unit: 'rate' | 'limit'; hint: string }> = {
  gst_hoc_services: { label: 'GST on HOC commissions', unit: 'rate', hint: 'Charged to brands and creators on our commission.' },
  gst_creator_services: { label: 'GST on creator fees', unit: 'rate', hint: 'For GST-registered creators; passed on to them.' },
  tds_194o: { label: 'TDS, s.194-O', unit: 'rate', hint: 'Income tax withheld from creators with a PAN.' },
  tds_194o_no_pan: { label: 'TDS without PAN', unit: 'rate', hint: 'When the creator hasn’t given a PAN.' },
  tds_194o_exemption_limit: { label: 'TDS exemption limit', unit: 'limit', hint: 'Individuals / HUF with a PAN: no TDS while their year’s total stays within this.' },
  tcs_gst_52: { label: 'GST TCS, s.52', unit: 'rate', hint: 'Collected from GST-registered creators.' },
}

/** The rate in force today for each code (rows come newest first per code). */
function currentIds(rates: TaxRate[]) {
  const today = istToday()
  const seen = new Set<string>()
  const ids = new Set<string>()
  for (const r of rates) {
    if (r.effective_from <= today && !seen.has(r.code)) {
      seen.add(r.code)
      ids.add(r.id)
    }
  }
  return ids
}

export function BillingSetup() {
  return (
    <div className="space-y-6">
      <BillingSwitch />
      <BusinessDetails />
      <TaxRates />
    </div>
  )
}

function BillingSwitch() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: qk.admin.settings, queryFn: listSettings })
  const entity = useQuery({ queryKey: qk.billing.entity, queryFn: getBillingEntity })
  const on = settings.data?.find((s) => s.key === 'billing_v2_enabled')?.value === true
  const [confirm, setConfirm] = React.useState<boolean | null>(null)
  const toggle = useMutation({
    mutationFn: (value: boolean) => updateSetting('billing_v2_enabled', value),
    meta: { successMessage: 'Billing setting saved' },
    onSuccess: () => {
      setConfirm(null)
      void queryClient.invalidateQueries({ queryKey: qk.admin.settings })
      void queryClient.invalidateQueries({ queryKey: qk.billing.all })
    },
  })
  const missing = entity.data && !entity.data.gstin

  return (
    <SectionCard title="New billing" description="GST on orders, TDS and TCS, automatic invoices and a separate creator commission invoice.">
      {missing && (
        <Notice tone="warning" className="mb-4">
          Add HOC’s GSTIN below before switching this on. Commission invoices must carry it.
        </Notice>
      )}
      <SwitchRow
        id="billing_v2_enabled"
        label={on ? 'On for every new order' : 'Off (test accounts only)'}
        description="Orders already placed keep the maths they were priced with. Test accounts always use the new billing, so you can try it first."
        checked={on}
        disabled={settings.isPending || toggle.isPending}
        onCheckedChange={(v) => setConfirm(v)}
      />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? 'Turn on new billing for everyone?' : 'Turn new billing off?'}
        description={
          confirm
            ? 'From now on brands pay GST on top (creator GST if registered, and GST on the commission). Creators get their fee minus TDS and TCS, and receive a separate commission invoice. Make sure your CA has reviewed the rates and your business details.'
            : 'New orders go back to the old maths: commission taken out of the creator’s price, no GST invoices. Orders already placed keep their billing.'
        }
        confirmLabel={confirm ? 'Turn on' : 'Turn off'}
        reasonRequired={false}
        loading={toggle.isPending}
        onConfirm={() => toggle.mutate(!!confirm)}
      />
    </SectionCard>
  )
}

const STATES = GST_STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))

function BusinessDetails() {
  const queryClient = useQueryClient()
  const q = useQuery({ queryKey: qk.billing.entity, queryFn: getBillingEntity })
  if (q.isError) return <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data) return null
  return <BusinessForm key={q.data.updated_at} entity={q.data} onSaved={() => void queryClient.invalidateQueries({ queryKey: qk.billing.all })} />
}

function BusinessForm({ entity, onSaved }: { entity: BillingEntity; onSaved: () => void }) {
  const [v, setV] = React.useState(entity)
  const set = (patch: Partial<BillingEntity>) => setV((cur) => ({ ...cur, ...patch }))
  const gstinError = v.gstin ? gstinProblem(v.gstin, { stateCode: v.state_code, pan: v.pan ?? undefined }) : null
  const panError = v.pan && !isValidPan(v.pan) ? 'A PAN is 10 characters, like ABCDE1234F.' : null
  const tanError = v.tan && !/^[A-Z]{4}[0-9]{5}[A-Z]$/.test(cleanId(v.tan)) ? 'A TAN is 10 characters, like DELA12345B.' : null
  const save = useMutation({
    mutationFn: () =>
      saveBillingEntity({
        ...v,
        gstin: cleanId(v.gstin) || null,
        pan: cleanId(v.pan) || null,
        tan: cleanId(v.tan) || null,
      }),
    meta: { successMessage: 'Business details saved' },
    onSuccess: onSaved,
  })
  const dirty = JSON.stringify(v) !== JSON.stringify(entity)

  return (
    <SectionCard title="HOC’s business details" description="Printed as the supplier on every commission invoice, credit note and settlement statement.">
      <form
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!gstinError && !panError && !tanError) save.mutate()
        }}
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Legal name" htmlFor="be-name" required>
            <Input id="be-name" value={v.legal_name} onChange={(e) => set({ legal_name: e.target.value })} />
          </Field>
          <Field label="Trade name" htmlFor="be-trade" optional>
            <Input id="be-trade" value={v.trade_name ?? ''} onChange={(e) => set({ trade_name: e.target.value })} />
          </Field>
          <Field label="GSTIN" htmlFor="be-gstin" error={gstinError ?? undefined}>
            <Input id="be-gstin" className="uppercase" value={v.gstin ?? ''} onChange={(e) => set({ gstin: e.target.value })} placeholder="07ABCDE1234F1Z5" />
          </Field>
          <Field label="State" htmlFor="be-state" required>
            <Select id="be-state" value={v.state_code} onValueChange={(s) => set({ state_code: s })} options={STATES} />
          </Field>
          <Field label="PAN" htmlFor="be-pan" error={panError ?? undefined}>
            <Input id="be-pan" className="uppercase" value={v.pan ?? ''} onChange={(e) => set({ pan: e.target.value })} />
          </Field>
          <Field label="TAN" htmlFor="be-tan" hint="For depositing TDS." error={tanError ?? undefined}>
            <Input id="be-tan" className="uppercase" value={v.tan ?? ''} onChange={(e) => set({ tan: e.target.value })} />
          </Field>
        </div>
        <Field label="Address" htmlFor="be-address">
          <Textarea id="be-address" rows={2} value={v.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
          <Field label="City" htmlFor="be-city" className="sm:col-span-2">
            <Input id="be-city" value={v.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="PIN code" htmlFor="be-pin">
            <Input id="be-pin" inputMode="numeric" maxLength={6} value={v.pincode ?? ''} onChange={(e) => set({ pincode: e.target.value })} />
          </Field>
          <Field label="Phone" htmlFor="be-phone">
            <Input id="be-phone" value={v.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Email on invoices" htmlFor="be-email" className="sm:col-span-2">
            <Input id="be-email" type="email" value={v.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="SAC: commission" htmlFor="be-sac" hint="Confirm with your CA.">
            <Input id="be-sac" inputMode="numeric" value={v.commission_sac} onChange={(e) => set({ commission_sac: e.target.value })} />
          </Field>
          <Field label="SAC: creator work" htmlFor="be-sac2" hint="On creators’ invoices.">
            <Input id="be-sac2" inputMode="numeric" value={v.creator_service_sac} onChange={(e) => set({ creator_service_sac: e.target.value })} />
          </Field>
        </div>
        <Field label="Note at the foot of HOC’s documents" htmlFor="be-note" optional>
          <Textarea id="be-note" rows={2} value={v.invoice_note ?? ''} onChange={(e) => set({ invoice_note: e.target.value })} placeholder="e.g. bank details, terms" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={!dirty || save.isPending} onClick={() => setV(entity)}>
            Discard changes
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!dirty || !!gstinError || !!panError || !!tanError}>
            {!save.isPending && <Save />} Save details
          </Button>
        </div>
        {entity.updated_at && <p className="text-right text-xs text-muted">Last saved {formatDate(entity.updated_at)}</p>}
      </form>
    </SectionCard>
  )
}

function TaxRates() {
  const queryClient = useQueryClient()
  const rates = useQuery({ queryKey: qk.billing.rates, queryFn: listTaxRates })
  const [adding, setAdding] = React.useState<{ code: string; rate: string; threshold: string; effective_from: string; note: string } | null>(null)
  const [removing, setRemoving] = React.useState<TaxRate | null>(null)
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: qk.billing.all })
  const add = useMutation({
    mutationFn: () =>
      saveTaxRate({
        code: adding!.code,
        rate: Number(adding!.rate || 0),
        threshold: adding!.threshold === '' ? null : Number(adding!.threshold),
        effective_from: adding!.effective_from,
        note: adding!.note || undefined,
      }),
    meta: { successMessage: 'Rate saved' },
    onSuccess: () => {
      setAdding(null)
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteTaxRate(id),
    meta: { successMessage: 'Scheduled rate removed' },
    onSuccess: () => {
      setRemoving(null)
      invalidate()
    },
  })
  const current = currentIds(rates.data ?? [])
  const today = istToday()
  const unit = adding ? TAX_CODES[adding.code]?.unit : 'rate'

  return (
    <SectionCard
      title="Tax rates"
      description="Each rate applies from its date. To change one, add a new rate from today or later: earlier documents keep the rate they were issued with."
      action={
        <Button size="sm" onClick={() => setAdding({ code: 'gst_hoc_services', rate: '', threshold: '', effective_from: today, note: '' })}>
          <Plus /> Add rate
        </Button>
      }
    >
      {rates.isError ? (
        <ErrorState compact error={rates.error} onRetry={() => void rates.refetch()} />
      ) : (
        <ul className="divide-y divide-line">
          {(rates.data ?? []).map((r) => {
            const meta = TAX_CODES[r.code]
            const future = r.effective_from > today
            return (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {meta?.label ?? r.code}{' '}
                    {current.has(r.id) && (
                      <Badge tone="success" size="sm">
                        In force
                      </Badge>
                    )}
                    {future && (
                      <Badge tone="info" size="sm">
                        Scheduled
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    From {formatDate(r.effective_from)}
                    {r.note ? ` · ${r.note}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-semibold tabular-nums">
                    {meta?.unit === 'limit' ? `₹${Number(r.threshold ?? 0).toLocaleString('en-IN')}` : `${Number(r.rate)}%`}
                  </span>
                  {future && (
                    <Button size="icon-sm" variant="ghost" aria-label="Remove scheduled rate" onClick={() => setRemoving(r)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <FormDialog
        open={!!adding}
        onOpenChange={(o) => !o && setAdding(null)}
        title="Add a tax rate"
        description="It applies to documents issued on or after its date."
        submitLabel="Save rate"
        loading={add.isPending}
        submitDisabled={!adding || (unit === 'rate' ? adding.rate === '' : adding.threshold === '') || !adding.effective_from}
        onSubmit={(e) => {
          e.preventDefault()
          add.mutate()
        }}
      >
        {adding && (
          <div className="space-y-4">
            <Field label="Tax" htmlFor="rate-code" hint={TAX_CODES[adding.code]?.hint}>
              <Select
                id="rate-code"
                value={adding.code}
                onValueChange={(code) => setAdding({ ...adding, code })}
                options={Object.entries(TAX_CODES).map(([value, m]) => ({ value, label: m.label }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              {unit === 'rate' ? (
                <Field label="Rate (%)" htmlFor="rate-value" required>
                  <Input id="rate-value" type="number" inputMode="decimal" min={0} max={100} step="0.01" value={adding.rate} onChange={(e) => setAdding({ ...adding, rate: e.target.value })} />
                </Field>
              ) : (
                <Field label="Limit (₹)" htmlFor="rate-threshold" required>
                  <Input id="rate-threshold" type="number" inputMode="numeric" min={0} value={adding.threshold} onChange={(e) => setAdding({ ...adding, threshold: e.target.value })} />
                </Field>
              )}
              <Field label="From" htmlFor="rate-from" required>
                <Input id="rate-from" type="date" min={today} value={adding.effective_from} onChange={(e) => setAdding({ ...adding, effective_from: e.target.value })} />
              </Field>
            </div>
            <Field label="Note" htmlFor="rate-note" optional hint="e.g. the notification or advice it follows.">
              <Input id="rate-note" value={adding.note} onChange={(e) => setAdding({ ...adding, note: e.target.value })} />
            </Field>
          </div>
        )}
      </FormDialog>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this scheduled rate?"
        description="It hasn’t started yet, so nothing was issued with it."
        confirmLabel="Remove"
        destructive
        reasonRequired={false}
        loading={remove.isPending}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id)
        }}
      />
    </SectionCard>
  )
}
