import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileDown, FileSpreadsheet, Landmark, ListChecks, Upload } from 'lucide-react'
import { errorMessage } from '@/lib/errors'
import { formatINR } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { parseCsv } from '@/lib/csv'
import { markPayoutsPaid, payoutSheet, preparePayouts, type MarkPaidResult, type PreparePayoutsResult } from '@/services/billing.service'
import { Button } from '@/components/ui/button'
import { SwitchRow } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Notice } from '@/components/admin/form-dialog'

const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)

/**
 * Admin → Payouts → Bank transfers (migration 0042): how creators are paid
 * while RazorpayX isn't available.
 *   1. Prepare payouts: one request per creator with earnings ready.
 *   2. Download the payout sheet (PDF to read, Excel to fill in) for the accountant.
 *   3. Upload the sheet back with UTRs: everything is marked paid.
 */
export function BankTransfers() {
  const queryClient = useQueryClient()
  const [includeTest, setIncludeTest] = React.useState(false)
  const [prepared, setPrepared] = React.useState<PreparePayoutsResult | null>(null)
  const [upload, setUpload] = React.useState<{ name: string; rows: { payout_request_id: string; reference: string }[] } | null>(null)
  const [results, setResults] = React.useState<MarkPaidResult[] | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: qk.admin.all })

  const prepare = useMutation({
    mutationFn: () => preparePayouts(includeTest),
    onSuccess: (r) => {
      setPrepared(r)
      refresh()
      toast.success(r.created ? `Prepared ${r.created} payout${r.created === 1 ? '' : 's'}, ${formatINR(r.total, { precise: true })}.` : 'Nobody new to pay right now.')
    },
  })

  const download = useMutation({
    mutationFn: async (format: 'pdf' | 'xlsx') => {
      const rows = await payoutSheet('pending', includeTest)
      if (rows.length === 0) throw new Error('No pending payouts. Prepare payouts first.')
      const [{ payoutSheetPdf, payoutSheetWorkbook }, { writeXlsx, downloadBytes, XLSX_TYPE }] = await Promise.all([
        import('@/lib/payout-sheet'),
        import('@/lib/xlsx'),
      ])
      if (format === 'pdf') downloadBytes(await payoutSheetPdf(rows), `hoc-payout-sheet-${today()}.pdf`, 'application/pdf')
      else downloadBytes(writeXlsx(payoutSheetWorkbook(rows)), `hoc-payout-sheet-${today()}.xlsx`, XLSX_TYPE)
      return rows.length
    },
    meta: { silent: true },
    onError: (e) => toast.error(e instanceof Error && !('kind' in e) ? e.message : errorMessage(e)),
  })

  const markPaid = useMutation({
    mutationFn: () => markPayoutsPaid(upload!.rows),
    onSuccess: (r) => {
      setResults(r)
      setUpload(null)
      refresh()
      const ok = r.filter((x) => x.ok).length
      toast.success(`${ok} payout${ok === 1 ? '' : 's'} marked paid${r.length > ok ? `, ${r.length - ok} not` : ''}.`)
    },
  })

  const readFile = async (file: File) => {
    try {
      const [{ readUtrSheet }, { readXlsx }] = await Promise.all([import('@/lib/payout-sheet'), import('@/lib/xlsx')])
      const table = /\.xlsx$/i.test(file.name) ? readXlsx(new Uint8Array(await file.arrayBuffer())) : parseCsv(await file.text())
      const rows = readUtrSheet(table)
      if (rows.length === 0) {
        toast.error('No rows with both a Payout ID and a UTR. Use the sheet downloaded here, with the UTR column filled in.')
        return
      }
      setUpload({ name: file.name, rows })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t read that file.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section aria-labelledby="bank-transfers-title" className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <Landmark className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
          <div>
            <h2 id="bank-transfers-title" className="font-display text-lg font-semibold tracking-tight">
              Bank transfers
            </h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted">
              Pay creators through your accountant: prepare everyone who’s due, download the sheet, and upload it back with the UTRs. Each creator then
              gets their transfer reference and settlement statement.
            </p>
          </div>
        </div>
        <SwitchRow id="bt-test" label="Include test accounts" checked={includeTest} onCheckedChange={setIncludeTest} />
      </div>

      <ol className="mt-4 grid gap-3 lg:grid-cols-3">
        <li className="rounded-control border border-line p-4">
          <p className="text-sm font-medium">1. Prepare payouts</p>
          <p className="mt-1 text-xs text-muted">One payout per creator with earnings past the hold. No minimum, and creators don’t need to press Withdraw.</p>
          <Button className="mt-3" size="sm" loading={prepare.isPending} onClick={() => prepare.mutate()}>
            {!prepare.isPending && <ListChecks />} Prepare payouts
          </Button>
        </li>
        <li className="rounded-control border border-line p-4">
          <p className="text-sm font-medium">2. Payout sheet for the accountant</p>
          <p className="mt-1 text-xs text-muted">All pending payouts with UPI / bank details, PAN and amounts. Contains full account numbers: every download is logged.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={download.isPending && download.variables === 'pdf'} disabled={download.isPending} onClick={() => download.mutate('pdf')}>
              {!(download.isPending && download.variables === 'pdf') && <FileDown />} PDF
            </Button>
            <Button size="sm" variant="secondary" loading={download.isPending && download.variables === 'xlsx'} disabled={download.isPending} onClick={() => download.mutate('xlsx')}>
              {!(download.isPending && download.variables === 'xlsx') && <FileSpreadsheet />} Excel
            </Button>
          </div>
        </li>
        <li className="rounded-control border border-line p-4">
          <p className="text-sm font-medium">3. Upload the paid sheet</p>
          <p className="mt-1 text-xs text-muted">The Excel sheet (or a CSV of it) with the UTR column filled in. Rows without a UTR are left alone.</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            id="bt-upload"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void readFile(f)
            }}
          />
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload /> Upload paid sheet
          </Button>
        </li>
      </ol>

      {prepared && prepared.without_details.length > 0 && (
        <Notice tone="warning" className="mt-4">
          {prepared.without_details.length} creator{prepared.without_details.length === 1 ? ' is' : 's are'} owed money but {prepared.without_details.length === 1 ? 'hasn’t' : 'haven’t'} added
          UPI or bank details, so they weren’t included:{' '}
          {prepared.without_details.map((c) => c.name).join(', ')}.
        </Notice>
      )}
      {prepared && prepared.already_open > 0 && (
        <Notice tone="info" className="mt-3">
          {prepared.already_open} creator{prepared.already_open === 1 ? ' already has' : 's already have'} a payout in progress; their newer earnings go in the next batch.
        </Notice>
      )}
      {results && results.some((r) => !r.ok) && (
        <Notice tone="danger" className="mt-4">
          Not marked paid:
          <ul className="mt-1 list-disc pl-5">
            {results.filter((r) => !r.ok).map((r) => (
              <li key={r.payout_request_id}>
                <span className="font-mono text-xs">{r.payout_request_id}</span>: {r.error}
              </li>
            ))}
          </ul>
        </Notice>
      )}

      <ConfirmDialog
        open={!!upload}
        onOpenChange={(o) => !o && setUpload(null)}
        title={upload ? `Mark ${upload.rows.length} payout${upload.rows.length === 1 ? '' : 's'} as paid?` : ''}
        description={upload ? `From ${upload.name}. Each creator is told it’s paid, with its UTR, and gets their settlement statement.` : undefined}
        confirmLabel="Mark paid"
        reasonRequired={false}
        loading={markPaid.isPending}
        onConfirm={() => markPaid.mutate()}
      />
    </section>
  )
}
