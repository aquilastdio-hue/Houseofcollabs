import * as React from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Landmark, Plus } from 'lucide-react'
import { downloadCsv, toCsv } from '@/lib/csv'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatINR } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import {
  invoiceRegister,
  listInvoices,
  listTaxDeposits,
  recordInvoicePayment,
  recordTaxDeposit,
  withholdingRegister,
  type Invoice,
  type InvoiceKind,
  type InvoiceStatus,
  type RegisterRow,
  type TaxDeposit,
  type TaxDepositInput,
} from '@/services/billing.service'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SwitchRow } from '@/components/ui/switch'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { FormDialog } from '@/components/admin/form-dialog'
import { useUrlState } from '@/components/admin/use-url-state'
import { InvoiceTable, KIND_LABEL, STATUS_META } from '@/components/billing/invoice-table'
import { istToday } from './billing-overview'

const PAGE_SIZE = 25
const KIND_OPTIONS = Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))
const STATUS_OPTIONS = [{ value: 'open', label: 'Awaiting payment' }, ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))]

function exportRows(name: string, rows: RegisterRow[]) {
  if (rows.length === 0) {
    toast.info('Nothing in that date range.')
    return
  }
  const header = Object.keys(rows[0]!)
  downloadCsv(name, toCsv(header, rows.map((r) => header.map((h) => r[h] ?? ''))))
}

/** From / to dates and a button that downloads a CSV for them. */
function RegisterExport({ label, fileName, load }: { label: string; fileName: string; load: (from: string, to: string, test: boolean) => Promise<RegisterRow[]> }) {
  const today = istToday()
  const [from, setFrom] = React.useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = React.useState(today)
  const [test, setTest] = React.useState(false)
  const run = useMutation({
    mutationFn: () => load(from, to, test),
    onSuccess: (rows) => exportRows(`${fileName}-${from}-to-${to}.csv`, rows),
  })
  const id = React.useId()
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
      <Field label="From" htmlFor={`${id}-from`}>
        <Input id={`${id}-from`} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
      </Field>
      <Field label="To" htmlFor={`${id}-to`}>
        <Input id={`${id}-to`} type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <SwitchRow id={`${id}-test`} label="Include test accounts" checked={test} onCheckedChange={setTest} />
      <Button variant="secondary" loading={run.isPending} disabled={!from || !to} onClick={() => run.mutate()}>
        {!run.isPending && <Download />} {label}
      </Button>
    </div>
  )
}

