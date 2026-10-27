import { z } from 'zod'

/**
 * The five-page creator sign-up.
 *
 * One schema, validated a page at a time: `STEP_FIELDS[n]` lists the paths
 * belonging to page n, so the wizard can check just that page before letting
 * someone move on. Conditional rules live in `superRefine` and target the same
 * paths, so they surface on the page that owns them — a rule that fires on a
 * field the current page doesn't render would block the form with no visible
 * error, which is exactly the bug the brand form had.
 */

// ---------------------------------------------------------------- options ---
/** Page 2 — the only categories this form offers. */
export const CREATOR_CATEGORIES = ['Fashion', 'Beauty', 'Lifestyle', 'Food', 'Travel', 'Fitness', 'Other'] as const
export const MAX_CATEGORIES = CREATOR_CATEGORIES.length

/** Page 3 — upload ceilings. */
export const MAX_VIDEOS = 5
export const MAX_PHOTOS = 10

/**
 * Page 4 — what a brand can book, in the order the document lists it.
 *
 * Each one is just a rate: entering a figure is how a creator says they offer
 * it, so there is no separate yes/no to keep in step with the price. Barter is
 * the exception — it has no rate, so it keeps an explicit answer.
 */
export const COLLABORATIONS = [
  { key: 'ugc_video', label: 'UGC' },
  { key: 'collab_reel', label: 'Collaborative reel' },
  { key: 'static_carousel', label: 'Static / carousel post' },
  { key: 'story', label: 'Instagram story' },
  { key: 'youtube_integration', label: 'YouTube integration' },
] as const

export type CollaborationKey = (typeof COLLABORATIONS)[number]['key']

/**
 * Page 4 -- how far a creator will go for a shoot.
 *
 * One answer, not several: the three widen outwards, so "out of country"
 * already says they would travel within it. Everyone can shoot in their own
 * city, which is why this can be asked of every applicant rather than needing
 * a "doesn't travel" escape hatch.
 */
export const TRAVEL_SCOPES = [
  { value: 'within_city', label: 'Within city' },
  { value: 'within_country', label: 'Within country' },
  { value: 'out_of_country', label: 'Out of country' },
] as const

export const BARTER_STANCES = [
  { value: 'yes', label: 'Yes' },
  { value: 'selectively', label: 'Selective' },
  { value: 'no', label: 'No' },
] as const

/** Page 5 — what a creator is open to. */
export const OPEN_TO = ['Paid collaborations', 'Long-term brand partnerships'] as const

export const CONFIRMATION =
  'I confirm that my information and uploaded content are authentic and can be displayed on my House of Collabs creator profile.'

/** Shown once the profile is in. */
export const SUBMITTED_COPY = {
  title: 'Welcome to House of Collabs',
  body: 'Your profile is now under review. Once approved, brands can discover your content, social profile, deliverables and commercials.',
} as const

// ----------------------------------------------------------------- schema ---
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/
const HTTPS_RE = /^https?:\/\/\S+$/i

/** Money and counts are text inputs; separators and ₹ are stripped. */
const amount = z
  .string()
  .transform((v) => v.replace(/[,\s₹]/g, ''))
  .refine((v) => v === '' || /^\d+$/.test(v), 'Enter a whole number')

const link = z
  .string()
  .trim()
  .refine((v) => v === '' || HTTPS_RE.test(v), 'Use a full link starting with https://')

/**
 * A person's name: letters, spaces, hyphens and apostrophes.
 *
 * This is the field the storefront is titled with, and people were filling it
 * with handles and, in one case, a full instagram.com URL with a tracking
 * parameter — which then appeared on the public creators page where a name
 * belongs. Rejecting digits and punctuation makes a handle or a link
 * impossible to submit here.
 *
 * Hyphens and apostrophes stay: plenty of real names need them, and blocking
 * those to catch handles would turn a nuisance into a barrier.
 *
 * `\p{L}` accepts letters from any script, and `\p{M}` is there because it has
 * to be: a Devanagari vowel sign is a combining mark, not a letter, so letters
 * alone rejected "आयशा शर्मा" — a real name on a marketplace whose creators are
 * mostly in India. Marks can't lead, which is why the first character is `\p{L}`.
 */
