import { describe, expect, it } from 'vitest'
import { basicInfoSchema, serviceSchema } from './schemas'

/**
 * Contact details in creator-written text.
 *
 * The storefront no longer prints a creator's handle, which is worth nothing
 * if the bio underneath reads "DM me @aromasurimakeovers". These cases are the
 * rule's real boundary: the blocked list is how a handle actually gets typed,
 * and the allowed list is ordinary copy that must keep saving — a creator who
 * cannot publish their own bio will not report it as a bug, they will just
 * stop using the studio.
 */

const bioIssue = (bio: string) => {
  const parsed = basicInfoSchema.safeParse({ display_name: 'Aroma Suri', bio })
  return (parsed.error?.issues ?? []).find((i) => i.path.join('.') === 'bio')?.message ?? null
}

const blocked = [
  ['a plain handle', 'DM me @aromasurimakeovers for collabs'],
  ['a handle at the very start', '@aromasuri — fashion and beauty'],
  ['a labelled handle', 'Insta: aromasuri'],
  ['an abbreviated label', 'ig - aroma_suri'],
  ['a WhatsApp label', 'WhatsApp: 9876543210'],
  ['a bare domain', 'instagram.com/aromasurimakeovers'],
  ['a full link', 'Portfolio at https://instagram.com/aromasuri'],
  ['a www link', 'See www.aromasuri.com'],
  ['an email address', 'Reach me at aroma.suri@gmail.com'],
  ['a phone number', 'Call 9876543210 to book'],
  ['a spaced phone number', 'Ring me on +91 98765 43210'],
] as const

const allowed = [
  ['the platform by name', 'Fashion and beauty creator in Delhi. I make Instagram Reels and YouTube integrations.'],
  ['deliverables', 'UGC video with 30-day usage. Two revisions included, delivered in 2 days.'],
  ['a range of prices', 'Packages run from 60000 to 100000 depending on scope.'],
  ['a year range', 'Working with beauty brands since 2019-2024.'],
  ['equipment', 'Everything shot on an iPhone 15 Pro with natural light.'],
  ['an apostrophe and an ampersand', "Aroma's makeovers — bridal & party looks, shot on location."],
  ['a non-Latin script', 'दिल्ली में रहने वाली ब्यूटी क्रिएटर। रील्स और UGC वीडियो बनाती हूँ।'],
  ['an invitation with no address', 'Send me a brief and I will reply the same day.'],
  ['a plain empty bio', ''],
] as const

describe('a creator cannot publish a way to be contacted off the platform', () => {
  it.each(blocked)('blocks %s', (_label, bio) => {
    expect(bioIssue(bio), bio).not.toBeNull()
  })
})

describe('ordinary creator copy still saves', () => {
  it.each(allowed)('allows %s', (_label, bio) => {
    expect(bioIssue(bio), bio).toBeNull()
  })
})

describe('the rule reaches the fields that skip the shared text() helper', () => {
  const service = (over: Record<string, unknown>) =>
    serviceSchema.safeParse({
      title: 'UGC video package',
      description: 'One vertical video for your brand.',
      price: '6000',
      delivery_days: '2',
      revisions_included: '1',
      content_type: 'reel',
      platform: '',
      requires_shipping: false,
      includes: ['Concept agreed in the brief'],
      active: true,
      ...over,
    })

  it('accepts an ordinary service', () => {
    expect(service({}).success).toBe(true)
  })

  it('blocks a handle in the service title', () => {
    expect(service({ title: 'Shot by @aromasuri' }).success).toBe(false)
  })

  it('blocks a handle in an included item', () => {
    expect(service({ includes: ['Concept call — ping me @aromasuri'] }).success).toBe(false)
  })
})
