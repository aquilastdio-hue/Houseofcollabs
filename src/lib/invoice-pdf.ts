import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { amountInWords, stateName } from '@/lib/gst'
import type { Invoice, InvoiceLine, InvoiceParty } from '@/services/billing.service'
import { lines as readLines, meta as readMeta, party as readParty } from '@/services/billing.service'

/**
 * A billing document as an A4 PDF, drawn from the snapshot the database froze
 * when it issued it, so a download always shows what was issued.
 *
 * Load this module lazily (`await import('@/lib/invoice-pdf')`): pdf-lib is
 * large and only needed when someone presses Download.
 *
 * The 14 standard PDF fonts have no ₹ sign (or any non-Latin script), so
 * amounts read "Rs." and other characters are replaced by `?`.
 */

const A4 = { w: 595.28, h: 841.89 }
const M = 40 // page margin
const INK = rgb(0.08, 0.07, 0.08)
const MUTED = rgb(0.42, 0.4, 0.44)
const LINE = rgb(0.86, 0.85, 0.88)
const TINT = rgb(0.96, 0.96, 0.97)

/** WinAnsi can't encode ₹ or Indic scripts; keep what it can. */
function safe(text: string | number | null | undefined) {
  return String(text ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
}

export function money(n: number | string | null | undefined) {
  const v = Number(n ?? 0)
  return `Rs. ${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Bare figures for narrow table columns, where the header says "Rs.". */
function num(n: number | string | null | undefined) {
  return Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function date(value: string | null | undefined) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

const KIND_LABEL: Record<string, string> = {
  creator_service: 'Creator services',
  brand_commission: 'Brand commission',
  creator_commission: 'Creator commission',
  settlement: 'Payout',
  credit_note: 'Credit note',
}

type Ctx = { page: PDFPage; font: PDFFont; bold: PDFFont; y: number; doc: PDFDocument }

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = []
  for (const para of safe(text).split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= width) line = next
      else {
        if (line) out.push(line)
        line = word
      }
    }
    out.push(line)
  }
  return out
}

function text(ctx: Ctx, value: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; right?: boolean } = {}) {
  const size = opts.size ?? 9
  const font = opts.bold ? ctx.bold : ctx.font
  const s = safe(value)
  const dx = opts.right ? font.widthOfTextAtSize(s, size) : 0
  ctx.page.drawText(s, { x: x - dx, y, size, font, color: opts.color ?? INK })
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed > M + 30) return
  ctx.page = ctx.doc.addPage([A4.w, A4.h])
  ctx.y = A4.h - M
}

function partyBlock(ctx: Ctx, label: string, p: InvoiceParty, x: number, width: number) {
  let y = ctx.y
  text(ctx, label.toUpperCase(), x, y, { size: 7.5, bold: true, color: MUTED })
  y -= 14
  for (const l of wrap(p.name ?? '', ctx.bold, 10.5, width)) {
    text(ctx, l, x, y, { size: 10.5, bold: true })
    y -= 13
  }
  if (p.brand_name && p.brand_name !== p.name) {
    text(ctx, p.brand_name, x, y, { color: MUTED })
    y -= 12
  }
  const addr = [p.address, [p.city, p.pincode].filter(Boolean).join(' '), p.state_code ? `${stateName(p.state_code)} (${p.state_code})` : '']
    .filter(Boolean)
    .join(', ')
  for (const l of wrap(addr, ctx.font, 9, width)) {
    text(ctx, l, x, y, { color: MUTED })
    y -= 11.5
  }
  const ids = [
    p.gstin ? `GSTIN: ${p.gstin}` : 'GSTIN: Unregistered',
    p.pan ? `PAN: ${p.pan}` : '',
    p.tan ? `TAN: ${p.tan}` : '',
    p.email ?? '',
  ].filter(Boolean)
  for (const l of ids) {
    text(ctx, l, x, y)
    y -= 11.5
  }
  return y
}

function table(ctx: Ctx, cols: { label: string; width: number; right?: boolean }[], rows: string[][]) {
  const x0 = M
  const total = cols.reduce((s, c) => s + c.width, 0)
  ensureSpace(ctx, 40)
  ctx.page.drawRectangle({ x: x0, y: ctx.y - 6, width: total, height: 20, color: TINT })
  let x = x0
  for (const c of cols) {
    text(ctx, c.label, c.right ? x + c.width - 6 : x + 6, ctx.y, { size: 8, bold: true, color: MUTED, right: c.right })
    x += c.width
  }
  ctx.y -= 22
  for (const row of rows) {
    const wrapped = row.map((cell, i) => wrap(cell, ctx.font, 9, cols[i]!.width - 12))
    const height = Math.max(...wrapped.map((w) => w.length)) * 11.5 + 6
    ensureSpace(ctx, height + 4)
    x = x0
    wrapped.forEach((cellLines, i) => {
      const c = cols[i]!
      cellLines.forEach((l, j) => text(ctx, l, c.right ? x + c.width - 6 : x + 6, ctx.y - j * 11.5, { right: c.right }))
      x += c.width
    })
    // Rule just under this row's last line, clear of the next row's text.
    const ruleY = ctx.y - (height - 6 - 11.5) - 5
    ctx.page.drawLine({ start: { x: x0, y: ruleY }, end: { x: x0 + total, y: ruleY }, thickness: 0.5, color: LINE })
    ctx.y -= height
  }
}

function totalsRow(ctx: Ctx, label: string, value: string, opts: { strong?: boolean } = {}) {
  ensureSpace(ctx, 16)
  const right = A4.w - M
  text(ctx, label, right - 140, ctx.y, { right: true, bold: opts.strong, size: opts.strong ? 10.5 : 9, color: opts.strong ? INK : MUTED })
  text(ctx, value, right, ctx.y, { right: true, bold: opts.strong, size: opts.strong ? 10.5 : 9 })
  ctx.y -= opts.strong ? 16 : 13
}

export async function invoicePdf(inv: Invoice): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`${inv.document_title} ${inv.number}`)
  doc.setAuthor('House of Collabs')
  doc.setCreationDate(new Date(inv.issued_at))
  const ctx: Ctx = {
    doc,
    page: doc.addPage([A4.w, A4.h]),
    font: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    y: A4.h - M,
  }
  const supplier = readParty(inv.supplier)
  const recipient = readParty(inv.recipient)
  const m = readMeta(inv.meta)
  const items = readLines(inv.lines)
  const isSettlement = inv.kind === 'settlement'

  // ------------------------------------------------------------- heading
  text(ctx, inv.document_title.toUpperCase(), M, ctx.y - 6, { size: 18, bold: true })
  text(ctx, inv.number, A4.w - M, ctx.y - 2, { size: 11, bold: true, right: true })
  text(ctx, `Date: ${date(inv.issued_at)}   ·   FY ${inv.financial_year}`, A4.w - M, ctx.y - 16, { right: true, color: MUTED })
  ctx.y -= 26
  const subtitle =
    inv.issuer === 'creator'
      ? `Issued by ${m.issued_on_behalf_by ?? 'House of Collabs'} on behalf of the supplier, through its marketplace.`
      : inv.kind === 'settlement'
        ? `Payout of your earnings${m.payout_reference ? ` · Reference ${m.payout_reference}` : ''}`
        : inv.kind === 'credit_note'
        ? `Credit note against ${m.original_number ?? 'the original invoice'}.`
        : `${KIND_LABEL[inv.kind] ?? ''}${m.order_number ? ` · Order ${m.order_number}` : ''}`
  text(ctx, subtitle, M, ctx.y, { color: MUTED })
  ctx.y -= 22
  ctx.page.drawLine({ start: { x: M, y: ctx.y + 8 }, end: { x: A4.w - M, y: ctx.y + 8 }, thickness: 0.8, color: LINE })

  // ------------------------------------------------------------- parties
  const half = (A4.w - 2 * M - 20) / 2
  const startY = ctx.y
  const leftEnd = partyBlock(ctx, isSettlement ? 'Paid by' : 'From (supplier)', supplier, M, half)
  ctx.y = startY
  const rightEnd = partyBlock(ctx, isSettlement ? 'Paid to' : 'Bill to (recipient)', recipient, M + half + 20, half)
  ctx.y = Math.min(leftEnd, rightEnd) - 8

  if (!isSettlement) {
    const facts = [
      inv.place_of_supply ? `Place of supply: ${stateName(inv.place_of_supply)} (${inv.place_of_supply})` : '',
      m.order_number ? `Order: ${m.order_number}` : '',
      inv.gst_rate > 0 ? 'Reverse charge: No' : '',
    ].filter(Boolean)
    text(ctx, facts.join('    ·    '), M, ctx.y, { color: MUTED })
    ctx.y -= 20
  }

  // ---------------------------------------------------------------- lines
  if (isSettlement) {
    table(
      ctx,
      [
        { label: 'Order', width: 74 },
        { label: 'Work', width: 121.28 },
        { label: 'Fee (Rs.)', width: 64, right: true },
        { label: 'GST', width: 54, right: true },
        { label: 'Commission', width: 62, right: true },
        { label: 'TDS', width: 44, right: true },
        { label: 'TCS', width: 44, right: true },
        { label: 'Paid (Rs.)', width: 52, right: true },
      ],
      items.map((l: InvoiceLine) => [
        l.order_number ?? '',
        l.description,
        num(l.fee),
        num(l.creator_gst),
        l.commission_deducted ? `-${num(l.commission_deducted)}` : '-',
        l.tds ? `-${num(l.tds)}` : '-',
        l.tcs ? `-${num(l.tcs)}` : '-',
        num(l.amount),
      ]),
    )
    ctx.y -= 10
    totalsRow(ctx, 'Gross (fee + GST)', money(inv.total_amount))
    if (Number(m.commission_deducted ?? 0) > 0) totalsRow(ctx, 'Commission deducted', `- ${money(m.commission_deducted)}`)
    totalsRow(ctx, 'TDS (s.194-O)', `- ${money(inv.tds_amount)}`)
    totalsRow(ctx, 'GST TCS (s.52)', `- ${money(inv.tcs_amount)}`)
    totalsRow(ctx, 'Paid to you', money(inv.net_amount), { strong: true })
    if (m.payout_reference) {
      ctx.y -= 4
      text(ctx, `Transfer reference: ${m.payout_reference}`, M, ctx.y, { color: MUTED })
      ctx.y -= 14
    }
    text(ctx, 'TDS and TCS are paid to the government in your name; they appear in your Form 26AS / GST portal.', M, ctx.y, { color: MUTED, size: 8 })
    ctx.y -= 12
  } else {
    table(
      ctx,
      [
        { label: '#', width: 24 },
        { label: 'Description', width: 251.28 },
        { label: 'SAC', width: 60 },
        { label: 'Qty', width: 40, right: true },
        { label: 'Rate', width: 70, right: true },
        { label: 'Amount', width: 70, right: true },
      ],
      items.map((l, i) => [String(i + 1), l.description, l.sac ?? inv.sac ?? '', String(l.quantity ?? 1), money(l.rate ?? l.amount), money(l.amount)]),
    )
    ctx.y -= 10
    totalsRow(ctx, 'Taxable value', money(inv.taxable_amount))
    const half = Number(inv.gst_rate) / 2
    if (Number(inv.cgst_amount) > 0) totalsRow(ctx, `CGST @ ${half}%`, money(inv.cgst_amount))
    if (Number(inv.sgst_amount) > 0) totalsRow(ctx, `SGST @ ${half}%`, money(inv.sgst_amount))
    if (Number(inv.igst_amount) > 0) totalsRow(ctx, `IGST @ ${Number(inv.gst_rate)}%`, money(inv.igst_amount))
    if (Number(inv.gst_rate) === 0 && inv.kind !== 'credit_note') totalsRow(ctx, 'GST', 'Not applicable')
    totalsRow(ctx, 'Total', money(inv.total_amount), { strong: true })
    ctx.y -= 2
    for (const l of wrap(amountInWords(Number(inv.total_amount)), ctx.font, 9, A4.w - 2 * M)) {
      text(ctx, l, M, ctx.y, { color: MUTED })
      ctx.y -= 12
    }
    ctx.y -= 6
    const status =
      inv.status === 'paid'
        ? `Paid${inv.paid_at ? ` on ${date(inv.paid_at)}` : ''}`
        : inv.status === 'unpaid' || inv.status === 'partially_paid'
          ? `Amount due: ${money(Number(inv.total_amount) - Number(inv.amount_paid))}`
          : inv.status === 'credited'
            ? 'Credited (see credit note)'
            : inv.status === 'cancelled'
              ? 'Cancelled'
              : 'Issued'
    text(ctx, `Status: ${status}`, M, ctx.y, { bold: true })
    ctx.y -= 16
  }

  // --------------------------------------------------------------- footer
  ensureSpace(ctx, 40)
  const note = inv.issuer === 'hoc' ? supplier.note : null
  if (note) {
    for (const l of wrap(note, ctx.font, 8, A4.w - 2 * M)) {
      text(ctx, l, M, ctx.y, { size: 8, color: MUTED })
      ctx.y -= 10
    }
  }
  for (const page of doc.getPages()) {
    page.drawText(safe('Computer-generated document; no signature required. House of Collabs · www.houseofcollabs.com'), {
      x: M,
      y: M - 14,
      size: 7.5,
      font: ctx.font,
      color: MUTED,
    })
  }
  return doc.save()
}

/** Builds the PDF and hands it to the browser as a download. */
export async function downloadInvoicePdf(inv: Invoice) {
  const bytes = await invoicePdf(inv)
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${inv.number.replace(/\//g, '-')}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
