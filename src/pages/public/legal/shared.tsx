import * as React from 'react'
import { Info } from 'lucide-react'
import { site } from '@/config/site'
import type { PlatformTerms } from '@/components/marketing/platform-terms'

export const LEGAL_DOC_KEYS = [
  'privacy',
  'terms',
  'cookie-policy',
  'creator-guidelines',
  'brand-guidelines',
  'refund-policy',
  'payout-policy',
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
}

export type LegalBuilder = (terms: PlatformTerms) => LegalDoc

export const LAST_UPDATED = '19 September 2026'
export const COMPANY = `${site.name} Technologies`

export function SupportEmail() {
  return <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>
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
