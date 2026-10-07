import { BRAND_STEP_META, BRAND_TOTAL_STEPS } from '@/schemas/brand-application'
import { STEP_META, TOTAL_STEPS } from '@/schemas/creator-application'

/**
 * Admin → Forms metadata only (titles/blurbs).
 *
 * The question fields themselves are NOT duplicated here — fullscreen preview
 * mounts the live wizard page components (`CreatorApplicationStep` /
 * `BrandApplicationStep`). Edit the onboarding wizards and these admin pages
 * stay in sync automatically.
 */
export type FormPageMeta = {
  index: number
  title: string
  blurb: string
}

export type OnboardingFormPreview = {
  role: 'creator' | 'brand'
  label: string
  description: string
  publicPath: string
  pages: FormPageMeta[]
}

export const CREATOR_FORM_PREVIEW: OnboardingFormPreview = {
  role: 'creator',
  label: 'Creator application',
  description: 'The five-page Create your profile flow applicants see at Get started → Creator.',
  publicPath: '/get-started?role=creator',
  pages: STEP_META.map((meta, i) => ({
    index: i + 1,
    title: meta.title,
    blurb: meta.blurb,
  })),
}

export const BRAND_FORM_PREVIEW: OnboardingFormPreview = {
  role: 'brand',
  label: 'Brand application',
  description: 'The three-page brand sign-up applicants see at Get started → Brand.',
  publicPath: '/get-started?role=brand',
  pages: BRAND_STEP_META.map((meta, i) => ({
    index: i + 1,
    title: meta.title,
    blurb: meta.blurb,
  })),
}

export const CREATOR_PAGE_COUNT = TOTAL_STEPS
export const BRAND_PAGE_COUNT = BRAND_TOTAL_STEPS
