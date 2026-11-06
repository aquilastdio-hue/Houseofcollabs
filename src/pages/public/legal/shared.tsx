import * as React from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { site, supportEmailHref } from '@/config/site'
import type { PlatformTerms } from '@/components/marketing/platform-terms'

export const LEGAL_DOC_KEYS = [
  'privacy',
  'terms',
  'cookie-policy',
  'creator-guidelines',
  'brand-guidelines',
  'refund-policy',
  'payout-policy',
  'verification-terms',
] as const

export type LegalDocKey = (typeof LEGAL_DOC_KEYS)[number]

export function isLegalDocKey(value: unknown): value is LegalDocKey {
  return typeof value === 'string' && (LEGAL_DOC_KEYS as readonly string[]).includes(value)
}

export type LegalSection = { id: string; title: string; body: React.ReactNode }

export type LegalDoc = {
  title: string
  kind: 'Policy' | 'Terms' | 'Guidelines'
  /** One-sentence summary used for SEO and the page intro. */
  summary: string
  intro: React.ReactNode
  sections: LegalSection[]
  /** When this document last changed, if not the shared LAST_UPDATED: shown text and ISO date. */
  updated?: { label: string; iso: string }
}

export type LegalBuilder = (terms: PlatformTerms) => LegalDoc

/** Body text of a legal document: the full page and the Verification Terms popup. */
export const LEGAL_PROSE = cn(
  'text-[0.975rem] leading-7 text-ink-soft',
  '[&_p]:mt-4 [&_p:first-child]:mt-0',
  '[&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-ink [&_h3:first-child]:mt-0',
  '[&_h3+p]:mt-2 [&_h3+ul]:mt-2',
  '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul:first-child]:mt-0',
  '[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol:first-child]:mt-0',
  '[&_li]:pl-1 [&_li::marker]:text-faint',
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_code]:rounded-md [&_code]:bg-subtle [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:text-ink',
  '[&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:decoration-ink/25 [&_a]:underline-offset-4 [&_a:hover]:decoration-ink',
)

export const LAST_UPDATED = '2 October 2026'
export const COMPANY = `${site.name} Technologies`

export function SupportEmail() {
  return (
    <a href={supportEmailHref()} target="_blank" rel="noreferrer">
      {site.supportEmail}
    </a>
  )
}

/** Highlighted note inside a policy section. */
export function Callout({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 flex gap-3 rounded-card border border-line bg-subtle/70 p-4 text-[0.95rem]">
      <Info className="mt-1 size-4 shrink-0 text-ink" aria-hidden />
      <div className="min-w-0 [&>p:first-child]:mt-0">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children}
      </div>
    </div>
  )
}

/** Grievance Officer block (IT Rules, 2021 and DPDP Act, 2023). */
export function GrievanceContact() {
  return (
    <address className="mt-4 rounded-card border border-line bg-surface p-4 not-italic">
      <strong>Grievance Officer</strong>
      <br />
      {COMPANY}
      <br />
      {site.address}
      <br />
      Email: <SupportEmail /> (subject line “Grievance”)
    </address>
  )
}
