import { brandGuidelines } from './brand-guidelines'
import { cookiePolicy } from './cookie-policy'
import { creatorGuidelines } from './creator-guidelines'
import { payoutPolicy } from './payout-policy'
import { privacyPolicy } from './privacy'
import { refundPolicy } from './refund-policy'
import type { LegalBuilder, LegalDocKey } from './shared'
import { termsOfService } from './terms'

export { LAST_UPDATED, isLegalDocKey, type LegalDoc, type LegalDocKey, type LegalSection } from './shared'

export const LEGAL_DOCS: Record<LegalDocKey, LegalBuilder> = {
  privacy: privacyPolicy,
  terms: termsOfService,
  'cookie-policy': cookiePolicy,
  'creator-guidelines': creatorGuidelines,
  'brand-guidelines': brandGuidelines,
  'refund-policy': refundPolicy,
  'payout-policy': payoutPolicy,
}

/** Navigation metadata for "related documents" links (route = `/${key}`). */
export const LEGAL_INDEX: { key: LegalDocKey; title: string; blurb: string }[] = [
  { key: 'terms', title: 'Terms of Service', blurb: 'The agreement for using the marketplace.' },
  { key: 'privacy', title: 'Privacy Policy', blurb: 'What we collect, why, and your rights.' },
  { key: 'cookie-policy', title: 'Cookie Policy', blurb: 'The essential storage we use — and what we don’t.' },
  { key: 'refund-policy', title: 'Refund Policy', blurb: 'Cancellations, disputes and refunds.' },
  { key: 'payout-policy', title: 'Payout Policy', blurb: 'Fees, earnings and payouts for creators.' },
  { key: 'creator-guidelines', title: 'Creator Guidelines', blurb: 'Honest storefronts and disclosed ads.' },
  { key: 'brand-guidelines', title: 'Brand Guidelines', blurb: 'Briefs, claims and prohibited products.' },
]
