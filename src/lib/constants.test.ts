import { describe, expect, it } from 'vitest'
import { finalPricing, servicePrice } from './constants'

describe('servicePrice', () => {
  // As admin_list_creators returns it: content type → the lower price of that kind.
  const prices = { ugc_video: 8000, reel: '15000.00', story: 0 }

  it('reads a price, from a number or numeric text', () => {
    expect(servicePrice(prices, 'ugc_video')).toBe(8000)
    expect(servicePrice(prices, 'reel')).toBe(15000)
  })

  it('keeps a price of zero', () => {
    expect(servicePrice(prices, 'story')).toBe(0)
  })

  it('is null when the creator has no service of that kind, or no prices at all', () => {
    expect(servicePrice(prices, 'youtube_video')).toBeNull()
    expect(servicePrice({}, 'post')).toBeNull()
    expect(servicePrice(null, 'post')).toBeNull()
  })
})

describe('finalPricing', () => {
  it('is half a rupee per average view, to the rupee', () => {
    expect(finalPricing(3444)).toBe(1722)
    expect(finalPricing('31496.4')).toBe(15748)
    expect(finalPricing(223)).toBe(112)
  })

  it('is null without a view count', () => {
    expect(finalPricing(null)).toBeNull()
    expect(finalPricing(undefined)).toBeNull()
    expect(finalPricing('')).toBeNull()
  })
})
