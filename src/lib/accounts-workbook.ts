import { zipSync } from 'fflate'
import {
  accountsExport,
  getAdminBillingSummary,
  invoiceRegister,
  listInvoices,
  withholdingRegister,
  type Invoice,
  type RegisterRow,
} from '@/services/billing.service'
import { invoicePdf } from '@/lib/invoice-pdf'
import { writeXlsx, type Cell, type Sheet } from '@/lib/xlsx'

/**
 * The accountant's pack (Admin → Billing & tax → Overview): one Excel
 * workbook for a period, and every invoice in it as PDFs in a zip. Built in
 * the browser from admin-only RPCs. Load lazily: it pulls in pdf-lib.
 */

/** Column headings people read, for the keys the export RPCs return. */
const LABELS: Record<string, string> = {
  number: 'Number', date: 'Date', kind: 'Type', document: 'Document', issuer: 'Issued by', supplier: 'Supplier',
  supplier_gstin: 'Supplier GSTIN', recipient: 'Recipient', recipient_gstin: 'Recipient GSTIN', place_of_supply: 'Place of supply',
  sac: 'SAC', order_number: 'Order', original_invoice: 'Against invoice', gst_rate: 'GST %', taxable: 'Taxable value',
  cgst: 'CGST', sgst: 'SGST', igst: 'IGST', total: 'Total', tds: 'TDS', tcs: 'TCS', net: 'Net', status: 'Status',
  amount_paid: 'Amount paid', test: 'Test account', order: 'Order', billing: 'Billing version', brand: 'Brand', creator: 'Creator',
  service: 'Service', price: 'Creator price', creator_gst: 'Creator GST', brand_fee: 'Brand commission', brand_fee_gst: 'GST on brand commission',
  commission: 'Creator commission', creator_earning: 'Creator earning (before TDS/TCS)', paid_at: 'Paid at', completed_at: 'Completed at',
  amount: 'Amount', refunded: 'Refunded', method: 'Method', razorpay_order: 'Razorpay order', razorpay_payment: 'Razorpay payment',
  razorpay_refund: 'Razorpay refund', reason: 'Reason', gross: 'Gross', commission_deducted: 'Commission deducted', available_from: 'Available from',
  payout: 'Payout', requested: 'Requested', reference: 'Reference', to: 'Paid to', utr: 'UTR', processed: 'Processed', notes: 'Notes',
  event: 'Event', account: 'Account', debit: 'Debit', credit: 'Credit', memo: 'Memo', posting: 'Posting', tax: 'Tax',
  entity_type: 'Entity', pan: 'PAN', gstin: 'GSTIN', supplier_state: 'Supplier state', intra_state: 'Same state', base: 'Base amount',
  rate: 'Rate %', exemption: 'Exemption', financial_year: 'FY', period: 'Month', reversed_on: 'Reversed on',
}
const MONEY = /^(amount|total|taxable|cgst|sgst|igst|tds|tcs|net|gross|price|creator_gst|brand_fee|brand_fee_gst|commission|commission_deducted|creator_earning|refunded|amount_paid|debit|credit|base)$/

/** Rows of objects → a sheet: headings from the keys, rupee columns with two decimals. */
export function tableSheet(name: string, rows: RegisterRow[]): Sheet {
  if (rows.length === 0) return { name, rows: [['Nothing in this period.']] }
  const keys = Object.keys(rows[0]!)
  const cell = (v: unknown): Cell => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : (v as Cell))
  return {
    name,
    rows: [keys.map((k) => LABELS[k] ?? k), ...rows.map((r) => keys.map((k) => cell(r[k])))],
    money: keys.flatMap((k, i) => (MONEY.test(k) ? [i] : [])),
  }
}

export async function accountsWorkbook(from: string, to: string, includeTest: boolean): Promise<Uint8Array> {
  const [summary, data, invoices, withholdings] = await Promise.all([
    getAdminBillingSummary(from, to),
    accountsExport(from, to, includeTest),
    invoiceRegister(from, to, includeTest),
    withholdingRegister(from, to, includeTest),
  ])
  const line = (label: string, value: Cell): Cell[] => [label, value]
  const summarySheet: Sheet = {
    name: 'Summary',
    rows: [
      ['House of Collabs: accounts', `${from} to ${to}`],
      line('Includes test accounts', includeTest ? 'Yes (all other sheets)' : 'No'),
      line('Generated', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
      ['', ''],
      ['Real money only (test accounts excluded)', 'Amount (Rs.)'],
      line('Paid by brands (transaction value)', summary.transaction_value),
      line('Refunded to brands', summary.refunds),
      line('HOC revenue, total (excl. GST)', summary.hoc_revenue),
      line('  from brand commission', summary.brand_commission_revenue),
      line('  from creator commission', summary.creator_commission_revenue),
      line('GST charged on HOC services', summary.gst_collected),
      line('TDS withheld (s.194-O)', summary.tds_withheld),
      line('GST TCS collected (s.52)', summary.tcs_collected),
      line('Paid out to creators', summary.creator_payouts),
      line('Creator commission payments received', summary.commission_payments),
      line('Tax deposited', summary.tax_deposited),
      ['', ''],
      ['Balances today (all time)', ''],
      line('GST payable', summary.gst_payable),
      line('TDS payable', summary.tds_payable),
      line('TCS payable', summary.tcs_payable),
      line('Creator money held (not yet paid out)', summary.pending_settlements),
      line('Creator commissions still unpaid', summary.outstanding_creator_commissions),
    ],
    money: [1],
  }
  return writeXlsx([
    summarySheet,
    tableSheet('Invoices', invoices),
    tableSheet('Orders', data.orders),
    tableSheet('Brand payments', data.payments),
    tableSheet('Refunds', data.refunds),
    tableSheet('Creator earnings', data.earnings),
    tableSheet('Payouts', data.payouts),
    tableSheet('TDS & TCS', withholdings),
    tableSheet('Ledger', data.ledger),
  ])
}

/** Every document issued in the period, one PDF each, in a zip. */
export async function invoicesZip(from: string, to: string, includeTest: boolean, onProgress?: (done: number, total: number) => void) {
  const all: Invoice[] = []
  for (let page = 1; ; page++) {
    const res = await listInvoices({ from, to, includeTest, page, pageSize: 500 })
    all.push(...res.items)
    if (all.length >= res.total || res.items.length === 0) break
  }
  const files: Record<string, Uint8Array> = {}
  for (const [i, inv] of all.entries()) {
    const folder = inv.kind === 'credit_note' ? 'credit-notes' : inv.kind === 'settlement' ? 'settlements' : inv.kind.replace(/_/g, '-')
    files[`${folder}/${inv.number.replace(/\//g, '-')}.pdf`] = await invoicePdf(inv)
    onProgress?.(i + 1, all.length)
  }
  return { count: all.length, bytes: all.length ? zipSync(files, { level: 0 }) : null }
}
