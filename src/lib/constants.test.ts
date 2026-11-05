import { describe, expect, it } from 'vitest'
import { servicePrice } from './constants'

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
