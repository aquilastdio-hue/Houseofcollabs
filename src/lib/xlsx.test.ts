import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { columnName, readXlsx, writeXlsx } from './xlsx'
import { readUtrSheet, payoutSheetWorkbook } from './payout-sheet'

describe('writeXlsx', () => {
  const book = unzipSync(
    writeXlsx([
      { name: 'Payouts', rows: [['Creator', 'Amount', 'Paid'], ['Rawal & Co <LLP>', 1174.5, true], ['Asha', 999, null]], money: [1] },
      { name: 'TDS/TCS: register?', rows: [['Only a header']] },
      { name: 'Payouts', rows: [] },
    ]),
  )

  it('writes the parts Excel needs', () => {
    for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet3.xml']) {
      expect(book[part], part).toBeDefined()
    }
  })

  it('makes sheet names legal and unique', () => {
    const wb = strFromU8(book['xl/workbook.xml']!)
    expect(wb).toContain('name="Payouts"')
    expect(wb).toContain('name="TDS TCS  register"')
    expect(wb).toContain('name="Payouts 2"')
  })

  it('escapes text, keeps numbers numeric and formats money', () => {
    const sheet = strFromU8(book['xl/worksheets/sheet1.xml']!)
    expect(sheet).toContain('Rawal &amp; Co &lt;LLP&gt;')
    expect(sheet).toContain('<c r="B2" s="2"><v>1174.5</v></c>')
    expect(sheet).toContain('<t xml:space="preserve">Yes</t>')
    expect(sheet).toContain('state="frozen"')
    expect(sheet).not.toContain('r="C3"') // empty cell left out
  })

  it('names columns past Z', () => {
    expect([0, 25, 26, 51, 52, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA'])
  })
})

describe('readXlsx', () => {
  it('reads back what writeXlsx wrote', () => {
    const rows = readXlsx(writeXlsx([{ name: 'A', rows: [['Name', 'Amount'], ['Asha & Co', 999.5], ['', 3]] }]))
    expect(rows).toEqual([['Name', 'Amount'], ['Asha & Co', '999.5'], ['', '3']])
  })

  it('reads a sheet Excel re-saved with shared strings', () => {
    const sheet =
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>412345678901</v></c></row></sheetData></worksheet>'
    const shared = '<sst><si><t>Payout ID</t></si><si><r><t>U</t></r><r><t>TR</t></r></si><si><t>98ea7a3e-7d91-46dd-b1a2-d25880f72aec</t></si></sst>'
    const rows = readXlsx(zipSync({ 'xl/worksheets/sheet1.xml': strToU8(sheet), 'xl/sharedStrings.xml': strToU8(shared) }))
    expect(rows).toEqual([['Payout ID', '', 'UTR'], ['98ea7a3e-7d91-46dd-b1a2-d25880f72aec', '', '412345678901']])
    expect(readUtrSheet(rows)).toEqual([{ payout_request_id: '98ea7a3e-7d91-46dd-b1a2-d25880f72aec', reference: '412345678901' }])
  })
})

describe('payout sheet round trip', () => {
  it('the sent sheet, filled in, reads back as payouts to mark paid', () => {
    const row = {
      payout_request_id: 'id-1', reference: 'HOC-PO-1', requested_at: '2026-11-04T10:00:00Z', status: 'pending', creator: 'Asha',
      legal_name: null, pan: null, gstin: null, email: null, phone: null, method: 'upi' as const, account_holder: 'Asha', upi_id: 'asha@upi',
      account_number: null, ifsc: null, bank: null, amount: 95, gross: 100, commission_deducted: 0, tds: 5, tcs: 0, orders: 'HOC-1', test: false,
    }
    const [payouts] = payoutSheetWorkbook([row, { ...row, payout_request_id: 'id-2' }])
    const table = readXlsx(writeXlsx([payouts!])).map((r) => [...r])
    const utr = table[0]!.indexOf('UTR')
    table[1]![utr] = 'UTR111'
    expect(readUtrSheet(table)).toEqual([{ payout_request_id: 'id-1', reference: 'UTR111' }])
  })
})
