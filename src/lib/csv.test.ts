import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv, uncell } from './csv'

describe('toCsv', () => {
  it('quotes cells with commas, quotes and line breaks', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x, y', 'say "hi"'],
          ['two\nlines', null],
        ],
      ),
    ).toBe('a,b\r\n"x, y","say ""hi"""\r\n"two\nlines",')
  })

  it('joins lists and keeps formulas as text', () => {
    expect(toCsv(['c'], [[['Fashion', 'Beauty']], ['=HYPERLINK("x")'], ['+91 98765 43210']])).toBe(
      'c\r\nFashion; Beauty\r\n"\'=HYPERLINK(""x"")"\r\n\'+91 98765 43210',
    )
  })
})

describe('parseCsv', () => {
  it('reads what toCsv writes', () => {
    const rows = [
      ['Name', 'Bio'],
      ['Riya, Delhi', 'Line one\nLine "two"'],
      ['Ayush', ''],
    ]
    expect(parseCsv(toCsv(rows[0]!, rows.slice(1)))).toEqual(rows)
  })

  it('handles a BOM, CRLF, LF and blank lines', () => {
    expect(parseCsv('\uFEFFa,b\r\n1,2\n\n3,\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', ''],
    ])
  })

  it('undoes the formula guard on the way back in', () => {
    expect(uncell("'+91 98765 43210")).toBe('+91 98765 43210')
    expect(uncell("'s Choice")).toBe("'s Choice")
  })
})