const PERSON_NAME_RE = /^[\p{L}][\p{L}\p{M}\s'-]*$/u
const NAME_MESSAGE = 'Use letters only — no numbers, symbols or links'

export const creatorApplicationSchema = z
  .object({
    // ---- page 1 · basic details -------------------------------------------
    full_name: z
      .string()
      .trim()
      .min(2, 'Enter your name')
      .max(120, 'Use 120 characters or fewer')
      .regex(PERSON_NAME_RE, NAME_MESSAGE),
    creator_name: z.string().trim().min(2, 'Enter the name brands know you by').max(80, 'Use 80 characters or fewer'),
    whatsapp: z
      .string()
      .trim()
      .refine((v) => v === '' || PHONE_RE.test(v), 'Enter a valid number, like +91 98765 43210'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254, 'That email is too long'),
    // Optional: most people arrive without one. Upper-cased on the way in so
    // 'abc123', 'ABC123' and ' abc123 ' are the same code when you come to
    // count them.
    referral_code: z.string().trim().toUpperCase().max(40, 'Use 40 characters or fewer'),
    // The E.164 number the applicant passed an SMS check on. Client state for
    // the form's own benefit only — the authority is `private.phone_verifications`,
    // which the insert guard consults and the browser cannot reach. Holding the
    // number rather than a boolean is what makes editing the field un-verify it.
    verified_phone: z.string(),
    city: z.string().trim().max(80, 'Use 80 characters or fewer'),
    photo_path: z.string(),

    // ---- page 2 · social profile ------------------------------------------
    instagram: z.object({
      handle: z.string().trim().max(100, 'Use 100 characters or fewer'),
      url: link,
      followers: amount,
    }),
    youtube: z.object({
      url: link,
      subscribers: amount,
    }),
    categories: z.array(z.string()).max(MAX_CATEGORIES, `Choose up to ${MAX_CATEGORIES}`),

    // ---- page 3 · your content --------------------------------------------
    videos: z.array(z.string()).max(MAX_VIDEOS, `Up to ${MAX_VIDEOS} videos`),
    photos: z.array(z.string()).max(MAX_PHOTOS, `Up to ${MAX_PHOTOS} photos`),

    // ---- page 4 · your commercials ----------------------------------------
    rates: z.object({
      ugc_video: amount,
      collab_reel: amount,
      static_carousel: amount,
      story: amount,
      youtube_integration: amount,
    }),
    barter_available: z.boolean(),
    barter_stance: z.string(),
    travel_scope: z.string(),

    // ---- page 5 · go live --------------------------------------------------
    open_to: z.array(z.string()),
    confirmed: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const need = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })

    // page 1 — every field on it is marked required
    if (!v.whatsapp) need(['whatsapp'], 'Enter your WhatsApp number')
    if (!v.city) need(['city'], 'Choose your city')
    if (!v.photo_path) need(['photo_path'], 'Add a profile photo')

    // page 2 — Instagram is required; YouTube is not
    if (!v.instagram.handle) need(['instagram', 'handle'], 'Enter your Instagram account')
    if (!v.instagram.url) need(['instagram', 'url'], 'Add a link to your profile')
    if (!v.instagram.followers) need(['instagram', 'followers'], 'Enter your follower count')
    if (v.categories.length < 1) need(['categories'], 'Choose at least one')

    // page 3 — "show us your work" means at least one of each
    if (v.videos.length < 1) need(['videos'], 'Upload at least one video')
    if (v.photos.length < 1) need(['photos'], 'Upload at least one photo')

    // page 4 — a creator with no rate and no barter is offering nothing
    if (!Object.values(v.rates).some(Boolean) && !v.barter_available) {
      need(['rates', 'ugc_video'], 'Add a rate for at least one collaboration, or offer barter')
    }
    if (v.barter_available && !v.barter_stance) need(['barter_stance'], 'Choose one')
    if (!v.travel_scope) need(['travel_scope'], 'Choose one')

    // page 5 — the confirmation is the whole point of the page
    if (!v.confirmed) need(['confirmed'], 'Please confirm before creating your profile')
  })

export type CreatorApplicationValues = z.infer<typeof creatorApplicationSchema>

/** Which paths belong to which page, so one page validates at a time. */
export const STEP_FIELDS = [
  ['full_name', 'creator_name', 'whatsapp', 'email', 'referral_code', 'city', 'photo_path'],
  ['instagram', 'youtube', 'categories'],
  ['videos', 'photos'],
  ['rates', 'barter_available', 'barter_stance', 'travel_scope'],
  ['open_to', 'confirmed'],
] as const

export const STEP_META = [
  { title: 'Create your profile', blurb: 'The basics brands need to know who you are and how to reach you.' },
  { title: 'Where can brands find you?', blurb: 'Your handles, your reach and the kind of content you make.' },
  { title: 'Show us your work', blurb: 'Upload your best content that you would like brands to see.' },
  {
    title: 'What can you offer brands?',
    blurb:
      'Set a starting commercial for what you offer, and leave the rest blank. Please keep your rates as competitive and reasonable as you can — it makes it far easier for brands to reach out.',
  },
  { title: 'Almost there!', blurb: 'One last look before your profile goes in for review.' },
] as const

export const TOTAL_STEPS = STEP_META.length

export const CREATOR_APPLICATION_DEFAULTS: CreatorApplicationValues = {
  full_name: '',
  creator_name: '',
  whatsapp: '',
  email: '',
  referral_code: '',
  verified_phone: '',
  city: '',
  photo_path: '',
  instagram: { handle: '', url: '', followers: '' },
  youtube: { url: '', subscribers: '' },
  categories: [],
  videos: [],
  photos: [],
  rates: {
    ugc_video: '',
    collab_reel: '',
    static_carousel: '',
    story: '',
    youtube_integration: '',
  },
  barter_available: false,
  barter_stance: '',
  travel_scope: '',
  open_to: [],
  confirmed: false,
}
