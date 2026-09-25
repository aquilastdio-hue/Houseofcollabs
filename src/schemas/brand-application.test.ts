import { describe, expect, it } from 'vitest'
import {
  BRAND_APPLICATION_DEFAULTS,
  MAX_SPECIFIC_CITIES,
  STEP_FIELDS,
  brandApplicationSchema,
  summariseNeed,
} from './brand-application'

/** A brand that has answered every page the way the form asks. */
const complete = {
  ...BRAND_APPLICATION_DEFAULTS,
  brand_name: 'Kumkum Naturals',
  website_or_handle: 'kumkum.example',
  logo_path: 'logo.png',
  industry: 'Beauty',
  location: 'Delhi',
  contact_person: 'Riya Malhotra',
  designation: 'Marketing Manager',
  business_email: 'riya@kumkum.example',
  whatsapp: '+91 98765 43210',
  creator_categories: ['Beauty', 'Lifestyle'],
  collaboration_types: ['UGC', 'Instagram Reel'],
  creator_location: 'pan_india',
  budget_range: '50k_100k',
  company_website: 'https://kumkum.example',
  representative_id_path: 'id.pdf',
  instagram_url: '@kumkum',
  authorized: true,
}

const issues = (input: unknown) => {
  const r = brandApplicationSchema.safeParse(input)
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

describe('brand sign-up schema', () => {
  it('accepts a brand that answered every page', () => {
    expect(issues(complete)).toEqual([])
  })

  it('asks for everything page 1 marks required', () => {
    const required = [
      'brand_name',
      'website_or_handle',
      'logo_path',
      'industry',
      'location',
      'contact_person',
      'designation',
      'whatsapp',
    ] as const
    for (const field of required) {
      expect(issues({ ...complete, [field]: '' })).toContain(field)
    }
    expect(issues({ ...complete, business_email: 'not-an-email' })).toContain('business_email')
  })

  describe('page 2 — what they need', () => {
    it('needs a category, a collaboration type and a budget', () => {
      expect(issues({ ...complete, creator_categories: [] })).toContain('creator_categories')
      expect(issues({ ...complete, collaboration_types: [] })).toContain('collaboration_types')
      expect(issues({ ...complete, budget_range: '' })).toContain('budget_range')
      expect(issues({ ...complete, creator_location: '' })).toContain('creator_location')
    })

    it('only asks which cities when it is not pan-India', () => {
      expect(issues({ ...complete, creator_location: 'pan_india', specific_cities: [] })).toEqual([])
      expect(issues({ ...complete, creator_location: 'specific', specific_cities: [] })).toContain('specific_cities')
      expect(issues({ ...complete, creator_location: 'specific', specific_cities: ['Mumbai'] })).toEqual([])
    })

    it('caps the city list', () => {
      const tooMany = { ...complete, creator_location: 'specific', specific_cities: Array(MAX_SPECIFIC_CITIES + 1).fill('Pune') }
      expect(issues(tooMany)).toContain('specific_cities')
    })
  })

  describe('page 3 — verification', () => {
    it('needs the website, the representative ID and Instagram', () => {
      expect(issues({ ...complete, company_website: '' })).toContain('company_website')
      expect(issues({ ...complete, representative_id_path: '' })).toContain('representative_id_path')
      expect(issues({ ...complete, instagram_url: '' })).toContain('instagram_url')
    })

    it('will not submit without the authorization confirmation', () => {
      expect(issues({ ...complete, authorized: false })).toContain('authorized')
    })

    /** The registration document is optional — but half of one is not. */
    it('takes the registration document whole or not at all', () => {
      expect(issues({ ...complete, registration_doc_type: '', registration_doc_path: '' })).toEqual([])
      expect(issues({ ...complete, registration_doc_path: 'gst.pdf', registration_doc_type: '' })).toContain('registration_doc_type')
      expect(issues({ ...complete, registration_doc_type: 'GST certificate', registration_doc_path: '' })).toContain('registration_doc_path')
      expect(issues({ ...complete, registration_doc_type: 'GST certificate', registration_doc_path: 'gst.pdf' })).toEqual([])
    })

    it('leaves LinkedIn optional but checks the link given', () => {
      expect(issues({ ...complete, linkedin_url: '' })).toEqual([])
      expect(issues({ ...complete, linkedin_url: 'https://linkedin.com/company/kumkum' })).toEqual([])
      expect(issues({ ...complete, linkedin_url: 'linkedin.com/company/kumkum' })).toContain('linkedin_url')
    })
  })

  /**
   * Page 3 shows the business email again for confirmation and lets it be
   * edited, so breaking it there has to surface there — not silently on page 1.
   */
  it('validates the business email on both pages that show it', () => {
    expect(STEP_FIELDS[0]).toContain('business_email')
    expect(STEP_FIELDS[2]).toContain('business_email')
  })

  /**
   * Every error must land on a page the wizard can show. An error on a path no
   * page owns is invisible, and an invisible error is a button that does nothing.
   */
  it('puts every possible error on a page that renders it', () => {
    const owned = new Set(STEP_FIELDS.flat() as readonly string[])
    const empty = { ...BRAND_APPLICATION_DEFAULTS, creator_location: 'specific', registration_doc_path: 'x.pdf' }
    const paths = issues(empty)
    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) {
      expect(owned.has(path.split('.')[0])).toBe(true)
    }
  })

  describe('summariseNeed', () => {
    it('reads as a sentence for the admin list', () => {
      expect(summariseNeed(complete)).toBe('UGC, Instagram Reel · Beauty, Lifestyle · Pan India · ₹50K – ₹1L')
    })

    it('names the cities when they were chosen', () => {
      const local = { ...complete, creator_location: 'specific', specific_cities: ['Mumbai', 'Pune'] }
      expect(summariseNeed(local)).toContain('Mumbai, Pune')
    })
  })
})
