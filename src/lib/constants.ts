import type { Enums } from '@/types/database.types'

export type Option<V extends string = string> = { value: V; label: string; description?: string }

export const CONTENT_TYPES: Option[] = [
  { value: 'ugc_video', label: 'UGC' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'post', label: 'Feed post' },
  { value: 'youtube_video', label: 'YouTube video' },
  { value: 'short', label: 'YouTube Short' },
  { value: 'photo', label: 'Photography' },
  { value: 'review', label: 'Product review' },
  { value: 'unboxing', label: 'Unboxing' },
  { value: 'tutorial', label: 'Tutorial / how-to' },
  { value: 'live', label: 'Live session' },
  { value: 'other', label: 'Other' },
]

export const PLATFORMS: Option<Enums<'social_platform'>>[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X' },
  { value: 'threads', label: 'Threads' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'other', label: 'Other' },
]

export const GENDERS: Option<Enums<'gender_type'>>[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export const RESPONSE_TIMES: Option[] = [
  { value: 'within_1_hour', label: 'Within an hour' },
  { value: 'within_few_hours', label: 'Within a few hours' },
  { value: 'within_1_day', label: 'Within a day' },
  { value: 'within_few_days', label: 'Within a few days' },
]

export const ADDON_TYPES: Option<Enums<'addon_type'>>[] = [
  { value: 'extra_revision', label: 'Extra revision', description: 'Adds revisions to the order' },
  { value: 'express_delivery', label: 'Faster delivery', description: 'Shortens the delivery time' },
  { value: 'raw_footage', label: 'Raw footage', description: 'Unedited source files' },
  { value: 'extra_content', label: 'Extra content', description: 'An additional video / photo' },
  { value: 'usage_rights', label: 'Usage rights', description: 'Paid ads / extended licence' },
  { value: 'custom', label: 'Custom', description: 'Anything else' },
]

export const LANGUAGES = [
  'English', 'Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Urdu', 'Kannada',
  'Odia', 'Malayalam', 'Punjabi', 'Assamese', 'Konkani', 'Hinglish',
] as const

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const

export const POPULAR_CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Kochi',
  'Chandigarh', 'Lucknow', 'Indore', 'Goa', 'Gurugram', 'Noida', 'Surat', 'Coimbatore',
] as const

export const SORT_OPTIONS: Option[] = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'followers', label: 'Most followers' },
  { value: 'delivery', label: 'Fastest delivery' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
]

export const FOLLOWER_RANGES = [
  { label: 'Any', min: undefined, max: undefined },
  { label: '1K – 10K', min: 1_000, max: 10_000 },
  { label: '10K – 50K', min: 10_000, max: 50_000 },
  { label: '50K – 100K', min: 50_000, max: 100_000 },
  { label: '100K – 500K', min: 100_000, max: 500_000 },
  { label: '500K+', min: 500_000, max: undefined },
] as const

export const DELIVERY_OPTIONS = [
  { label: 'Any time', value: undefined },
  { label: 'Within 24 hours', value: 1 },
  { label: 'Within 3 days', value: 3 },
  { label: 'Within 5 days', value: 5 },
  { label: 'Within 7 days', value: 7 },
  { label: 'Within 14 days', value: 14 },
] as const

export const PRICE_BOUNDS = { min: 0, max: 50_000, step: 500 } as const
export const AGE_BOUNDS = { min: 16, max: 60 } as const

export const INDUSTRIES = [
  'Beauty & personal care', 'Fashion & apparel', 'Food & beverage', 'Health & fitness', 'Consumer electronics',
  'Home & living', 'Travel & hospitality', 'Education', 'Finance & fintech', 'Gaming', 'Parenting & kids',
  'Jewellery & accessories', 'D2C / e-commerce', 'Agency', 'Other',
] as const

export const REPORT_REASONS = [
  'Spam or scam',
  'Inappropriate content',
  'Impersonation',
  'Harassment',
  'Off-platform payment request',
  'Intellectual property',
  'Other',
] as const

export const CATEGORY_TONES: Record<string, { bg: string; fg: string }> = {
  rose: { bg: 'bg-rose-soft', fg: 'text-rose' },
  peach: { bg: 'bg-peach-soft', fg: 'text-peach' },
  sand: { bg: 'bg-sand-soft', fg: 'text-sand' },
  mint: { bg: 'bg-mint-soft', fg: 'text-mint' },
  sky: { bg: 'bg-sky-soft', fg: 'text-sky' },
  lilac: { bg: 'bg-lilac-soft', fg: 'text-lilac' },
  brand: { bg: 'bg-brand-soft', fg: 'text-brand-ink' },
}

export function toneFor(color?: string | null) {
  return CATEGORY_TONES[color ?? ''] ?? CATEGORY_TONES.sand!
}

export function labelFor(options: readonly Option[], value?: string | null) {
  return options.find((o) => o.value === value)?.label ?? value ?? ''
}

/**
 * Creators per page on the discover/creators listing. Only the creator search
 * reads this — the admin tables each carry their own, so changing it here does
 * not quietly resize those.
 */
export const PAGE_SIZE = 20
