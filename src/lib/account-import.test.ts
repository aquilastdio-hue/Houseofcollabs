import { describe, expect, it } from 'vitest'
import { parseFollowers, readImportFile, templateCsv } from './account-import'
import { toCsv } from './csv'

describe('readImportFile', () => {
  it('reads the creator template', () => {
    const { rows, problems } = readImportFile(templateCsv('creator'), 'creator')
    expect(problems).toEqual([])
    expect(rows).toEqual([
      {
        line: 2,
        email: 'riya@example.com',
        name: 'Riya Sharma',
        phone: '+91 98765 43210',
        instagram: '@riyasharma',
        city: 'Delhi',
        followers: 12500,
        categories: ['Fashion', 'Beauty'],
        state: 'Delhi',
        bio: 'Fashion and lifestyle creator from Delhi.',
      },
    ])
  })

  it('matches loose headers, ignores extra columns, and prefers the exact "Name" over "Full name"', () => {
    const csv = toCsv(['Full name', 'Name', 'E-mail', 'WhatsApp number', 'Orders'], [['Riya S', 'Riya', 'RIYA@x.in', "'+91 99999 00000", '3']])
    const { rows } = readImportFile(csv, 'creator')
    expect(rows[0]).toMatchObject({
      name: 'Riya',
      email: 'riya@x.in',
      phone: '+91 99999 00000',
    })
  })

  it('says which required column is missing', () => {
    expect(readImportFile(toCsv(['Name'], [['Riya']]), 'creator').problems[0]!.message).toBe('The file needs a “Email” column.')
  })

  it('reports bad and repeated rows with their line numbers, and keeps the good ones', () => {
    const csv = toCsv(
      ['Name', 'Email'],
      [
        ['Riya', 'riya@x.in'],
        ['Ayush', 'not-an-email'],
        ['R', 'r@x.in'],
        ['Riya again', 'Riya@x.in'],
      ],
    )
    const { rows, problems } = readImportFile(csv, 'creator')
    expect(rows.map((r) => r.email)).toEqual(['riya@x.in'])
    expect(problems).toEqual([
      { line: 3, message: '“not-an-email” isn’t an email address.' },
      { line: 4, message: 'No name.' },
      { line: 5, message: 'riya@x.in is already on line 2.' },
    ])
  })

  it('needs a brand name for brands; the contact person is optional', () => {
    const csv = toCsv(
      ['Brand name', 'Email', 'Website'],
      [
        ['Aquila', 'a@x.in', 'aquila.in'],
        ['', 'b@x.in', ''],
      ],
    )
    const { rows, problems } = readImportFile(csv, 'brand')
    expect(rows).toEqual([
      {
        line: 2,
        email: 'a@x.in',
        name: null,
        brand_name: 'Aquila',
        phone: null,
        instagram: null,
        city: null,
        website: 'aquila.in',
        industry: null,
      },
    ])
    expect(problems).toEqual([{ line: 3, message: 'No brand name.' }])
  })
})

describe('parseFollowers', () => {
  it('understands K, M and commas', () => {
    expect(parseFollowers('12.5K')).toBe(12500)
    expect(parseFollowers('1.2m')).toBe(1200000)
    expect(parseFollowers('12,000')).toBe(12000)
    expect(parseFollowers('lots')).toBeNull()
    expect(parseFollowers('')).toBeNull()
  })
})
