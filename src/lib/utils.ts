import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes, resolving conflicts (last one wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initials(name?: string | null, max = 2) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, max)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

/** Stable hash → index, used for deterministic avatar/tint colours. */
export function hashIndex(value: string, modulo: number) {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h) % modulo
}

export function uuid() {
  return crypto.randomUUID()
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/** Removes undefined/null/'' keys — handy for URL params and patches. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    ;(out as Record<string, unknown>)[k] = v
  }
  return out
}

export function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

export function sanitizeFileName(name: string) {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').slice(0, 60)
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  return ext ? `${base || 'file'}.${ext}` : base || 'file'
}

export function fileExtension(name: string) {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function range(n: number) {
  return Array.from({ length: n }, (_, i) => i)
}
