import { z } from 'zod'

/**
 * The three-page brand sign-up.
 *
 * Same shape as the creator one: `STEP_FIELDS[n]` lists the paths belonging to
 * page n so the wizard can validate a page at a time, and conditional rules
 * live in `superRefine` targeting those same paths — a rule that fires on a
 * field the current page doesn't render would block the form with no visible
 * error.
 */

// ---------------------------------------------------------------- options ---
/** Page 1 — the brand's own industry. One choice. */
export const INDUSTRIES = [
  'Fashion',
  'Beauty',
  'Food & Beverage',
  'Lifestyle',
  'Travel & Hospitality',
  'Health & Wellness',
  'Technology',
  'Other',
] as const

/** Page 2 — the kind of creator they want. Matches the creator form's list. */
export const CREATOR_CATEGORIES = ['Fashion', 'Beauty', 'Lifestyle', 'Food', 'Travel', 'Fitness', 'Other'] as const

export const COLLABORATION_TYPES = [
  'UGC',
  'Instagram Reel',
  'Static / Carousel',
  'Stories',
  'YouTube',
  'Barter',
  'Long-term collaboration',
] as const

export const CREATOR_LOCATIONS = [
  { value: 'pan_india', label: 'Pan India' },
  { value: 'specific', label: 'Specific cities' },
] as const
export const MAX_SPECIFIC_CITIES = 8

/**
 * A campaign budget is one bracket, not several, so this is a single choice
 * even though the document draws it with checkboxes — it also has to land in
 * `applications.budget_range`, which holds one value.
 */
export const BUDGET_RANGES = [
  { value: 'under_25k', label: 'Under ₹25K' },
  { value: '25k_50k', label: '₹25K – ₹50K' },
  { value: '50k_100k', label: '₹50K – ₹1L' },
  { value: '100k_500k', label: '₹1L – ₹5L' },
  { value: 'over_500k', label: '₹5L+' },
] as const

/** Page 3 — what a registration document can be. */
export const REGISTRATION_DOCS = [
  'GST certificate',
  'Certificate of incorporation',
  'Udyam registration',
  'Other valid business document',
] as const

export const BRAND_CONFIRMATION = 'I confirm that I am authorized to represent this brand/company.'

export const BRAND_SUBMITTED_COPY = {
  title: 'Your account is ready',
  body: 'Sign in and your brand dashboard is waiting — browse every creator on House of Collabs, save the ones you like and send your first brief.',
  /** Said plainly, because signing in with a different address gets them nothing. */
  emailNote: 'Use the same email you applied with:',
} as const

// ----------------------------------------------------------------- schema ---
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/
const HTTPS_RE = /^https?:\/\/\S+$/i

const link = z
  .string()
  .trim()
  .refine((v) => v === '' || HTTPS_RE.test(v), 'Use a full link starting with https://')

