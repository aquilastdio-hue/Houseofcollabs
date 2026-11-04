import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRightLeft, BadgeIndianRupee, CircleCheck, FileArchive, FileSpreadsheet, Hourglass, Landmark, Receipt, Wallet } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { getAdminBillingSummary, type AdminBillingSummary } from '@/services/billing.service'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SwitchRow } from '@/components/ui/switch'
import { StatsCard } from '@/components/shared/stats-card'
import { ErrorState } from '@/components/shared/states'
import { Notice } from '@/components/admin/form-dialog'

/** Today in India, as YYYY-MM-DD. */
export function istToday() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

function periodRange(period: string): { from?: string; to?: string; label: string } {
  const today = istToday()
  const [y, m] = today.split('-').map(Number) as [number, number]
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today, label: 'this month' }
  if (period === 'fy') {
    const start = m >= 4 ? y : y - 1
    return { from: `${start}-04-01`, to: today, label: `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}` }
  }
  return { label: 'all time' }
}

const PERIODS = [
  { value: 'month', label: 'This month' },
  { value: 'fy', label: 'This financial year' },
  { value: 'all', label: 'All time' },
]

export function BillingOverview() {
  const [period, setPeriod] = React.useState('fy')
  const range = periodRange(period)
  const q = useQuery({
    queryKey: qk.billing.adminSummary({ from: range.from, to: range.to }),
    queryFn: () => getAdminBillingSummary(range.from, range.to),
  })
  const s = q.data

  if (q.isError) return <ErrorState title="Couldn’t load the billing summary" error={q.error} onRetry={() => void q.refetch()} />

  return (
    <div className="space-y-8">
      {s && !s.billing_v2_enabled && (
        <Notice tone="warning" icon={<AlertTriangle />}>
          New billing is <strong>off</strong>: new orders still use the old maths (commission taken out of the creator’s price, no GST invoices). Test
          accounts always use the new billing. Turn it on in the Settings tab once your CA has checked the rates and your business details.
        </Notice>
      )}

      <AccountantPack />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Real money only: test accounts are left out.</p>
        <Select value={period} onValueChange={setPeriod} options={PERIODS} size="sm" className="w-52" aria-label="Period" />
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatsCard tone="dark" label="Transaction value" icon={<ArrowRightLeft />} loading={q.isPending} value={formatINR(s?.transaction_value)} hint={`Paid by brands, ${range.label}`} />
        <StatsCard
          tone="brand"
          label="HOC revenue"
          icon={<BadgeIndianRupee />}
          loading={q.isPending}
          value={formatINR(s?.hoc_revenue)}
          hint={s ? `${formatINR(s.brand_commission_revenue)} brands · ${formatINR(s.creator_commission_revenue)} creators` : undefined}
        />
        <StatsCard label="GST on HOC services" icon={<Receipt />} loading={q.isPending} value={formatINR(s?.gst_collected)} hint="Collected, not revenue" />
        <StatsCard label="Creator payouts" icon={<Wallet />} loading={q.isPending} value={formatINR(s?.creator_payouts)} hint={range.label} />
        <StatsCard label="TDS withheld" icon={<Landmark />} loading={q.isPending} value={formatINR(s?.tds_withheld)} hint="s.194-O" />
        <StatsCard label="GST TCS collected" icon={<Landmark />} loading={q.isPending} value={formatINR(s?.tcs_collected)} hint="s.52" />
        <StatsCard
          label="Creator commissions due"
          icon={<Hourglass />}
          loading={q.isPending}
          value={formatINR(s?.outstanding_creator_commissions)}
          hint={s ? `${s.outstanding_commission_invoices} unpaid invoices` : undefined}
        />
        <StatsCard label="Creator money held" icon={<Wallet />} loading={q.isPending} value={formatINR(s?.pending_settlements)} hint="Paid by brands, not yet paid out" />
      </section>

      <section aria-labelledby="payable-title" className="space-y-3">
        <h2 id="payable-title" className="font-display text-lg font-semibold tracking-tight">
          Owed to the government now
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Payable label="GST on HOC services" value={s?.gst_payable} loading={q.isPending} note="GSTR-3B" />
          <Payable label="TDS (s.194-O)" value={s?.tds_payable} loading={q.isPending} note="Challan 281 · Form 26Q" />
          <Payable label="GST TCS (s.52)" value={s?.tcs_payable} loading={q.isPending} note="GSTR-8" />
        </div>
        <p className="text-xs text-muted">Collected or withheld, less what you recorded as deposited in the Taxes tab. Due dates and returns: confirm with your CA.</p>
      </section>

      {s && <MonthlyTaxes rows={s.monthly_taxes} />}
      {s && <Reconciliation r={s.reconciliation} pending={s.pending_settlements} />}
    </div>
  )
}