// ----------------------------------------------------------------- invoices
export function BillingInvoices() {
  const url = useUrlState()
  const queryClient = useQueryClient()
  const params = {
    kind: (url.get('kind') || 'all') as InvoiceKind | 'all',
    status: (url.get('status') || 'all') as InvoiceStatus | 'open' | 'all',
    search: url.get('q'),
    includeTest: url.get('test') === '1',
    page: Number(url.get('page')) || 1,
    pageSize: PAGE_SIZE,
  }
  const q = useQuery({ queryKey: qk.billing.invoices({ admin: true, ...params }), queryFn: () => listInvoices(params), placeholderData: keepPreviousData })
  const [paying, setPaying] = React.useState<Invoice | null>(null)
  const [amount, setAmount] = React.useState('')
  const [reference, setReference] = React.useState('')
  const record = useMutation({
    mutationFn: () => recordInvoicePayment(paying!.id, Number(amount), reference),
    meta: { successMessage: 'Payment recorded' },
    onSuccess: () => {
      setPaying(null)
      void queryClient.invalidateQueries({ queryKey: qk.billing.all })
    },
  })
  const due = paying ? Number(paying.total_amount) - Number(paying.amount_paid) : 0

  return (
    <div className="space-y-6">
      <FilterBar
        search={<SearchInput value={params.search} onCommit={(v) => url.update({ q: v })} placeholder="Number, order or party" />}
        activeCount={[params.kind !== 'all', params.status !== 'all', params.includeTest].filter(Boolean).length}
        onReset={() => url.update({ kind: null, status: null, test: null, q: null })}
      >
        <FilterField label="Document" htmlFor="f-kind">
          <Select id="f-kind" value={params.kind === 'all' ? '' : params.kind} onValueChange={(v) => url.update({ kind: v })} options={KIND_OPTIONS} anyLabel="All documents" />
        </FilterField>
        <FilterField label="Status" htmlFor="f-status">
          <Select id="f-status" value={params.status === 'all' ? '' : params.status} onValueChange={(v) => url.update({ status: v })} options={STATUS_OPTIONS} anyLabel="Any status" />
        </FilterField>
        <FilterField label="Test accounts" htmlFor="f-test">
          <SwitchRow id="f-test" label="Show" checked={params.includeTest} onCheckedChange={(v) => url.update({ test: v })} />
        </FilterField>
      </FilterBar>

      <InvoiceTable
        rows={q.data?.items}
        perspective="admin"
        loading={q.isPending}
        error={q.isError && !q.data ? q.error : undefined}
        onRetry={() => void q.refetch()}
        pagination={q.data ? { page: params.page, pageSize: PAGE_SIZE, total: q.data.total, onPageChange: (p) => url.update({ page: p }, { keepPage: true }) } : undefined}
        action={(inv) =>
          inv.kind === 'creator_commission' && (inv.status === 'unpaid' || inv.status === 'partially_paid') ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                setPaying(inv)
                setAmount(String(Number(inv.total_amount) - Number(inv.amount_paid)))
                setReference('')
              }}
            >
              Record payment
            </Button>
          ) : null
        }
      />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Invoice register</h2>
        <p className="text-sm text-muted">Every document issued in a date range, with GST split by CGST, SGST and IGST. The basis for GSTR-1 and your books.</p>
        <RegisterExport label="Download CSV" fileName="hoc-invoice-register" load={invoiceRegister} />
      </section>

      <FormDialog
        open={!!paying}
        onOpenChange={(o) => !o && setPaying(null)}
        title={`Record a payment for ${paying?.number ?? ''}`}
        description={`The creator paid by bank transfer or UPI. ${formatINR(due, { precise: true })} is due.`}
        submitLabel="Record payment"
        loading={record.isPending}
        submitDisabled={!(Number(amount) > 0 && Number(amount) <= due) || reference.trim().length < 2}
        onSubmit={(e) => {
          e.preventDefault()
          record.mutate()
        }}
      >
        <Field label="Amount received" htmlFor="pay-amount" required>
          <Input id="pay-amount" type="number" inputMode="decimal" min={1} max={due} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Reference" htmlFor="pay-ref" required hint="UTR, UPI transaction id or cheque number.">
          <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </FormDialog>
    </div>
  )
}

// -------------------------------------------------------------------- taxes
const TAX_LABEL: Record<TaxDeposit['tax_type'], string> = {
  gst_output: 'GST on HOC services',
  tds_194o: 'TDS (s.194-O)',
  tcs_gst_52: 'GST TCS (s.52)',
}
const RETURN_HINT: Record<TaxDeposit['tax_type'], string> = { gst_output: 'GSTR-3B', tds_194o: '26Q', tcs_gst_52: 'GSTR-8' }

