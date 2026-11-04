import { describe, expect, it } from 'vitest'
import { amountInWords, cleanId, financialYear, gstinCheckDigit, gstinProblem, isValidGstin, isValidPan, stateName } from './gst'

describe('PAN and GSTIN', () => {
  it('accepts a well-formed PAN and tidies what people paste', () => {
    expect(isValidPan('abcde1234f')).toBe(true)
    expect(isValidPan('ABCDE 1234 F')).toBe(true)
    expect(isValidPan('ABCD1234F')).toBe(false)
    expect(cleanId(' 07abcde1234f1z5 ')).toBe('07ABCDE1234F1Z5')
  })

  it('checks the GSTIN check digit', () => {
    // 27AAPFU0939F1ZV is a commonly published valid sample GSTIN.
    expect(gstinCheckDigit('27AAPFU0939F1Z')).toBe('V')
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true)
    expect(isValidGstin('27AAPFU0939F1ZW')).toBe(false)
  })

  it('explains what is wrong with a GSTIN', () => {
    expect(gstinProblem('27AAPFU0939F1Z')).toMatch(/15 characters/)
    expect(gstinProblem('27AAPFU0939F1ZW')).toMatch(/typo/)
    expect(gstinProblem('27AAPFU0939F1ZV', { stateCode: '07' })).toMatch(/Maharashtra, not Delhi/)
    expect(gstinProblem('27AAPFU0939F1ZV', { pan: 'ABCDE1234F' })).toMatch(/PAN/)
    expect(gstinProblem('27AAPFU0939F1ZV', { stateCode: '27', pan: 'AAPFU0939F' })).toBeNull()
  })

  it('names states by code', () => {
    expect(stateName('07')).toBe('Delhi')
    expect(stateName('99')).toBe('State 99')
    expect(stateName(null)).toBe('')
  })
})

describe('financialYear', () => {
  it('runs April to March in India time', () => {
    expect(financialYear(new Date('2026-11-04T10:00:00Z'))).toBe('2026-27')
    expect(financialYear(new Date('2027-03-31T18:00:00Z'))).toBe('2026-27') // 31 Mar 23:30 IST
    expect(financialYear(new Date('2027-03-31T18:31:00Z'))).toBe('2027-28') // 1 Apr 00:01 IST
  })
})

describe('amountInWords', () => {
  it('writes rupees the Indian way', () => {
    expect(amountInWords(1357)).toBe('Rupees One Thousand Three Hundred Fifty Seven Only')
    expect(amountInWords(177.5)).toBe('Rupees One Hundred Seventy Seven and Fifty Paise Only')
    expect(amountInWords(135700)).toBe('Rupees One Lakh Thirty Five Thousand Seven Hundred Only')
    expect(amountInWords(25000000)).toBe('Rupees Two Crore Fifty Lakh Only')
    expect(amountInWords(0)).toBe('Rupees Zero Only')
  })
})