function Payable({ label, value, loading, note }: { label: string; value?: number; loading?: boolean; note: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums', loading && 'opacity-40')}>{formatINR(value ?? 0, { precise: true })}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  )
}

function MonthlyTaxes({ rows }: { rows: AdminBillingSummary['monthly_taxes'] }) {
  if (rows.length === 0) return null
  const cell = (n: number) => (n ? formatINR(n, { precise: true }) : '—')
  return (
    <section aria-labelledby="monthly-title" className="space-y-3">
      <h2 id="monthly-title" className="font-display text-lg font-semibold tracking-tight">
        Month by month
      </h2>
      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-subtle text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Month</th>
              <th className="px-4 py-2.5 text-right font-medium">GST charged</th>
              <th className="px-4 py-2.5 text-right font-medium">GST deposited</th>
              <th className="px-4 py-2.5 text-right font-medium">TDS withheld</th>
              <th className="px-4 py-2.5 text-right font-medium">TDS deposited</th>
              <th className="px-4 py-2.5 text-right font-medium">TCS collected</th>
              <th className="px-4 py-2.5 text-right font-medium">TCS deposited</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {rows.map((r) => (
              <tr key={r.month}>
                <td className="px-4 py-2.5 font-medium">{new Date(`${r.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                <td className="px-4 py-2.5 text-right">{cell(r.gst_output)}</td>
                <td className="px-4 py-2.5 text-right">{cell(r.gst_deposited)}</td>
                <td className="px-4 py-2.5 text-right">
                  {cell(r.tds_withheld - r.tds_reversed)}
                  {r.tds_reversed > 0 && <span className="block text-xs text-muted">{formatINR(r.tds_reversed, { precise: true })} reversed</span>}
                </td>
                <td className="px-4 py-2.5 text-right">{cell(r.tds_deposited)}</td>
                <td className="px-4 py-2.5 text-right">
                  {cell(r.tcs_collected - r.tcs_reversed)}
                  {r.tcs_reversed > 0 && <span className="block text-xs text-muted">{formatINR(r.tcs_reversed, { precise: true })} reversed</span>}
                </td>
                <td className="px-4 py-2.5 text-right">{cell(r.tcs_deposited)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * Each line compares the books (ledger) with what the operational tables
 * say. They should match; a mismatch is something to look at, not
 * necessarily an error (a cancelled order waiting for its refund shows up
 * in "creator money held" until it's refunded).
 */
function Reconciliation({ r, pending }: { r: AdminBillingSummary['reconciliation']; pending: number }) {
  const checks = [
    { label: 'Every ledger posting balances', ok: r.unbalanced_postings === 0, detail: r.unbalanced_postings ? `${r.unbalanced_postings} unbalanced` : 'Debits equal credits' },
    {
      label: 'Every paid order has its invoices',
      ok: r.paid_orders_without_invoices === 0,
      detail: r.paid_orders_without_invoices ? `${r.paid_orders_without_invoices} paid orders without invoices` : 'All issued',
    },
    {
      label: 'Brand payments match the ledger',
      ok: Math.abs(r.captured_v2_payments - r.ledger_brand_payments) < 0.01,
      detail: `${formatINR(r.captured_v2_payments, { precise: true })} captured · ${formatINR(r.ledger_brand_payments, { precise: true })} booked`,
    },
    {
      label: 'TDS / TCS match the ledger',
      ok: Math.abs(r.withholdings_total - r.ledger_withholdings) < 0.01,
      detail: `${formatINR(r.withholdings_total, { precise: true })} withheld · ${formatINR(r.ledger_withholdings, { precise: true })} booked`,
    },
    {
      label: 'Unpaid commission invoices match the ledger',
      ok: Math.abs(r.commission_invoices_outstanding - r.ledger_commission_receivable) < 0.01,
      detail: `${formatINR(r.commission_invoices_outstanding, { precise: true })} on invoices · ${formatINR(r.ledger_commission_receivable, { precise: true })} booked`,
    },
    {
      label: 'Creator money held matches orders and earnings',
      ok: Math.abs(pending - (r.unpaid_v2_earnings + r.paid_orders_in_progress)) < 0.01,
      detail: `${formatINR(pending, { precise: true })} booked · ${formatINR(r.unpaid_v2_earnings + r.paid_orders_in_progress, { precise: true })} in orders and unpaid earnings`,
    },
  ]
  return (
    <section aria-labelledby="recon-title" className="space-y-3">
      <h2 id="recon-title" className="font-display text-lg font-semibold tracking-tight">
        Reconciliation
      </h2>
      <ul className="divide-y divide-line rounded-card border border-line bg-surface shadow-card">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-3 px-4 py-3">
            {c.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-label="Matches" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Check this" />}
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.label}</p>
              <p className="text-xs text-muted tabular-nums">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Everything the accountant needs for a period: one Excel workbook (summary,
 * invoices, orders, payments, refunds, earnings, payouts, TDS & TCS, ledger)
 * and every invoice / credit note / statement as PDFs in a zip.
 */
function AccountantPack() {
  const today = istToday()
  const [y, m] = today.split('-').map(Number) as [number, number]
  const [from, setFrom] = React.useState(`${m >= 4 ? y : y - 1}-04-01`)
  const [to, setTo] = React.useState(today)
  const [includeTest, setIncludeTest] = React.useState(false)
  const [progress, setProgress] = React.useState<string | null>(null)
  const file = `${from}-to-${to}`

  const excel = useMutation({
    mutationFn: async () => {
      const [{ accountsWorkbook }, { downloadBytes, XLSX_TYPE }] = await Promise.all([import('@/lib/accounts-workbook'), import('@/lib/xlsx')])
      downloadBytes(await accountsWorkbook(from, to, includeTest), `hoc-accounts-${file}.xlsx`, XLSX_TYPE)
    },
  })
  const pdfs = useMutation({
    mutationFn: async () => {
      const [{ invoicesZip }, { downloadBytes }] = await Promise.all([import('@/lib/accounts-workbook'), import('@/lib/xlsx')])
      const { count, bytes } = await invoicesZip(from, to, includeTest, (done, total) => setProgress(`${done} of ${total}`))
      if (!bytes) {
        toast.info('No documents were issued in that period.')
        return
      }
      downloadBytes(bytes, `hoc-invoices-${file}.zip`, 'application/zip')
      toast.success(`${count} documents downloaded.`)
    },
    onSettled: () => setProgress(null),
  })

  return (
    <section aria-labelledby="pack-title" className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 id="pack-title" className="font-display text-lg font-semibold tracking-tight">
        For the accountant
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        The books for a period as one Excel workbook, and every invoice, credit note and settlement statement as PDFs.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="From" htmlFor="pack-from">
          <Input id="pack-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To" htmlFor="pack-to">
          <Input id="pack-to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <SwitchRow id="pack-test" label="Include test accounts" checked={includeTest} onCheckedChange={setIncludeTest} />
        <Button loading={excel.isPending} disabled={!from || !to || pdfs.isPending} onClick={() => excel.mutate()}>
          {!excel.isPending && <FileSpreadsheet />} Excel workbook
        </Button>
        <Button variant="secondary" loading={pdfs.isPending} disabled={!from || !to || excel.isPending} onClick={() => pdfs.mutate()}>
          {!pdfs.isPending && <FileArchive />} {progress ? `PDFs ${progress}` : 'All PDFs (zip)'}
        </Button>
      </div>
    </section>
  )
}
