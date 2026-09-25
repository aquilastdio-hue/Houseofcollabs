import { z } from 'zod'
import { format } from 'date-fns'
import type { BriefInput } from '@/services/briefs.service'
import type { Brief } from '@/types'
import { isHttpsUrl, isHttpUrl } from '@/components/brand/validators'

/** Limits mirror the `briefs` table check constraints. */
export const BRIEF_LIMITS = {
  title: 140,
  campaign_objective: 2000,
  product_name: 140,
  product_description: 2000,
  deliverables: 2000,
  target_audience: 1000,
  tone: 300,
  usage_rights: 500,
  platform: 60,
  reference_links: 10,
  talking_points: 20,
  do_not_say: 20,
  list_item: 200,
  link: 2000,
} as const

export const USAGE_RIGHTS_PRESETS: { label: string; text: string }[] = [
  {
    label: 'Organic social only',
    text: 'Organic social only: the creator posts on their own profile and we may reshare it on our brand channels. No paid promotion.',
  },
  {
    label: 'Paid ads — 3 months',
    text: 'Paid ads — 3 months: we may run the content as paid ads (e.g. Meta, YouTube) for 3 months from delivery, plus organic resharing.',
  },
  {
    label: 'Perpetual, all channels',
    text: 'Perpetual, all channels: we may use the content on any channel — social, paid ads, website and marketplace listings — with no time limit.',
  },
]

const text = (max: number, label: string) => z.string().trim().max(max, `${label} must be ${max.toLocaleString('en-IN')} characters or fewer.`)

const listItem = z.string().trim().min(1).max(BRIEF_LIMITS.list_item, `Keep each item under ${BRIEF_LIMITS.list_item} characters.`)

/**
 * `keepDeadline` lets an existing (possibly past) deadline be saved unchanged;
 * any newly picked date must be today or later.
 */
export function makeBriefSchema(opts: { keepDeadline?: string | null } = {}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  return z.object({
    title: z
      .string()
      .trim()
      .min(3, 'Give your brief a title of at least 3 characters.')
      .max(BRIEF_LIMITS.title, `Keep the title under ${BRIEF_LIMITS.title} characters.`),
    campaign_objective: text(BRIEF_LIMITS.campaign_objective, 'The objective'),
    product_name: text(BRIEF_LIMITS.product_name, 'The product name'),
    product_description: text(BRIEF_LIMITS.product_description, 'The product description'),
    product_url: z
      .string()
      .trim()
      .refine((v) => v === '' || isHttpsUrl(v), 'Enter the full product link, starting with https://'),
    category_id: z.string(),
    content_type: z.string(),
    deliverables: text(BRIEF_LIMITS.deliverables, 'Deliverables'),
    target_audience: text(BRIEF_LIMITS.target_audience, 'The target audience'),
    tone: text(BRIEF_LIMITS.tone, 'Tone'),
    reference_links: z
      .array(
        z
          .string()
          .trim()
          .max(BRIEF_LIMITS.link, 'That link is too long.')
          .refine((v) => isHttpUrl(v), 'Links must start with http:// or https://'),
      )
      .max(BRIEF_LIMITS.reference_links, `Add up to ${BRIEF_LIMITS.reference_links} reference links.`),
    talking_points: z.array(listItem).max(BRIEF_LIMITS.talking_points, `Add up to ${BRIEF_LIMITS.talking_points} talking points.`),
    do_not_say: z.array(listItem).max(BRIEF_LIMITS.do_not_say, `Add up to ${BRIEF_LIMITS.do_not_say} items.`),
    deadline: z
      .string()
      .refine((v) => v === '' || v >= today || v === opts.keepDeadline, 'Pick today or a later date.'),
    budget: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) < 1e10), 'Enter an amount in rupees, e.g. 15000.'),
    usage_rights: text(BRIEF_LIMITS.usage_rights, 'Usage rights'),
    platform: z.string().trim().max(BRIEF_LIMITS.platform, `Keep the platform under ${BRIEF_LIMITS.platform} characters.`),
  })
}

export type BriefFormValues = z.infer<ReturnType<typeof makeBriefSchema>>

export const EMPTY_BRIEF_VALUES: BriefFormValues = {
  title: '',
  campaign_objective: '',
  product_name: '',
  product_description: '',
  product_url: '',
  category_id: '',
  content_type: '',
  deliverables: '',
  target_audience: '',
  tone: '',
  reference_links: [],
  talking_points: [],
  do_not_say: [],
  deadline: '',
  budget: '',
  usage_rights: '',
  platform: '',
}

export function briefToFormValues(b: Brief): BriefFormValues {
  return {
    title: b.title,
    campaign_objective: b.campaign_objective ?? '',
    product_name: b.product_name ?? '',
    product_description: b.product_description ?? '',
    product_url: b.product_url ?? '',
    category_id: b.category_id ?? '',
    content_type: b.content_type ?? '',
    deliverables: b.deliverables ?? '',
    target_audience: b.target_audience ?? '',
    tone: b.tone ?? '',
    reference_links: [...(b.reference_links ?? [])],
    talking_points: [...(b.talking_points ?? [])],
    do_not_say: [...(b.do_not_say ?? [])],
    deadline: b.deadline ?? '',
    budget: b.budget != null ? String(b.budget) : '',
    usage_rights: b.usage_rights ?? '',
    platform: b.platform ?? '',
  }
}

const orNull = (v: string) => (v.trim() ? v.trim() : null)

export function formValuesToInput(v: BriefFormValues): BriefInput {
  return {
    title: v.title.trim(),
    campaign_objective: orNull(v.campaign_objective),
    product_name: orNull(v.product_name),
    product_description: orNull(v.product_description),
    product_url: orNull(v.product_url),
    category_id: v.category_id || null,
    content_type: v.content_type || null,
    deliverables: orNull(v.deliverables),
    target_audience: orNull(v.target_audience),
    tone: orNull(v.tone),
    reference_links: v.reference_links.map((s) => s.trim()).filter(Boolean),
    talking_points: v.talking_points.map((s) => s.trim()).filter(Boolean),
    do_not_say: v.do_not_say.map((s) => s.trim()).filter(Boolean),
    deadline: v.deadline || null,
    budget: v.budget.trim() ? Number(v.budget) : null,
    usage_rights: orNull(v.usage_rights),
    platform: orNull(v.platform),
  }
}

/** First message from an RHF error on an array field (array- or item-level). */
export function listError(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as { message?: unknown; root?: { message?: unknown } }
  if (typeof e.message === 'string' && e.message) return e.message
  if (typeof e.root?.message === 'string' && e.root.message) return e.root.message
  for (const item of Object.values(err as Record<string, unknown>)) {
    const msg = (item as { message?: unknown } | undefined)?.message
    if (typeof msg === 'string' && msg) return msg
  }
  return undefined
}
