import type { ApplicationRole } from '@/services/applications.service'
import { BrandApplicationWizard } from './brand-wizard'
import { CreatorApplicationWizard } from './creator-wizard'

/**
 * One entry point, two sign-ups: a brand builds its profile across three pages
 * and a creator across five. Both are submitted anonymously — anon holds an
 * insert grant on the applicant-facing columns only, and a trigger pins status
 * and the review fields, so neither can set its own outcome.
 */
export function ApplicationForm({ role }: { role: ApplicationRole }) {
  return role === 'brand' ? <BrandApplicationWizard /> : <CreatorApplicationWizard />
}
