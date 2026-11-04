import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { invoicePdf, money } from './invoice-pdf'
import type { Invoice } from '@/services/billing.service'

const base: Invoice = {
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'creator_service',
  document_title: 'Tax Invoice',
  number: 'C4B645/2627/0001',
  series: 'C4B645',
  financial_year: '2026-27',
  issued_at: '2026-11-04T06:30:00Z',
  issuer: 'creator',
  order_id: null,
  payout_request_id: null,
  original_invoice_id: null,
  refund_id: null,
  brand_id: null,
  creator_id: null,
  supplier: { name: 'Rawal Media LLP', gstin: '07ABCDE1234F1Z5', state_code: '07', address: 'Saket', city: 'New Delhi' },
  recipient: { name: 'Aquila Studio Pvt Ltd', gstin: '06AAACA1234A1Z5', state_code: '06' },
  lines: [{ description: 'One reel — 30 seconds, with ₹ in the brief', sac: '998361', quantity: 1, rate: 1000, amount: 1000 }],
  place_of_supply: '06',
  sac: '998361',
  gst_rate: 18,
  taxable_amount: 1000,
  cgst_amount: 0,
  sgst_amount: 0,
  igst_amount: 180,
  total_amount: 1180,
  tds_amount: 0,
  tcs_amount: 0,
  net_amount: null,
  status: 'paid',
  amount_paid: 1180,
  credited_amount: 0,
  paid_at: '2026-11-04T06:30:00Z',
  visible_to_brand: true,
  visible_to_creator: true,
  is_test: false,
  meta: { order_number: 'HOC-010052', issued_on_behalf_by: 'House of Collabs' },
  created_at: '2026-11-04T06:30:00Z',
  updated_at: '2026-11-04T06:30:00Z',
}

describe('invoicePdf', () => {
  it('renders a tax invoice, including characters the PDF fonts lack', async () => {
    const bytes = await invoicePdf(base)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toBe('Tax Invoice C4B645/2627/0001')
  })

  it('renders a settlement statement and spills long ones onto more pages', async () => {
    const line = { description: 'Reel', order_number: 'HOC-1', fee: 1000, creator_gst: 180, commission_deducted: 0, tds: 1, tcs: 5, amount: 1174 }
    const bytes = await invoicePdf({
      ...base,
      kind: 'settlement',
      document_title: 'Settlement Statement',
      number: 'ST/2627/000001',
      issuer: 'hoc',
      lines: Array.from({ length: 60 }, () => line),
      total_amount: 70800,
      tds_amount: 60,
      tcs_amount: 300,
      net_amount: 70440,
      meta: { payout_reference: 'UTR123' },
    })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1)
  })

  it('prints rupees in Indian grouping', () => {
    expect(money(135700.5)).toBe('Rs. 1,35,700.50')
  })
})
