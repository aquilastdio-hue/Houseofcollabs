import { z } from 'zod'
import { CONTENT_TYPES } from '@/lib/constants'
import { formatDays, formatINR, formatNumber } from '@/lib/format'
import type { AddonType, Gender, SocialPlatform } from '@/types'

/**
 * Form schemas for the creator studio. Every rule mirrors a database
 * constraint (see supabase/migrations/…_core_tables.sql); numeric inputs are
 * typed as text in the form and parsed to numbers on the way out.
 */

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
export const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/
const HTTPS_RE = /^https:\/\/\S+$/i

export const GENDER_VALUES = ['female', 'male', 'non_binary', 'prefer_not_to_say'] as const satisfies readonly Gender[]
export const PLATFORM_VALUES = ['instagram', 'youtube', 'x', 'threads', 'facebook', 'other'] as const satisfies readonly SocialPlatform[]
export const ADDON_TYPE_VALUES = [
  'extra_revision',
  'express_delivery',
  'raw_footage',
  'extra_content',
  'usage_rights',
  'custom',
] as const satisfies readonly AddonType[]

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
const text = (max: number) => z.string().trim().max(max, `Use ${formatNumber(max)} characters or fewer`)

/** Strips thousands separators / spaces users commonly type in numbers. */
const clean = (value: string) => value.replace(/[,\s_]/g, '')

function wholeNumber(min: number, max: number, messages: { required: string; range: string }) {
  return z
    .string()
    .transform(clean)
    .refine((v) => v !== '', messages.required)
    .refine((v) => v === '' || /^\d+$/.test(v), 'Enter a whole number')
    .transform(Number)
    .refine((v) => v >= min && v <= max, messages.range)
}

function optionalWholeNumber(min: number, max: number, range: string) {
  return z
    .string()
    .transform(clean)
    .refine((v) => v === '' || /^\d+$/.test(v), 'Enter a whole number')
    .transform((v) => (v === '' ? null : Number(v)))
    .refine((v) => v === null || (v >= min && v <= max), range)
}

function money(min: number, max: number, required: string) {
  return z
    .string()
    .transform(clean)
    .refine((v) => v !== '', required)
    .refine((v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v), 'Enter an amount in rupees, like 2500')
    .transform(Number)
    .refine((v) => v >= min && v <= max, `Enter an amount between ${formatINR(min)} and ${formatINR(max)}`)
}

const optionalPlatform = z
  .string()
  .transform((v) => (v === '' ? null : v))
  .pipe(z.enum(PLATFORM_VALUES).nullable())

const httpsUrl = (required: boolean) =>
  z
    .string()
    .trim()
    .max(2048, 'That link is too long')
    .refine((v) => (required ? v !== '' : true), 'Paste a link')
    .refine((v) => v === '' || HTTPS_RE.test(v), 'Use a full link starting with https://')

// ---------------------------------------------------------------------------
// Storefront profile
// ---------------------------------------------------------------------------
export const basicInfoSchema = z.object({
  profile_image_url: z.string().nullable(),
  cover_image_url: z.string().nullable(),
  display_name: z.string().trim().min(2, 'Use at least 2 characters').max(80, 'Use 80 characters or fewer'),
  headline: text(120),
  bio: text(1500),
  gender: z
    .string()
    .transform((v) => (v === '' ? null : v))
    .pipe(z.enum(GENDER_VALUES).nullable()),
  age: optionalWholeNumber(13, 100, 'Age must be between 13 and 100'),
  city: text(80),
  state: text(80),
  languages: z
    .array(z.string())
    .min(1, 'Choose at least one language')
    .max(10, 'Choose up to 10 languages')
    .refine((list) => list.every((l) => l.trim().length >= 2 && l.trim().length <= 40), 'Languages must be 2–40 characters'),
})
export type BasicInfoInput = z.input<typeof basicInfoSchema>
export type BasicInfoOutput = z.output<typeof basicInfoSchema>

export const creatorInfoSchema = z
  .object({
    categories: z.array(z.string()).min(1, 'Choose at least one category').max(5, 'Choose up to 5 categories'),
    primary_category: z.string(),
    creator_type: z.string().min(1, 'Choose the type that fits you best'),
    engagement_rate: z
      .string()
      .transform((v) => clean(v).replace(/%$/, ''))
      .refine((v) => v === '' || /^\d{1,3}(\.\d{1,2})?$/.test(v), 'Enter a percentage, like 4.5')
      .transform((v) => (v === '' ? null : Number(v)))
      .refine((v) => v === null || v <= 100, 'Must be between 0 and 100'),
    response_time: z.string(),
    available: z.boolean(),
  })
  .refine((v) => v.categories.includes(v.primary_category), { path: ['primary_category'], message: 'Pick your primary category' })
export type CreatorInfoInput = z.input<typeof creatorInfoSchema>
export type CreatorInfoOutput = z.output<typeof creatorInfoSchema>

export const socialAccountSchema = z.object({
  platform: z.string().min(1, 'Choose a platform').pipe(z.enum(PLATFORM_VALUES)),
  username: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@+/, ''))
    .pipe(z.string().min(1, 'Enter your username').max(100, 'Use 100 characters or fewer')),
  profile_url: httpsUrl(false).transform((v) => (v === '' ? null : v)),
  followers_count: wholeNumber(0, 2_000_000_000, {
    required: 'Enter your follower count',
    range: 'Enter a follower count between 0 and 2,000,000,000',
  }),
})
export type SocialAccountInput = z.input<typeof socialAccountSchema>
export type SocialAccountOutput = z.output<typeof socialAccountSchema>