const depositColumns: Column<TaxDeposit>[] = [
  { key: 'period', header: 'For', cell: (d) => new Date(`${d.period}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) },
  { key: 'tax', header: 'Tax', cell: (d) => TAX_LABEL[d.tax_type as TaxDeposit['tax_type']] ?? d.tax_type },
  { key: 'amount', header: 'Amount', className: 'text-right', headerClassName: 'text-right', cell: (d) => <span className="tabular-nums">{formatINR(d.amount, { precise: true })}</span> },
  { key: 'reference', header: 'Challan / reference', cell: (d) => <span className="font-mono text-xs">{d.reference}</span> },
  { key: 'deposited', header: 'Deposited', cell: (d) => formatDate(d.deposited_on) },
  {
    key: 'filed',
    header: 'Return',
    hideOnMobile: true,
    cell: (d) => (d.return_type ? `${d.return_type}${d.filing_reference ? ` · ${d.filing_reference}` : ''}${d.filed_on ? ` · ${formatDate(d.filed_on)}` : ''}` : '—'),
  },
]

const emptyDeposit = (): TaxDepositInput => ({
  tax_type: 'tds_194o',
  period: `${istToday().slice(0, 7)}-01`,
  amount: 0,
  reference: '',
  deposited_on: istToday(),
  return_type: '26Q',
})

export function BillingTaxes() {
  const queryClient = useQueryClient()
  const deposits = useQuery({ queryKey: qk.billing.deposits, queryFn: listTaxDeposits })
  const [form, setForm] = React.useState<TaxDepositInput | null>(null)
  const set = (patch: Partial<TaxDepositInput>) => setForm((f) => (f ? { ...f, ...patch } : f))
  const save = useMutation({
    mutationFn: () => recordTaxDeposit({ ...form!, period: `${form!.period.slice(0, 7)}-01` }),
    meta: { successMessage: 'Deposit recorded' },
    onSuccess: () => {
      setForm(null)
      void queryClient.invalidateQueries({ queryKey: qk.billing.all })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Deposits and filings</h2>
            <p className="text-sm text-muted">Record each challan you pay. It reduces what the Overview shows as owed.</p>
          </div>
          <Button size="sm" onClick={() => setForm(emptyDeposit())}>
            <Plus /> Record deposit
          </Button>
        </div>
        <DataTable
          columns={depositColumns}
          rows={deposits.data}
          rowKey={(d) => d.id}
          loading={deposits.isPending}
          error={deposits.isError ? deposits.error : undefined}
          onRetry={() => void deposits.refetch()}
          mobilePrimary="tax"
          empty={<EmptyState icon={<Landmark />} title="No deposits recorded" description="When you pay GST, TDS or TCS to the government, record the challan here." />}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">TDS and TCS register</h2>
        <p className="text-sm text-muted">
          Every deduction with the creator’s PAN or GSTIN, rate, base and month: the basis for Form 26Q (TDS) and GSTR-8 (TCS). Exempt rows (individuals
          within the yearly limit) are included with a zero amount.
        </p>
        <RegisterExport label="Download CSV" fileName="hoc-tds-tcs-register" load={withholdingRegister} />
      </section>

      <FormDialog
        open={!!form}
        onOpenChange={(o) => !o && setForm(null)}
        title="Record a tax deposit"
        description="Money paid to the government, with its challan reference."
        submitLabel="Record deposit"
        loading={save.isPending}
        submitDisabled={!form || !(form.amount > 0) || form.reference.trim().length < 2}
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        {form && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tax" htmlFor="dep-type" required>
              <Select
                id="dep-type"
                value={form.tax_type}
                onValueChange={(v) => set({ tax_type: v as TaxDepositInput['tax_type'], return_type: RETURN_HINT[v as TaxDeposit['tax_type']] })}
                options={Object.entries(TAX_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="For the month" htmlFor="dep-period" required>
              <Input id="dep-period" type="month" value={form.period.slice(0, 7)} onChange={(e) => set({ period: `${e.target.value}-01` })} />
            </Field>
            <Field label="Amount" htmlFor="dep-amount" required>
              <Input id="dep-amount" type="number" inputMode="decimal" min={0} step="0.01" value={form.amount || ''} onChange={(e) => set({ amount: Number(e.target.value) })} />
            </Field>
            <Field label="Deposited on" htmlFor="dep-date" required>
              <Input id="dep-date" type="date" max={istToday()} value={form.deposited_on} onChange={(e) => set({ deposited_on: e.target.value })} />
            </Field>
            <Field label="Challan / CIN / reference" htmlFor="dep-ref" required className="sm:col-span-2">
              <Input id="dep-ref" value={form.reference} onChange={(e) => set({ reference: e.target.value })} />
            </Field>
            <Field label="Return" htmlFor="dep-return" optional>
              <Input id="dep-return" value={form.return_type ?? ''} onChange={(e) => set({ return_type: e.target.value })} placeholder="e.g. 26Q, GSTR-8" />
            </Field>
            <Field label="Return reference" htmlFor="dep-filing" optional>
              <Input id="dep-filing" value={form.filing_reference ?? ''} onChange={(e) => set({ filing_reference: e.target.value })} placeholder="Acknowledgement / ARN" />
            </Field>
            <Field label="Filed on" htmlFor="dep-filed" optional>
              <Input id="dep-filed" type="date" value={form.filed_on ?? ''} onChange={(e) => set({ filed_on: e.target.value })} />
            </Field>
            <Field label="Note" htmlFor="dep-note" optional>
              <Input id="dep-note" value={form.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
            </Field>
          </div>
        )}
      </FormDialog>
    </div>
  )
}
