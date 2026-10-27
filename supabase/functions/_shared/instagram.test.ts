import { describe, expect, it } from 'vitest'
import {
  INSTAGRAM_SCOPES,
  buildAuthorizeUrl,
  cleanCode,
  computeStats,
  decryptToken,
  encryptToken,
  isProfessionalAccount,
  parseInsights,
  randomState,
  type InstagramMedia,
} from './instagram'

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i * 7)))

describe('buildAuthorizeUrl', () => {
  it('asks Instagram for exactly the scopes we use, with our state and redirect', () => {
    const url = new URL(buildAuthorizeUrl({ appId: '123' }, { state: 'abc', redirectUri: 'https://www.houseofcollabs.com/instagram/callback' }))
    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('123')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('redirect_uri')).toBe('https://www.houseofcollabs.com/instagram/callback')
    expect(url.searchParams.get('state')).toBe('abc')
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic,instagram_business_manage_insights')
    expect(INSTAGRAM_SCOPES).toHaveLength(2)
  })
})

describe('small helpers', () => {
  it('makes long, URL-safe, distinct states', () => {
    const a = randomState()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomState()).not.toBe(a)
  })
  it('strips the #_ Instagram adds to the code', () => {
    expect(cleanCode('AQBx123#_')).toBe('AQBx123')
  })
  it('accepts only professional accounts', () => {
    expect(isProfessionalAccount('MEDIA_CREATOR')).toBe(true)
    expect(isProfessionalAccount('Business')).toBe(true)
    expect(isProfessionalAccount('PERSONAL')).toBe(false)
    expect(isProfessionalAccount(undefined)).toBe(false)
  })
})

describe('token encryption', () => {
  it('round-trips and never stores the token in the clear', async () => {
    const blob = await encryptToken('IGAAsecret-token', KEY)
    expect(blob).toMatch(/^v1:/)
    expect(blob).not.toContain('IGAAsecret-token')
    expect(await decryptToken(blob, KEY)).toBe('IGAAsecret-token')
  })
  it('uses a fresh IV each time', async () => {
    expect(await encryptToken('same', KEY)).not.toBe(await encryptToken('same', KEY))
  })
  it('refuses a wrong-length key', async () => {
    await expect(encryptToken('x', btoa('short'))).rejects.toThrow(/32 bytes/)
  })
})

describe('parseInsights', () => {
  it('reads values[0].value and total_value, and ignores unknown or non-numeric metrics', () => {
    expect(
      parseInsights({
        data: [
          { name: 'views', period: 'lifetime', values: [{ value: 5400 }] },
          { name: 'reach', total_value: { value: 4100 } },
          { name: 'likes', values: [{ value: 'n/a' }] },
          { name: 'impressions', values: [{ value: 99 }] },
        ],
      }),
    ).toEqual({ views: 5400, reach: 4100 })
  })
})

describe('computeStats', () => {
  const media: InstagramMedia[] = [
    { id: 'r1', media_type: 'VIDEO', media_product_type: 'REELS', like_count: 300, comments_count: 20, insights: { views: 9000, reach: 7000, total_interactions: 380 } },
    { id: 'r2', media_type: 'VIDEO', media_product_type: 'REELS', like_count: 100, comments_count: 10, insights: { views: 3000, reach: 2500 } },
    { id: 'p1', media_type: 'IMAGE', media_product_type: 'FEED', like_count: 200, comments_count: 5, insights: {} },
    { id: 'a1', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', like_count: 50, comments_count: 2 },
  ]

  it('averages only the metrics Instagram returned, and says over how many posts', () => {
    const s = computeStats({ followers_count: 10000 }, media, new Date('2026-10-27T00:00:00Z'))
    expect(s.media_analysed).toBe(4)
    expect(s.avg_views).toBe(6000)
    expect(s.views_sample).toBe(2)
    expect(s.avg_reels_views).toBe(6000)
    expect(s.avg_reach).toBe(4750)
    expect(s.avg_likes).toBe(162.5)
    expect(s.avg_comments).toBe(9.25)
    // interactions: 380 (total), 110, 205, 52 → 186.75 avg → 1.87% of 10k
    expect(s.engagement_sample).toBe(4)
    expect(s.engagement_rate).toBe(1.87)
    expect(s.top_media.map((m) => m.id)).toEqual(['r1', 'r2', 'p1'])
    expect(s.computed_at).toBe('2026-10-27T00:00:00.000Z')
  })

  it('reports nothing rather than zero when there is nothing to measure', () => {
    const s = computeStats({ followers_count: 0 }, [])
    expect(s).toMatchObject({ avg_views: null, avg_reach: null, avg_likes: null, engagement_rate: null, top_media: [] })
  })
})
