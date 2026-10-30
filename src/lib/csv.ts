/**
 * CSV the way Google Sheets and Excel write and read it (RFC 4180): commas,
 * double-quoted cells, "" for a quote inside one, line breaks allowed inside
 * quotes.
 */

/**
 * A cell starting with = + - or @ is a formula to a spreadsheet, which can run
 * whatever someone typed into their bio. A leading ' keeps it as plain text.
 */
const FORMULA_START = /^[=+\-@\t\r]/

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = Array.isArray(value) ? value.join('; ') : String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}

/** Rows of cells; blank lines are dropped. Reads what `toCsv` writes, and what spreadsheets export. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  let started = false // anything on this line yet, so a trailing empty cell still counts

  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (quoted) {
      if (c !== '"') value += c
      else if (s[i + 1] === '"') {
        value += '"'
        i++
      } else quoted = false
    } else if (c === '"' && value === '') {
      quoted = true
      started = true
    } else if (c === ',') {
      row.push(value)
      value = ''
      started = true
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      if (started || value) row.push(value)
      if (row.length) rows.push(row)
      row = []
      value = ''
      started = false
    } else {
      value += c
      started = true
    }
  }
  if (started || value) row.push(value)
  if (row.length) rows.push(row)
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

/** Undoes `cell`'s formula guard, for a file that went out of here and is coming back. */
export function uncell(value: string): string {
  const v = value.trim()
  return v.startsWith("'") && FORMULA_START.test(v.slice(1)) ? v.slice(1) : v
}

/** Saves a CSV to the device. The BOM makes Excel read ₹ and emoji as UTF-8. */
export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
