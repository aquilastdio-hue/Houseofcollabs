import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

/**
 * A small Excel (.xlsx) writer for the admin exports: several sheets, a bold
 * frozen header row, sensible column widths, and real numbers (so the
 * accountant can sum a column). No styles beyond that, no formulas.
 *
 * An .xlsx file is a zip of XML parts; this writes the minimum Excel, Google
 * Sheets and LibreOffice need.
 */
export type Cell = string | number | boolean | null | undefined
export type Sheet = {
  name: string
  rows: Cell[][]
  /** Column indexes (0-based) to show with two decimals, e.g. rupee amounts. */
  money?: number[]
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

function esc(text: string) {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // not allowed in XML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number) {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const r = (n - 1) % 26
    name = String.fromCharCode(65 + r) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

/** Excel sheet names: 31 characters, none of []:*?/\ and unique. */
function sheetNames(sheets: Sheet[]) {
  const used = new Set<string>()
  return sheets.map((s, i) => {
    const base = (s.name.replace(/[[\]:*?/\\]/g, ' ').trim() || `Sheet ${i + 1}`).slice(0, 31)
    let name = base
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 28)} ${n}`
    used.add(name.toLowerCase())
    return name
  })
}

function cellXml(ref: string, value: Cell, header: boolean, money: boolean) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value) && !header) {
    return `<c r="${ref}"${money ? ' s="2"' : ''}><v>${value}</v></c>`
  }
  const text = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
  return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(text)}</t></is></c>`
}

function sheetXml(sheet: Sheet) {
  const money = new Set(sheet.money ?? [])
  const widths: number[] = []
  const rows = sheet.rows.map((row, r) => {
    const cells = row
      .map((value, c) => {
        const len = value === null || value === undefined ? 0 : String(value).length
        widths[c] = Math.max(widths[c] ?? 8, Math.min(len + 2, 60))
        return cellXml(`${columnName(c)}${r + 1}`, value, r === 0, money.has(c))
      })
      .join('')
    return `<row r="${r + 1}">${cells}</row>`
  })
  const cols = widths.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const frozen =
    sheet.rows.length > 1
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : ''
  return `${XML_HEAD}<worksheet xmlns="${NS}">${frozen}${cols}<sheetData>${rows.join('')}</sheetData></worksheet>`
}

const STYLES = `${XML_HEAD}<styleSheet xmlns="${NS}">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
</styleSheet>`

/** The workbook as bytes, ready to download as `something.xlsx`. */
export function writeXlsx(sheets: Sheet[]): Uint8Array {
  const names = sheetNames(sheets)
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `${XML_HEAD}<workbook xmlns="${NS}" xmlns:r="${REL_NS}"><sheets>` +
        names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES),
  }
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))
  })
  return zipSync(files, { level: 6 })
}

/** Hands bytes to the browser as a download. */
export function downloadBytes(bytes: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// ------------------------------------------------------------------- read ---
const unescapeXml = (t: string) =>
  t
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** All the text runs inside a string item, joined. */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1]!)).join('')

function columnIndex(ref: string) {
  const letters = ref.replace(/[0-9]/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/**
 * The first sheet of an .xlsx as rows of text, as Excel saves it after
 * someone edits it (shared strings, numbers, inline strings). Enough to read
 * back a sheet we sent out; not a general spreadsheet parser.
 */
export function readXlsx(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes)
  const sheet = files['xl/worksheets/sheet1.xml']
  if (!sheet) throw new Error('No worksheet found in this file.')
  const shared = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!))
    : []
  const rows: string[][] = []
  for (const rowMatch of strFromU8(sheet).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = []
    for (const cell of rowMatch[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1]!
      const inner = cell[2] ?? ''
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1]
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1]
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      let value = ''
      if (type === 's') value = shared[Number(raw)] ?? ''
      else if (type === 'inlineStr') value = textOf(inner)
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE'
      else value = raw !== undefined ? unescapeXml(raw) : ''
      row[ref ? columnIndex(ref) : row.length] = value
    }
    rows.push(Array.from(row, (v) => v ?? ''))
  }
  return rows
}