export const brandApplicationSchema = z
  .object({
    // ---- page 1 · brand details -------------------------------------------
    brand_name: z.string().trim().min(2, 'Enter your brand name').max(120, 'Use 120 characters or fewer'),
    website_or_handle: z.string().trim().max(200, 'Use 200 characters or fewer'),
    logo_path: z.string(),
    industry: z.string(),
    location: z.string().trim().max(80, 'Use 80 characters or fewer'),
    contact_person: z.string().trim().max(120, 'Use 120 characters or fewer'),
    designation: z.string().trim().max(80, 'Use 80 characters or fewer'),
    // Asked on page 1 and shown again on page 3 — one value, not two, so the
    // verification step confirms it rather than making them type it twice.
    business_email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254, 'That email is too long'),
    whatsapp: z
      .string()
      .trim()
      .refine((v) => v === '' || PHONE_RE.test(v), 'Enter a valid number, like +91 98765 43210'),

    // ---- page 2 · what they need ------------------------------------------
    creator_categories: z.array(z.string()).max(CREATOR_CATEGORIES.length, 'Choose from the list'),
    collaboration_types: z.array(z.string()).max(COLLABORATION_TYPES.length, 'Choose from the list'),
    creator_location: z.string(),
    specific_cities: z.array(z.string()).max(MAX_SPECIFIC_CITIES, `Up to ${MAX_SPECIFIC_CITIES} cities`),
    budget_range: z.string(),

    // ---- page 3 · verification --------------------------------------------
    company_website: link,
    registration_doc_type: z.string(),
    registration_doc_path: z.string(),
    representative_id_path: z.string(),
    linkedin_url: link,
    instagram_url: z.string().trim().max(200, 'Use 200 characters or fewer'),
    authorized: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const need = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })

    // page 1 — every field on it is marked required
    if (!v.website_or_handle) need(['website_or_handle'], 'Add your website or Instagram handle')
    if (!v.logo_path) need(['logo_path'], 'Upload your brand logo')
    if (!v.industry) need(['industry'], 'Choose one')
    if (!v.location) need(['location'], 'Where is the company based?')
    if (v.contact_person.length < 2) need(['contact_person'], 'Who should we speak to?')
    if (!v.designation) need(['designation'], 'Enter their designation')
    if (!v.whatsapp) need(['whatsapp'], 'Enter your WhatsApp number')

    // page 2 — the page exists to tell us what they need, so it has to say
    // something. The document doesn't mark these, but a blank page 2 leaves
    // nothing to match a brand to.
    if (v.creator_categories.length < 1) need(['creator_categories'], 'Choose at least one')
    if (v.collaboration_types.length < 1) need(['collaboration_types'], 'Choose at least one')
    if (!v.creator_location) need(['creator_location'], 'Choose one')
    if (v.creator_location === 'specific' && v.specific_cities.length < 1) {
      need(['specific_cities'], 'Which cities?')
    }
    if (!v.budget_range) need(['budget_range'], 'Choose a budget')

    // page 3 — verification
    if (!v.company_website) need(['company_website'], 'Add your company website')
    if (!v.representative_id_path) need(['representative_id_path'], 'Upload your ID or authorization document')
    if (!v.instagram_url) need(['instagram_url'], 'Add your Instagram profile')
    // The registration document is optional, but if one is attached we need to
    // know which kind it is — and vice versa.
    if (v.registration_doc_path && !v.registration_doc_type) need(['registration_doc_type'], 'Which document is this?')
    if (v.registration_doc_type && !v.registration_doc_path) need(['registration_doc_path'], 'Upload the document')
    if (!v.authorized) need(['authorized'], 'Please confirm before submitting')
  })

export type BrandApplicationValues = z.infer<typeof brandApplicationSchema>

/** Which paths belong to which page, so one page validates at a time. */
export const STEP_FIELDS = [
  ['brand_name', 'website_or_handle', 'logo_path', 'industry', 'location', 'contact_person', 'designation', 'business_email', 'whatsapp'],
  ['creator_categories', 'collaboration_types', 'creator_location', 'specific_cities', 'budget_range'],
  // `business_email` again: page 3 shows it for confirmation and it can be
  // edited there, so it has to be checked there too.
  ['company_website', 'registration_doc_type', 'registration_doc_path', 'representative_id_path', 'linkedin_url', 'instagram_url', 'authorized', 'business_email'],
] as const

export const BRAND_STEP_META = [
  { title: 'Create your brand profile', blurb: 'The basics, so creators know who they’d be working with.' },
  { title: 'What kind of creators are you looking for?', blurb: 'This is what we match you on, so be as specific as you can.' },
  {
    title: 'Verify your brand',
    blurb: 'To keep House of Collabs trusted for creators and brands, please submit the following.',
  },
] as const

export const BRAND_TOTAL_STEPS = BRAND_STEP_META.length

export const BRAND_APPLICATION_DEFAULTS: BrandApplicationValues = {
  brand_name: '',
  website_or_handle: '',
  logo_path: '',
  industry: '',
  location: '',
  contact_person: '',
  designation: '',
  business_email: '',
  whatsapp: '',
  creator_categories: [],
  collaboration_types: [],
  creator_location: '',
  specific_cities: [],
  budget_range: '',
  company_website: '',
  registration_doc_type: '',
  registration_doc_path: '',
  representative_id_path: '',
  linkedin_url: '',
  instagram_url: '',
  authorized: false,
}

/**
 * A one-line summary of page 2 for `applications.looking_for`, which the admin
 * list shows and provisioning copies into the brand's description. Without it
 * that column would be empty for every brand now the form is structured.
 */
export function summariseNeed(v: BrandApplicationValues): string {
  const where = v.creator_location === 'specific' ? v.specific_cities.join(', ') : 'Pan India'
  const budget = BUDGET_RANGES.find((b) => b.value === v.budget_range)?.label
  return [v.collaboration_types.join(', '), v.creator_categories.join(', '), where, budget].filter(Boolean).join(' · ')
}
