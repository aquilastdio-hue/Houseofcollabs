/**
 * Client-side validators that mirror the database check constraints
 * (`^https?://[^\s]+$` URLs, brand contact email/phone patterns) so forms
 * fail inline instead of on save.
 */
const HTTP_URL = /^https?:\/\/[^\s]+$/i
const HTTPS_URL = /^https:\/\/[^\s]+$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Same patterns as the `brands.contact_email` / `contact_phone` constraints. */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/

function parseUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname.includes('.') ? url : null
  } catch {
    return null
  }
}

export function isHttpUrl(value: string) {
  return HTTP_URL.test(value) && !!parseUrl(value)
}

export function isHttpsUrl(value: string) {
  return HTTPS_URL.test(value) && !!parseUrl(value)
}

export function isInstagramUrl(value: string) {
  if (!isHttpsUrl(value)) return false
  const host = parseUrl(value)!.hostname.toLowerCase()
  return host === 'instagram.com' || host.endsWith('.instagram.com')
}

export function isUuid(value: string) {
  return UUID.test(value)
}

/** Only http(s) links are ever rendered as `href` (user-supplied content). */
export function safeHref(value?: string | null) {
  const v = value?.trim()
  return v && isHttpUrl(v) ? v : null
}

/** "instagram.com/reel/abc" — compact label for an external link. */
export function displayUrl(value: string) {
  const url = parseUrl(value)
  if (!url) return value
  const path = url.pathname.replace(/\/$/, '')
  return `${url.hostname.replace(/^www\./, '')}${path}${url.search}`
}
