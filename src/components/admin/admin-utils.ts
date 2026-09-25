import type { Json } from '@/types'

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** `yyyy-MM-dd` (local day) → ISO timestamp at the start of that day. */
export function dayStartIso(day: string) {
  if (!DAY.test(day)) return undefined
  const d = new Date(`${day}T00:00:00`)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** `yyyy-MM-dd` (local day) → ISO timestamp at the very end of that day. */
export function dayEndIso(day: string) {
  if (!DAY.test(day)) return undefined
  const d = new Date(`${day}T23:59:59.999`)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** Validated `yyyy-MM-dd` URL value or ''. */
export function dayParam(value: string) {
  return DAY.test(value) ? value : ''
}

/** Parses a non-negative amount from a URL/input value; undefined when blank or invalid. */
export function parseAmount(value: string) {
  if (!value.trim()) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** 'yes' / 'no' URL flags → boolean filter (undefined = any). */
export function yesNo(value: string) {
  return value === 'yes' ? true : value === 'no' ? false : undefined
}

export function isOneOf<T extends string>(options: readonly T[], value: string | null | undefined): value is T {
  return !!value && (options as readonly string[]).includes(value)
}

/** Rupee amounts are stored with 2 decimals; round to paise to avoid float noise. */
export function toPaise(n: number) {
  return Math.round(n * 100) / 100
}

export function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Json | undefined>) : {}
}

export function asString(value: Json | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function asNumber(value: Json | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

export function asStringList(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : []
}

export function stopPropagation(e: { stopPropagation: () => void }) {
  e.stopPropagation()
}
