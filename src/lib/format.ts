import { format, formatDistanceToNowStrict } from 'date-fns'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inrPrecise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('en-IN')

/** ₹2,000 — whole rupees unless the amount has paise. */
export function formatINR(amount: number | string | null | undefined, opts: { precise?: boolean } = {}) {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n)) return '₹0'
  if (opts.precise || !Number.isInteger(n)) return inrPrecise.format(n)
  return inr.format(n)
}

/** 12.4K, 1.2M */
export function formatCompact(n: number | null | undefined) {
  return compact.format(Number(n ?? 0))
}

export function formatNumber(n: number | null | undefined) {
  return plain.format(Number(n ?? 0))
}

export function formatPercent(n: number | null | undefined, digits = 1) {
  return `${Number(n ?? 0).toFixed(digits).replace(/\.0+$/, '')}%`
}

export function toDate(value: string | Date | null | undefined) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value: string | Date | null | undefined, pattern = 'd MMM yyyy') {
  const d = toDate(value)
  return d ? format(d, pattern) : '—'
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, 'd MMM yyyy, h:mm a')
}

export function formatRelative(value: string | Date | null | undefined) {
  const d = toDate(value)
  if (!d) return '—'
  const diff = Date.now() - d.getTime()
  if (diff < 45_000 && diff > -45_000) return 'just now'
  return formatDistanceToNowStrict(d, { addSuffix: true })
}

export function formatDays(days: number | null | undefined) {
  const n = Number(days ?? 0)
  if (n <= 1) return '24 hours'
  return `${n} days`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}

export function formatBytes(bytes: number | null | undefined) {
  const n = Number(bytes ?? 0)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** "Delhi, India" style location line. */
export function formatLocation(city?: string | null, state?: string | null, country?: string | null) {
  return [city, state && state !== city ? state : null, !city && !state ? country : null].filter(Boolean).join(', ') || '—'
}

export function titleCase(value: string | null | undefined) {
  if (!value) return ''
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
