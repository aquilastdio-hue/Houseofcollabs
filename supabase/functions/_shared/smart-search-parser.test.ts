import { describe, expect, it } from 'vitest'
import { parseAmount, parseSmartQuery } from './smart-search-parser'

describe('parseAmount', () => {
  it.each([
    ['5000', 5000],
    ['5,000', 5000],
    ['5k', 5000],
    ['1.5k', 1500],
    ['2 lakh'.replace(' ', ''), 200000],
    ['1.2m', 1200000],
  ])('%s → %d', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected)
  })
})

describe('parseSmartQuery', () => {
  it('parses the canonical example', () => {
    const { filters } = parseSmartQuery('female beauty creator in Delhi under 5000 within 5 days')
    expect(filters).toEqual({ category: 'beauty', gender: 'female', city: 'Delhi', maxPrice: 5000, maxDelivery: 5 })
  })

  it('parses the short example', () => {
    const { filters } = parseSmartQuery('beauty creators in Delhi under 5000')
    expect(filters).toEqual({ category: 'beauty', city: 'Delhi', maxPrice: 5000 })
  })

  it('handles currency symbols, k-suffix and city aliases', () => {
    const { filters } = parseSmartQuery('skincare UGC in Bangalore below ₹3k')
    expect(filters.category).toBe('skincare')
    expect(filters.contentType).toBe('ugc_video')
    expect(filters.city).toBe('Bengaluru')
    expect(filters.maxPrice).toBe(3000)
  })

  it('does not confuse New Delhi with the "newest" sort', () => {
    const { filters } = parseSmartQuery('fitness creators in new delhi')
    expect(filters.city).toBe('Delhi')
    expect(filters.sort).toBeUndefined()
  })

  it('separates followers, price and delivery numbers', () => {
    const { filters } = parseSmartQuery('micro influencer with over 50k followers between 2000 and 8000 in 3 days')
    expect(filters.creatorType).toBe('micro_creator')
    expect(filters.minFollowers).toBe(50000)
    expect(filters.minPrice).toBe(2000)
    expect(filters.maxPrice).toBe(8000)
    expect(filters.maxDelivery).toBe(3)
  })

  it('parses languages, platform, age and gender', () => {
    const { filters } = parseSmartQuery('tamil speaking male youtube tech reviewer aged 20-30')
    expect(filters.languages).toEqual(['Tamil'])
    expect(filters.gender).toBe('male')
    expect(filters.platform).toBe('youtube')
    expect(filters.category).toBe('technology')
    expect(filters.contentType).toBe('review')
    expect(filters.minAge).toBe(20)
    expect(filters.maxAge).toBe(30)
  })

  it('women is female, not male', () => {
    expect(parseSmartQuery('women fashion creators').filters.gender).toBe('female')
  })

  it('express delivery and verified flags', () => {
    const { filters } = parseSmartQuery('verified food creator 24 hour delivery')
    expect(filters).toMatchObject({ verified: true, category: 'food', maxDelivery: 1 })
  })

  it('keeps unknown words as a free-text query', () => {
    const { filters } = parseSmartQuery('ayurveda haircare creator in Kochi')
    expect(filters.city).toBe('Kochi')
    expect(filters.q).toBe('ayurveda haircare')
  })

  it('does not treat "live in" as livestream content', () => {
    const { filters } = parseSmartQuery('creators who live in Pune')
    expect(filters.contentType).toBeUndefined()
    expect(filters.city).toBe('Pune')
  })

  it('produces readable chips', () => {
    const { chips } = parseSmartQuery('female beauty creator in Delhi under 5000 within 5 days')
    expect(chips.map((c) => c.label)).toEqual(['Beauty', 'Female', 'Delhi', 'Under ₹5,000', '≤ 5 days'])
  })

  it('handles empty input', () => {
    expect(parseSmartQuery('').filters).toEqual({})
  })
})

describe('platform aliases', () => {
  const cases: [string, string | undefined][] = [
    ['beauty creators on instagram', 'instagram'],
    ['yt creators in delhi', 'youtube'],
    ['twitter creators under 5000', 'x'],
    ['creators on x in mumbai', 'x'],
    ['x creators for skincare', 'x'],
    ['find me x.com accounts', 'x'],
    ['threads creators in pune', 'threads'],
    ['fitness creators on threads', 'threads'],
    ['facebook creators', 'facebook'],
    // A bare "x" as a multiplier must not read as the platform.
    ['3 x reels under 5000', undefined],
    ['need 2 x posts in hindi', undefined],
    // Removed in migration 0026.
    ['tiktok creators in goa', undefined],
  ]
  it.each(cases)('%s -> %s', (query, platform) => {
    expect(parseSmartQuery(query).filters.platform).toBe(platform)
  })
})
