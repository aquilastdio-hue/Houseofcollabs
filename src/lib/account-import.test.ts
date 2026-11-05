import { describe, expect, it } from 'vitest'
import { exportPhone, importInstagram, importPhone, parseFollowers, readImportFile, templateCsv } from './account-import'
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
        phone: '+919876543210',
        instagram: 'riyasharma',
        city: 'Delhi',
        followers: 12500,
        categories: ['Fashion', 'Beauty'],
        state: 'Delhi',
        bio: 'Fashion and lifestyle creator from Delhi.',
        headline: 'Everyday fashion, honest reviews',
        gender: 'female',
        age: 24,
        languages: ['Hindi', 'English'],
        youtube: 'https://youtube.com/@riyasharma',
        youtube_subscribers: 8000,
        engagement_rate: 4.2,
      },
    ])
  })

  it('matches loose headers, ignores extra columns, and prefers the exact "Name" over "Full name"', () => {
    const csv = toCsv(
      ['Full name', 'Name', 'E-mail', 'WhatsApp number', 'Insta', 'Orders'],
      [['Riya S', 'Riya', 'RIYA@x.in', "'+91 99999 00000", 'https://www.instagram.com/Riya.S/', '3']],
    )
    const { rows } = readImportFile(csv, 'creator')
    expect(rows[0]).toMatchObject({
      name: 'Riya',
      email: 'riya@x.in',
      phone: '+919999900000',
      instagram: 'riya.s',
    })
  })

  it('says which required column is missing', () => {
    expect(readImportFile(toCsv(['Name'], [['Riya']]), 'creator').problems[0]!.message).toBe(
      'The file needs these columns: Email, WhatsApp, Instagram.',
    )
  })

  it('reports bad and repeated rows with their line numbers, and keeps the good ones', () => {
    const csv = toCsv(
      ['Name', 'Email', 'WhatsApp', 'Instagram'],
      [
        ['Riya', 'riya@x.in', '9876543210', '@riya'],
        ['Ayush', 'not-an-email', '9876543211', '@ayush'],
        ['R', 'r@x.in', '9876543212', '@r'],
        ['Riya again', 'Riya@x.in', '9876543213', '@riya2'],
        ['Kabir', 'kabir@x.in', '', '@kabir'],
        ['Meera', 'meera@x.in', '98765 4321', '@meera'],
        ['Zoya', 'zoya@x.in', '9876543214', ''],
        ['Ira', 'ira@x.in', '9876543215', 'not a handle!'],
        ['Riya twin', 'twin@x.in', '9876543216', 'RIYA'],
      ],
    )
    const { rows, problems } = readImportFile(csv, 'creator')
    expect(rows.map((r) => r.email)).toEqual(['riya@x.in'])
    expect(problems).toEqual([
      { line: 3, message: '“not-an-email” isn’t an email address.' },
      { line: 4, message: 'No name.' },
      { line: 5, message: 'riya@x.in is already on line 2.' },
      { line: 6, message: 'No WhatsApp number.' },
      { line: 7, message: '“98765 4321” isn’t a 10-digit mobile number.' },
      { line: 8, message: 'No Instagram ID.' },
      { line: 9, message: '“not a handle!” isn’t an Instagram ID.' },
      { line: 10, message: 'Instagram @riya is already on line 2.' },
    ])
  })

  it('takes each WhatsApp number once, however it is written', () => {
    const csv = toCsv(
      ['Name', 'Email', 'WhatsApp', 'Instagram'],
      [
        ['Riya', 'riya@x.in', '98765 43210', 'riya'],
        ['Ayush', 'ayush@x.in', '+91 98765 43210', 'ayush'],
        ['Kabir', 'kabir@x.in', '9876543211', 'kabir'],
      ],
    )
    const { rows, problems } = readImportFile(csv, 'creator')
    expect(rows.map((r) => r.phone)).toEqual(['+919876543210', '+919876543211'])
    expect(problems).toEqual([{ line: 3, message: 'WhatsApp +919876543210 is already on line 2.' }])
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

describe('optional creator details', () => {
  it('fills in what it can read and leaves the rest blank, without refusing the row', () => {
    const csv = toCsv(
      ['Name', 'Email', 'WhatsApp', 'Instagram', 'Gender', 'Age', 'Languages', 'YouTube', 'ER'],
      [
        ['Riya', 'riya@x.in', '9876543210', 'riya', 'F', '24', 'Hindi, English, Hindi', 'youtube.com/@riya', '3.5 %'],
        ['Ayush', 'ayush@x.in', '9876543211', 'ayush', 'robot', '7', '', 'https://example.com', 'lots'],
      ],
    )
    const { rows, problems } = readImportFile(csv, 'creator')
    expect(problems).toEqual([])
    expect(rows[0]).toMatchObject({ gender: 'female', age: 24, languages: ['Hindi', 'English'], youtube: 'https://youtube.com/@riya', engagement_rate: 3.5 })
    expect(rows[1]).toMatchObject({ gender: null, age: null, languages: [], youtube: null, engagement_rate: null })
  })
})

describe('importInstagram', () => {
  it('reads a handle, an @handle or a profile link', () => {
    expect(importInstagram('@Riya.Sharma')).toBe('riya.sharma')
    expect(importInstagram('https://instagram.com/riya_s?igsh=abc')).toBe('riya_s')
    expect(importInstagram('')).toBeNull()
    expect(importInstagram('riya sharma')).toBeNull()
  })
})

describe('exportPhone', () => {
  it('writes every form of an Indian number the same way, as text a spreadsheet keeps', () => {
    for (const typed of ['9876543210', '09876543210', '919876543210', '+919876543210', '98765 43210', '+91 98765-43210']) {
      expect(exportPhone(typed)).toBe('98765 43210')
    }
  })

  it('reads back in as the same number', () => {
    expect(importPhone(exportPhone('+919876543210'))).toBe('+919876543210')
  })

  it('leaves a foreign or unreadable number as typed, and a missing one empty', () => {
    expect(exportPhone('+1 202 555 0123')).toBe('+1 202 555 0123')
    expect(exportPhone('12345')).toBe('12345')
    expect(exportPhone(null)).toBe('')
  })
})

describe('importPhone', () => {
  it('takes ten digits with or without a country code, and assumes India without one', () => {
    expect(importPhone('9876543210')).toBe('+919876543210')
    expect(importPhone('98765 43210')).toBe('+919876543210')
    expect(importPhone('098765-43210')).toBe('+919876543210')
    expect(importPhone('919876543210')).toBe('+919876543210')
    expect(importPhone('+91 98765 43210')).toBe('+919876543210')
    expect(importPhone('+1 (202) 555-0123')).toBe('+12025550123')
  })

  it('refuses anything that isn’t a ten-digit number', () => {
    expect(importPhone('')).toBeNull()
    expect(importPhone('98765 4321')).toBeNull()
    expect(importPhone('+91 98765 4321')).toBeNull()
    expect(importPhone('987654321012')).toBeNull()
    expect(importPhone('9.87654E+09')).toBeNull()
    expect(importPhone('call me')).toBeNull()
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
