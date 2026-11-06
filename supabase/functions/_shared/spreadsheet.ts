/**
 * Spreadsheet helpers shared by the website (`@shared/spreadsheet`) and the
 * Edge Functions, so a CSV downloaded from the dashboard and one served by a
 * live link are written the same way. CSV the way Google Sheets and Excel
 * write and read it (RFC 4180): commas, double-quoted cells, "" for a quote
 * inside one, line breaks allowed inside quotes. No imports: Deno and Vite
 * both load this file as is.
 */

/**
 * A cell starting with = + - or @ is a formula to a spreadsheet, which can run
 * whatever someone typed into their bio. A leading ' keeps it as plain text.
 */
export const FORMULA_START = /^[=+\-@\t\r]/

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = Array.isArray(value) ? value.join('; ') : String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}

/**
 * A creator's WhatsApp number: ten digits, with or without a country code.
 * Without one it's an Indian number, so "98765 43210", "09876543210" and
 * "919876543210" all become "+919876543210". One written with "+" keeps its
 * own code ("+1 202 555 0123").
 */
export function importPhone(value: string): string | null {
  const trimmed = value.trim()
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null
  const digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+')) {
    // +91 is followed by exactly ten; other codes are one to three digits long.
    const ok = digits.startsWith('91') ? digits.length === 12 : digits.length >= 11 && digits.length <= 13
    return ok ? `+${digits}` : null
  }
  const local =
    digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits
  return local.length === 10 ? `+91${local}` : null
}

/**
 * A WhatsApp number for a downloaded spreadsheet: an Indian one as "98765 43210".
 * The space keeps it text in Excel and Google Sheets, so Excel neither drops a
 * leading 0 nor shows twelve digits as 9.19877E+11, and with no "+" there's no
 * formula guard to show either. `importPhone` reads it back as +91. Anything
 * else goes out as it was typed.
 */
export function exportPhone(value: string | null | undefined): string {
  if (!value) return ''
  const e164 = importPhone(value)
  return e164?.startsWith('+91') ? `${e164.slice(3, 8)} ${e164.slice(8)}` : value
}

/**
 * The Instagram column of a downloaded spreadsheet: the creator's profile link,
 * tidied to https://www.instagram.com/handle/ (no ?igsh= or ?utm_source
 * tracking), or their handle when the saved link isn't an Instagram profile.
 * `importInstagram` reads either back as the handle.
 */
export function exportInstagram(profileUrl: string | null | undefined, username: string | null | undefined): string {
  const m = (profileUrl ?? '').trim().match(/^https?:\/\/(?:www\.|m\.)?instagram\.com\/([A-Za-z0-9._]{1,30})(?:[/?#]|$)/i)
  const notProfile = ['p', 'reel', 'reels', 'stories', 'explore', 'tv']
  if (m && !notProfile.includes(m[1]!.toLowerCase())) return `https://www.instagram.com/${m[1]}/`
  return (username ?? '').trim().replace(/^@/, '')
}
