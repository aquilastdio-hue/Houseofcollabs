import { describe, expect, it } from 'vitest'
import {
  CREATOR_APPLICATION_DEFAULTS,
  MAX_PHOTOS,
  MAX_VIDEOS,
  STEP_FIELDS,
  creatorApplicationSchema,
} from './creator-application'

/** A creator who has answered every page the way the form asks. */
const complete = {
  ...CREATOR_APPLICATION_DEFAULTS,
  full_name: 'Aisha Sharma',
  creator_name: 'Aisha',
  whatsapp: '+91 98765 43210',
  email: 'aisha@example.com',
  city: 'Delhi',
  photo_path: 'photo.jpg',
  instagram: { handle: '@aisha', url: 'https://instagram.com/aisha', followers: '25000' },
  categories: ['Beauty', 'Fashion'],
  videos: ['v1.mp4'],
  photos: ['p1.jpg'],
  rates: { ...CREATOR_APPLICATION_DEFAULTS.rates, ugc_video: '8000' },
  confirmed: true,
}

const issues = (input: unknown) => {
  const r = creatorApplicationSchema.safeParse(input)
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

describe('creator sign-up schema', () => {
  it('accepts a creator who answered every page', () => {
    expect(issues(complete)).toEqual([])
  })

  it('asks for everything page 1 marks required', () => {
    for (const field of ['full_name', 'creator_name', 'whatsapp', 'email', 'city', 'photo_path'] as const) {
      expect(issues({ ...complete, [field]: '' })).toContain(field)
    }
  })

  it('requires Instagram but not YouTube', () => {
    expect(issues({ ...complete, instagram: { ...complete.instagram, handle: '' } })).toContain('instagram.handle')
    expect(issues({ ...complete, instagram: { ...complete.instagram, url: '' } })).toContain('instagram.url')
    expect(issues({ ...complete, instagram: { ...complete.instagram, followers: '' } })).toContain('instagram.followers')
    expect(issues({ ...complete, youtube: { url: '', subscribers: '' } })).toEqual([])
  })

  it('needs at least one category', () => {
    expect(issues({ ...complete, categories: [] })).toContain('categories')
  })

  it('needs at least one video and one photo, and caps both', () => {
    expect(issues({ ...complete, videos: [] })).toContain('videos')
    expect(issues({ ...complete, photos: [] })).toContain('photos')
    expect(issues({ ...complete, videos: Array(MAX_VIDEOS + 1).fill('v.mp4') })).toContain('videos')
    expect(issues({ ...complete, photos: Array(MAX_PHOTOS + 1).fill('p.jpg') })).toContain('photos')
    expect(issues({ ...complete, videos: Array(MAX_VIDEOS).fill('v.mp4'), photos: Array(MAX_PHOTOS).fill('p.jpg') })).toEqual([])
  })

  /** A blank rate is how a creator says they don't offer that one. */
  it('leaves every individual rate blank-able', () => {
    expect(issues({ ...complete, rates: { ...CREATOR_APPLICATION_DEFAULTS.rates, story: '3000' } })).toEqual([])
  })

  it('rejects a rate that is not a number', () => {
    expect(issues({ ...complete, rates: { ...complete.rates, collab_reel: 'fifteen thousand' } })).toContain('rates.collab_reel')
  })

  it('needs at least one rate, or barter', () => {
    const nothing = { ...complete, rates: CREATOR_APPLICATION_DEFAULTS.rates }
    expect(issues(nothing)).toContain('rates.ugc_video')

    // Barter alone is a real offer, so it satisfies the same rule.
    const barterOnly = { ...nothing, barter_available: true, barter_stance: 'selectively' }
    expect(issues(barterOnly)).toEqual([])
  })

  it('asks how barter works once barter is offered', () => {
    expect(issues({ ...complete, barter_available: true })).toContain('barter_stance')
    expect(issues({ ...complete, barter_available: true, barter_stance: 'yes' })).toEqual([])
  })

  it('will not create a profile without the confirmation', () => {
    expect(issues({ ...complete, confirmed: false })).toContain('confirmed')
  })

  it('leaves "open to" optional', () => {
    expect(issues({ ...complete, open_to: [] })).toEqual([])
  })

  it('strips separators from numbers', () => {
    const parsed = creatorApplicationSchema.safeParse({
      ...complete,
      instagram: { ...complete.instagram, followers: '25,000' },
      rates: { ...complete.rates, ugc_video: '₹ 8,000' },
    })
    expect(parsed.success && parsed.data.instagram.followers).toBe('25000')
    expect(parsed.success && parsed.data.rates.ugc_video).toBe('8000')
  })

  /**
   * Every error must land on a page the wizard can show. An error on a path no
   * page owns is invisible, and an invisible error is a button that does nothing —
   * which is exactly how the last version of this form broke.
   */
  it('puts every possible error on a page that renders it', () => {
    const owned = new Set(STEP_FIELDS.flat() as readonly string[])
    const empty = { ...CREATOR_APPLICATION_DEFAULTS, barter_available: true }
    const paths = issues(empty)
    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) {
      expect(owned.has(path.split('.')[0])).toBe(true)
    }
  })
})
