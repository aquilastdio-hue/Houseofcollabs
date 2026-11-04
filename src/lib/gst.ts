/**
 * Indian tax identifiers and GST states, for the billing forms and invoices.
 *
 * The database checks the same shapes (migration 0038) and decides every
 * amount; this file only helps people type valid details and prints what
 * the database already worked out.
 */

/** GST state codes (the first two digits of a GSTIN). */
export const GST_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
] as const

export function stateName(code: string | null | undefined) {
  return GST_STATES.find((s) => s.code === code)?.name ?? (code ? `State ${code}` : '')
}

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

/** Uppercase, no spaces: how people paste them vs how they're stored. */
export function cleanId(value: string | null | undefined) {
  return (value ?? '').toUpperCase().replace(/\s+/g, '')
}

export function isValidPan(value: string) {
  return PAN_RE.test(cleanId(value))
}

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** The 15th character of a GSTIN is a check digit over the first 14. */
export function gstinCheckDigit(first14: string) {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const value = GSTIN_CHARS.indexOf(first14[i]!)
    const product = value * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(product / 36) + (product % 36)
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36]!
}

export function isValidGstin(value: string) {
  const v = cleanId(value)
  return GSTIN_RE.test(v) && gstinCheckDigit(v.slice(0, 14)) === v[14]
}

/** Why a GSTIN isn't acceptable, or null. Checks state and PAN when given. */
export function gstinProblem(value: string, opts: { stateCode?: string; pan?: string } = {}) {
  const v = cleanId(value)
  if (!GSTIN_RE.test(v)) return 'A GSTIN is 15 characters, like 07ABCDE1234F1Z5.'
  if (gstinCheckDigit(v.slice(0, 14)) !== v[14]) return 'This GSTIN has a typo: its last character doesn’t match the rest.'
  if (opts.stateCode && v.slice(0, 2) !== opts.stateCode) return `This GSTIN is registered in ${stateName(v.slice(0, 2))}, not ${stateName(opts.stateCode)}.`
  if (opts.pan && isValidPan(opts.pan) && v.slice(2, 12) !== cleanId(opts.pan)) return 'This GSTIN doesn’t contain your PAN.'
  return null
}

/** April–March, in India time: 2026-11-04 → "2026-27". */
export function financialYear(date: Date = new Date()) {
  const ist = new Date(date.getTime() + 5.5 * 3600_000)
  const year = ist.getUTCFullYear() - (ist.getUTCMonth() < 3 ? 1 : 0)
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
  'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowHundred(n: number) {
  return n < 20 ? ONES[n]! : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`
}

function belowThousand(n: number) {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? `${ONES[h]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ')
}

/** Whole rupees in the Indian system: 135700 → "One Lakh Thirty Five Thousand Seven Hundred". */
function rupeesInWords(n: number): string {
  if (n === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(n / 1_00_00_000)
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000)
  const thousand = Math.floor((n % 1_00_000) / 1000)
  const rest = n % 1000
  if (crore) parts.push(`${rupeesInWords(crore)} Crore`)
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`)
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`)
  if (rest) parts.push(belowThousand(rest))
  return parts.join(' ')
}

/** "Rupees One Thousand Three Hundred Fifty Seven and Fifty Paise Only". */
export function amountInWords(amount: number) {
  const paiseTotal = Math.round(Math.abs(amount) * 100)
  const rupees = Math.floor(paiseTotal / 100)
  const paise = paiseTotal % 100
  return `Rupees ${rupeesInWords(rupees)}${paise ? ` and ${belowHundred(paise)} Paise` : ''} Only`
}
