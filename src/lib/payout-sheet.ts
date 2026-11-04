import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { PayoutSheetRow } from '@/services/billing.service'
import type { Sheet } from '@/lib/xlsx'

/**
 * The payout sheet HOC's accountant pays from (Admin → Payouts → Bank
 * transfers): one row per creator with where to send the money, how much,
 * and a blank UTR column. The Excel version comes back with the UTRs filled
 * in and is uploaded to mark everything paid, so its "Payout ID" and "UTR"
 * headings must stay as they are (see `readUtrSheet`).
 *
 * Load lazily: pdf-lib is large.
 */

export const PAYOUT_ID_HEADER = 'Payout ID'
export const UTR_HEADER = 'UTR'

const payTo = (r: PayoutSheetRow) => (r.method === 'upi' ? `UPI ${r.upi_id ?? ''}` : `A/c ${r.account_number ?? ''} · IFSC ${r.ifsc ?? ''}`)

export function payoutSheetWorkbook(rows: PayoutSheetRow[]): Sheet[] {
  const header = [
    'Reference', 'Creator', 'Legal name', 'PAN', 'GSTIN', 'Method', 'Account holder', 'UPI ID', 'Account number', 'IFSC', 'Bank',
    'Amount to pay', 'Gross (fee + GST)', 'Commission deducted', 'TDS', 'TCS', 'Orders', 'Email', 'Phone', 'Requested', UTR_HEADER, 'Paid on', PAYOUT_ID_HEADER,
  ]
  const body = rows.map((r) => [
    r.reference, r.creator, r.legal_name, r.pan, r.gstin, r.method === 'upi' ? 'UPI' : r.method === 'bank_transfer' ? 'Bank transfer' : '',
    r.account_holder, r.upi_id,
    // Text, not a number: Excel would turn a long account number into 1.23E+11.
    r.account_number ? `${r.account_number}` : null,
    r.ifsc, r.bank, Number(r.amount), Number(r.gross), Number(r.commission_deducted), Number(r.tds), Number(r.tcs),
    r.orders, r.email, r.phone, r.requested_at?.slice(0, 10), '', '', r.payout_request_id,
  ])
  const total = rows.reduce((s, r) => s + Number(r.amount), 0)
  return [
    { name: 'Payouts', rows: [header, ...body], money: [11, 12, 13, 14, 15] },
    {
      name: 'How to use',
      rows: [
        ['Creator payout sheet, House of Collabs'],
        [`${rows.length} payouts, total ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
        [''],
        ['1. Transfer "Amount to pay" to each creator by UPI or bank transfer (IMPS / NEFT).'],
        ['2. Write the bank’s UTR / transaction reference in the UTR column.'],
        ['3. Send the sheet back. Admin → Payouts → Bank transfers → Upload paid sheet marks them all paid.'],
        ['Keep the Payout ID column as it is: it is how each row is matched.'],
        ['TDS and TCS are already deducted from "Amount to pay". Deposit them with the government separately.'],
      ],
    },
  ]
}

// ------------------------------------------------------------------- PDF ---
const PAGE = { w: 841.89, h: 595.28 } // A4 landscape
const M = 32
const INK = rgb(0.08, 0.07, 0.08)
const MUTED = rgb(0.42, 0.4, 0.44)
const LINE = rgb(0.86, 0.85, 0.88)
const TINT = rgb(0.96, 0.96, 0.97)

const safe = (t: string | number | null | undefined) =>
  String(t ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?')

const num = (n: number | string | null | undefined) => Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = []
  let line = ''
  for (const word of safe(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width) line = next
    else {
      if (line) out.push(line)
      line = word
    }
  }
  if (line) out.push(line)
  return out.length ? out : ['']
}

export async function payoutSheetPdf(rows: PayoutSheetRow[], opts: { company?: string; generatedAt?: Date } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('Creator payout sheet')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const generated = opts.generatedAt ?? new Date()
  const total = rows.reduce((s, r) => s + Number(r.amount), 0)

  const cols = [
    { label: '#', w: 22 },
    { label: 'Reference', w: 92 },
    { label: 'Creator / legal name', w: 128 },
    { label: 'PAN', w: 70 },
    { label: 'Pay to', w: 190 },
    { label: 'Amount (Rs.)', w: 72, right: true },
    { label: 'TDS / TCS', w: 58, right: true },
    { label: 'Orders', w: 80 },
    { label: 'UTR', w: 65.89 },
  ]
  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h])
  let y = PAGE.h - M

  const text = (s: string, x: number, yy: number, o: { size?: number; b?: boolean; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const f = o.b ? bold : font
    const size = o.size ?? 8.5
    const v = safe(s)
    page.drawText(v, { x: o.right ? x - f.widthOfTextAtSize(v, size) : x, y: yy, size, font: f, color: o.color ?? INK })
  }
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: PAGE.w - 2 * M, height: 18, color: TINT })
    let x = M
    for (const c of cols) {
      text(c.label, c.right ? x + c.w - 5 : x + 5, y, { size: 7.5, b: true, color: MUTED, right: c.right })
      x += c.w
    }
    y -= 20
  }

  text('CREATOR PAYOUT SHEET', M, y - 4, { size: 15, b: true })
  text(`${opts.company ?? 'House of Collabs'} · generated ${generated.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, PAGE.w - M, y, {
    right: true,
    color: MUTED,
  })
  y -= 20
  text(`${rows.length} payout${rows.length === 1 ? '' : 's'} · total Rs. ${num(total)}. TDS / TCS are already deducted from each amount.`, M, y, { color: MUTED })
  y -= 22
  header()

  rows.forEach((r, i) => {
    const cells = [
      String(i + 1),
      r.reference,
      `${r.creator}${r.legal_name && r.legal_name !== r.creator ? ` (${r.legal_name})` : ''}`,
      r.pan ?? '-',
      `${payTo(r)}${r.method === 'bank_transfer' && r.bank ? ` · ${r.bank}` : ''} · ${r.account_holder ?? ''}`,
      num(r.amount),
      Number(r.tds) + Number(r.tcs) > 0 ? `${num(r.tds)} / ${num(r.tcs)}` : '-',
      r.orders,
      '',
    ]
    const wrapped = cells.map((c, j) => wrap(c, font, 8.5, cols[j]!.w - 10))
    const height = Math.max(...wrapped.map((w) => w.length)) * 11 + 8
    if (y - height < M + 60) {
      page = doc.addPage([PAGE.w, PAGE.h])
      y = PAGE.h - M
      header()
    }
    let x = M
    wrapped.forEach((lines, j) => {
      const c = cols[j]!
      lines.forEach((l, k) => text(l, c.right ? x + c.w - 5 : x + 5, y - k * 11, { right: c.right }))
      x += c.w
    })
    // Rule just under this row's last line, clear of the next row's text.
    const ruleY = y - (height - 8 - 11) - 5
    page.drawLine({ start: { x: M, y: ruleY }, end: { x: PAGE.w - M, y: ruleY }, thickness: 0.5, color: LINE })
    y -= height
  })

  y -= 8
  text(`Total: Rs. ${num(total)}`, PAGE.w - M, y, { size: 10.5, b: true, right: true })
  y -= 40
  if (y < M + 20) {
    page = doc.addPage([PAGE.w, PAGE.h])
    y = PAGE.h - M - 40
  }
  for (const [label, x] of [['Prepared by', M], ['Approved by', M + 260], ['Paid on', M + 520]] as const) {
    page.drawLine({ start: { x, y }, end: { x: x + 200, y }, thickness: 0.6, color: MUTED })
    text(label, x, y - 12, { color: MUTED })
  }
  for (const p of doc.getPages()) {
    p.drawText(safe('Confidential: contains bank details. Share only with the accountant making these transfers.'), {
      x: M,
      y: M - 16,
      size: 7.5,
      font,
      color: MUTED,
    })
  }
  return doc.save()
}

/**
 * The paid sheet coming back: rows (from CSV or the Excel sheet) → the
 * payouts to mark paid. Only rows with both a Payout ID and a UTR count.
 */
export function readUtrSheet(table: string[][]): { payout_request_id: string; reference: string }[] {
  const headerIndex = table.findIndex((row) => row.some((c) => c.trim().toLowerCase() === PAYOUT_ID_HEADER.toLowerCase()))
  if (headerIndex < 0) return []
  const header = table[headerIndex]!.map((c) => c.trim().toLowerCase())
  const idCol = header.indexOf(PAYOUT_ID_HEADER.toLowerCase())
  // "UTR" exactly: the sheet also has a "Reference" column (our HOC-PO-… id).
  const utrCol = header.indexOf(UTR_HEADER.toLowerCase())
  if (idCol < 0 || utrCol < 0) return []
  return table
    .slice(headerIndex + 1)
    .map((row) => ({ payout_request_id: (row[idCol] ?? '').trim(), reference: (row[utrCol] ?? '').trim() }))
    .filter((r) => r.payout_request_id && r.reference)
}
