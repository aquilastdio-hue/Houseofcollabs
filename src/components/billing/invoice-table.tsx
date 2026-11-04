import * as React from 'react'
import { toast } from 'sonner'
import { Download, FileText } from 'lucide-react'
import { formatDate, formatINR } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { party, meta, type Invoice, type InvoiceKind, type InvoiceStatus } from '@/services/billing.service'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'

export const KIND_LABEL: Record<InvoiceKind, string> = {
  creator_service: 'Creator invoice',
  brand_commission: 'Commission (brand)',
  creator_commission: 'Commission (creator)',
  settlement: 'Settlement statement',
  credit_note: 'Credit note',
}

export const STATUS_META: Record<InvoiceStatus, { label: string; tone: BadgeTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  unpaid: { label: 'Due', tone: 'warning' },
  partially_paid: { label: 'Part paid', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  credited: { label: 'Credited', tone: 'neutral' },
  issued: { label: 'Issued', tone: 'info' },
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const s = STATUS_META[status as InvoiceStatus] ?? { label: status, tone: 'neutral' as const }
  return (
    <Badge tone={s.tone} size="sm" dot>
      {s.label}
    </Badge>
  )
}

/** Builds the PDF in the browser from the issued snapshot (pdf-lib loads on first use). */
export function DownloadInvoiceButton({ invoice, label = 'PDF' }: { invoice: Invoice; label?: string }) {
  const [busy, setBusy] = React.useState(false)
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      aria-label={`Download ${invoice.number} as PDF`}
      onClick={async (e) => {
        e.stopPropagation()
        setBusy(true)
        try {
          const { downloadInvoicePdf } = await import('@/lib/invoice-pdf')
          await downloadInvoicePdf(invoice)
        } catch (err) {
          toast.error(errorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      {!busy && <Download />} {label}
    </Button>
  )
}

/** Who the document is with, from the reader's side. */
function counterparty(inv: Invoice, perspective: 'brand' | 'creator' | 'admin') {
  const s = party(inv.supplier)
  const r = party(inv.recipient)
  if (perspective === 'admin') return `${s.name ?? '—'} → ${r.name ?? '—'}`
  // A brand only ever receives documents, so the other side is the supplier
  // (the creator, or HOC). A creator issues to brands and receives from HOC.
  const other = perspective === 'brand' ? s : inv.issuer === 'creator' ? r : s
  return other.brand_name ?? other.name ?? '—'
}

export function InvoiceTable({
  rows,
  perspective,
  loading,
  error,
  onRetry,
  pagination,
  action,
  empty,
}: {
  rows: Invoice[] | undefined
  perspective: 'brand' | 'creator' | 'admin'
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }
  /** An extra button per row, e.g. Pay or Record payment. */
  action?: (inv: Invoice) => React.ReactNode
  empty?: React.ReactNode
}) {
  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Document',
      cell: (inv) => (
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium">{inv.number}</p>
          <p className="text-xs text-muted">
            {KIND_LABEL[inv.kind as InvoiceKind] ?? inv.kind}
            {inv.is_test && ' · test'}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      cell: (inv) => (
        <time dateTime={inv.issued_at} className="whitespace-nowrap">
          {formatDate(inv.issued_at)}
        </time>
      ),
    },
    {
      key: 'party',
      header: perspective === 'admin' ? 'From → to' : 'With',
      hideOnMobile: true,
      cell: (inv) => (
        <div className="min-w-0">
          <p className="max-w-64 truncate">{counterparty(inv, perspective)}</p>
          {meta(inv.meta).order_number && <p className="font-mono text-xs text-muted">{meta(inv.meta).order_number}</p>}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (inv) => (
        <div className="md:text-right">
          <p className="font-medium tabular-nums">{formatINR(inv.kind === 'settlement' ? inv.net_amount : inv.total_amount, { precise: true })}</p>
          {Number(inv.cgst_amount) + Number(inv.sgst_amount) + Number(inv.igst_amount) > 0 && (
            <p className="text-xs text-muted tabular-nums">
              incl. GST {formatINR(Number(inv.cgst_amount) + Number(inv.sgst_amount) + Number(inv.igst_amount), { precise: true })}
            </p>
          )}
          {inv.status === 'partially_paid' && (
            <p className="text-xs text-warning tabular-nums">{formatINR(Number(inv.total_amount) - Number(inv.amount_paid), { precise: true })} due</p>
          )}
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (inv) => <InvoiceStatusBadge status={inv.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (inv) => (
        <div className="flex justify-end gap-2">
          {action?.(inv)}
          <DownloadInvoiceButton invoice={inv} />
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(inv) => inv.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      mobilePrimary="number"
      pagination={pagination ? { ...pagination, label: 'documents' } : undefined}
      empty={empty ?? <EmptyState icon={<FileText />} title="No documents yet" description="Invoices appear here as soon as an order is paid." />}
    />
  )
}