export const slugSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Use at least 2 characters')
    .max(60, 'Use 60 characters or fewer')
    .regex(SLUG_RE, 'Use lowercase letters, numbers and single hyphens, like priya-creates'),
})
export type SlugInput = z.input<typeof slugSchema>

export const availabilitySchema = z.object({
  available: z.boolean(),
  response_time: z.string(),
})
export type AvailabilityInput = z.input<typeof availabilitySchema>

export const accountSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(120, 'Use 120 characters or fewer'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || PHONE_RE.test(v), 'Enter a valid phone number, like +91 98765 43210'),
  email_notifications: z.boolean(),
})
export type AccountInput = z.input<typeof accountSchema>

// ---------------------------------------------------------------------------
// Services & add-ons
// ---------------------------------------------------------------------------
export const INCLUDE_MAX_ITEMS = 12
export const INCLUDE_MAX_LENGTH = 80

export const serviceSchema = z.object({
  title: z.string().trim().min(3, 'Use at least 3 characters').max(100, 'Use 100 characters or fewer'),
  description: text(2000),
  price: money(100, 10_000_000, 'Set a price'),
  delivery_days: wholeNumber(1, 90, { required: 'Set a delivery time', range: 'Delivery must be between 1 and 90 days' }),
  revisions_included: wholeNumber(0, 10, { required: 'Set the number of revisions', range: 'Choose between 0 and 10 revisions' }),
  content_type: z.string().refine((v) => CONTENT_TYPES.some((o) => o.value === v), 'Choose a content type'),
  platform: optionalPlatform,
  requires_shipping: z.boolean(),
  includes: z
    .array(z.string().trim().min(1).max(INCLUDE_MAX_LENGTH))
    .max(INCLUDE_MAX_ITEMS, `Add up to ${INCLUDE_MAX_ITEMS} items`),
  active: z.boolean(),
})
export type ServiceFormInput = z.input<typeof serviceSchema>
export type ServiceFormOutput = z.output<typeof serviceSchema>

/** Add-on rules depend on the parent service (express delivery must be faster). */
export function makeAddonSchema(serviceDeliveryDays: number) {
  return z
    .object({
      addon_type: z.string().min(1, 'Choose a type').pipe(z.enum(ADDON_TYPE_VALUES)),
      name: z.string().trim().min(2, 'Use at least 2 characters').max(80, 'Use 80 characters or fewer'),
      description: text(500),
      price: money(0, 10_000_000, 'Set a price (use 0 for free)'),
      extra_revisions: wholeNumber(0, 10, { required: 'Enter a number of revisions', range: 'Choose between 0 and 10 revisions' }),
      delivery_days_override: optionalWholeNumber(1, 90, 'Delivery must be between 1 and 90 days'),
      active: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.addon_type === 'extra_revision' && typeof v.extra_revisions === 'number' && v.extra_revisions < 1) {
        ctx.addIssue({ code: 'custom', path: ['extra_revisions'], message: 'Add at least 1 revision' })
      }
      if (v.addon_type === 'express_delivery') {
        if (v.delivery_days_override === null) {
          ctx.addIssue({ code: 'custom', path: ['delivery_days_override'], message: 'Set the faster delivery time' })
        } else if (typeof v.delivery_days_override === 'number' && v.delivery_days_override >= serviceDeliveryDays) {
          ctx.addIssue({
            code: 'custom',
            path: ['delivery_days_override'],
            message: `Must be faster than the standard ${formatDays(serviceDeliveryDays)}`,
          })
        }
      }
    })
}
export type AddonFormInput = z.input<ReturnType<typeof makeAddonSchema>>
export type AddonFormOutput = z.output<ReturnType<typeof makeAddonSchema>>

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------
export const portfolioDetailsSchema = z.object({
  title: text(120),
  description: text(1000),
  brand_name: text(80),
  category_id: z.string(),
  platform: optionalPlatform,
})
export type PortfolioDetailsInput = z.input<typeof portfolioDetailsSchema>
export type PortfolioDetailsOutput = z.output<typeof portfolioDetailsSchema>

export const portfolioLinkSchema = z.object({
  url: httpsUrl(true),
  title: text(120),
  brand_name: text(80),
  platform: optionalPlatform,
})
export type PortfolioLinkInput = z.input<typeof portfolioLinkSchema>
export type PortfolioLinkOutput = z.output<typeof portfolioLinkSchema>

// ---------------------------------------------------------------------------
// Payout methods (full account number is write-only)
// ---------------------------------------------------------------------------
const holderName = z.string().trim().min(2, 'Enter the account holder’s name').max(120, 'Use 120 characters or fewer')

export const upiSchema = z.object({
  account_holder_name: holderName,
  upi_id: z.string().trim().regex(UPI_RE, 'Enter a valid UPI ID, like yourname@okbank'),
})
export type UpiInput = z.input<typeof upiSchema>

export const bankSchema = z
  .object({
    account_holder_name: holderName,
    bank_account_number: z
      .string()
      .transform((v) => v.replace(/\s/g, ''))
      .pipe(z.string().regex(/^\d{9,18}$/, 'Account numbers have 9–18 digits')),
    confirm_account_number: z.string().transform((v) => v.replace(/\s/g, '')),
    ifsc_code: z.string().trim().toUpperCase().regex(IFSC_RE, 'Enter a valid IFSC, like HDFC0001234'),
    bank_name: z.string().trim().min(2, 'Enter your bank’s name').max(120, 'Use 120 characters or fewer'),
  })
  .refine((v) => v.bank_account_number === v.confirm_account_number, {
    path: ['confirm_account_number'],
    message: 'Account numbers don’t match',
  })
export type BankInput = z.input<typeof bankSchema>

export const PAYOUT_NOTE_MAX = 500
