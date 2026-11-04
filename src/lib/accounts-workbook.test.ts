import { describe, expect, it, vi } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'

vi.mock('@/services/billing.service', () => ({
  getAdminBillingSummary: vi.fn(async () => ({
    transaction_value: 1357, refunds: 0, hoc_revenue: 300, brand_commission_revenue: 150, creator_commission_revenue: 150,
    gst_collected: 54, tds_withheld: 1, tcs_collected: 5, creator_payouts: 1174, commission_payments: 177, tax_deposited: 0,
    gst_payable: 54, tds_payable: 1, tcs_payable: 5, pending_settlements: 0, outstanding_creator_commissions: 0,
  })),
  accountsExport: vi.fn(async () => ({
    orders: [{ date: '2026-11-04', order: 'HOC-1', total: 1357, test: false }],
    payments: [{ date: '2026-11-04', order: 'HOC-1', amount: 1357, razorpay_payment: 'pay_1' }],
    refunds: [],
    earnings: [{ order: 'HOC-1', gross: 1180, tds: 1, tcs: 5, net: 1174 }],
    payouts: [{ reference: 'HOC-PO-1', amount: 1174, utr: 'UTR1' }],
    ledger: [{ date: '2026-11-04', account: 'gateway_clearing', debit: 1357, credit: null }],
  })),
  invoiceRegister: vi.fn(async () => [{ number: 'BC/2627/000001', taxable: 150, cgst: 13.5, sgst: 13.5, igst: 0, total: 177 }]),
  withholdingRegister: vi.fn(async () => [{ tax: 'tds_194o', pan: 'ABCDE1234F', base: 1000, rate: 0.1, amount: 1 }]),
  listInvoices: vi.fn(),
}))

describe('accountsWorkbook', () => {
  it('has the summary and one sheet per book, with readable headings', async () => {
    const { accountsWorkbook } = await import('./accounts-workbook')
    const book = unzipSync(await accountsWorkbook('2026-04-01', '2026-11-04', false))
    const names = [...strFromU8(book['xl/workbook.xml']!).matchAll(/name="([^"]+)"/g)].map((m) => m[1])
    expect(names).toEqual(['Summary', 'Invoices', 'Orders', 'Brand payments', 'Refunds', 'Creator earnings', 'Payouts', 'TDS &amp; TCS', 'Ledger'])
    expect(strFromU8(book['xl/worksheets/sheet1.xml']!)).toContain('HOC revenue, total (excl. GST)')
    const invoices = strFromU8(book['xl/worksheets/sheet2.xml']!)
    expect(invoices).toContain('Taxable value')
    expect(invoices).toContain('<c r="B2" s="2"><v>150</v></c>') // money column
    expect(strFromU8(book['xl/worksheets/sheet5.xml']!)).toContain('Nothing in this period.')
  })
})
