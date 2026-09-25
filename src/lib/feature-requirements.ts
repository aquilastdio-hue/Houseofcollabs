import type { CreatorRequirements } from '@/services/creators.service'

/**
 * Progressive information collection.
 *
 * Signup asks only what identifies a creator. Everything else is requested the
 * moment a creator reaches for the feature that needs it — and only the parts
 * they haven't already given us.
 *
 * This file is the one place that says which feature needs what. Gates read
 * from here, so a check is never re-implemented (or quietly drifted) somewhere
 * else in the app. The facts themselves come from a single RPC,
 * `public.get_creator_requirements()`.
 */

export type RequirementKey = 'profile' | 'services' | 'pricing' | 'portfolio' | 'social' | 'payout' | 'verification'

export type FeatureKey = 'go_live' | 'withdraw' | 'verify' | 'campaign' | 'charges'

export type Requirement = {
  key: RequirementKey
  /** Checklist line — what's still needed. */
  label: string
  /** Why it's needed, in the creator's terms. */
  description: string
  /** Button label on the checklist row. */
  cta: string
  /** Where it gets done. `null` means the gate collects it in place. */
  href: string | null
  done: (r: CreatorRequirements) => boolean
}

export const REQUIREMENTS: Record<RequirementKey, Requirement> = {
  profile: {
    key: 'profile',
    label: 'Finish your profile basics',
    description: 'Photo, bio, city, languages, category and creator type — the details brands judge you on.',
    cta: 'Complete profile',
    href: '/creator/profile',
    done: (r) => r.completion?.can_publish ?? false,
  },
  services: {
    key: 'services',
    label: 'Add at least one service',
    description: 'A fixed-price package brands can order — what you make, how long it takes, what it costs.',
    cta: 'Add a service',
    href: '/creator/services',
    done: (r) => (r.services?.active ?? 0) > 0,
  },
  pricing: {
    key: 'pricing',
    label: 'Set your charges',
    description: 'Put a price, delivery time and revision count on at least one service.',
    cta: 'Set charges',
    href: '/creator/services',
    done: (r) => (r.services?.active ?? 0) > 0,
  },
  portfolio: {
    key: 'portfolio',
    label: 'Add work samples',
    description: 'Brands shortlist on work they can see. Two or three pieces is enough to start.',
    cta: 'Add portfolio',
    href: '/creator/portfolio',
    done: (r) => (r.portfolio?.visible ?? 0) > 0,
  },
  social: {
    key: 'social',
    label: 'Connect a social account',
    description: 'Your handle and audience size, so brands can see your reach.',
    cta: 'Add account',
    href: '/creator/settings/social',
    done: (r) => (r.analytics?.accounts ?? 0) > 0,
  },
  payout: {
    key: 'payout',
    label: 'Set up your payout account',
    description: 'Where your earnings go — UPI or a bank account. We only ask when there is money to send.',
    cta: 'Set up payouts',
    href: null, // collected in the gate itself, so a withdrawal isn't interrupted
    done: (r) => r.payout?.configured ?? false,
  },
  verification: {
    key: 'verification',
    label: 'Verify your identity',
    description: 'A quick identity check. We keep only the last four digits of your document number.',
    cta: 'Get verified',
    href: null, // collected in the gate itself
    done: (r) => r.verified || r.verification?.status === 'approved',
  },
}

export type Feature = {
  key: FeatureKey
  /** Dialog heading when something is missing. */
  title: string
  /** One line explaining what unlocks. */
  blurb: string
  requires: RequirementKey[]
}

export const FEATURES: Record<FeatureKey, Feature> = {
  charges: {
    key: 'charges',
    title: 'Set your charges',
    blurb: 'Name a package, put a price on it and brands can order straight away.',
    requires: ['services'],
  },
  go_live: {
    key: 'go_live',
    title: 'You’re almost ready to go live',
    blurb: 'A public storefront needs a few things brands can actually act on.',
    requires: ['profile', 'services', 'portfolio'],
  },
  withdraw: {
    key: 'withdraw',
    title: 'Set up your payout account',
    blurb: 'Tell us where to send your earnings and we’ll continue your withdrawal.',
    requires: ['payout'],
  },
  verify: {
    key: 'verify',
    title: 'Get verified',
    blurb: 'A verified badge tells brands you are who you say you are.',
    requires: ['verification'],
  },
  campaign: {
    key: 'campaign',
    title: 'Before you take this campaign',
    blurb: 'Brands expect to see your work and your rates before you accept.',
    requires: ['portfolio', 'services', 'social'],
  },
}

/** Requirements for `feature`, split into what's done and what's still missing. */
export function checkFeature(feature: FeatureKey, requirements: CreatorRequirements | undefined) {
  const spec = FEATURES[feature]
  if (!requirements) return { spec, ready: false, missing: [] as Requirement[], done: [] as Requirement[], unknown: true }

  const all = spec.requires.map((k) => REQUIREMENTS[k])
  const missing = all.filter((r) => !r.done(requirements))
  return { spec, ready: missing.length === 0, missing, done: all.filter((r) => r.done(requirements)), unknown: false }
}
