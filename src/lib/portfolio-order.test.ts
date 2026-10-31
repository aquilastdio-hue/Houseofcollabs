import { describe, expect, it } from 'vitest'
import { portfolioOrder } from './portfolio-order'

const post = (id: string, sort_order: number, extra: { is_hidden?: boolean; media_url?: string } = {}) => ({
  id,
  sort_order,
  created_at: `2026-10-0${sort_order + 1}`,
  is_hidden: extra.is_hidden ?? false,
  media_url: extra.media_url ?? `https://x/${id}.jpg`,
})

describe('portfolioOrder', () => {
  it('puts the cover first and the profile-picture photo second', () => {
    const items = [post('c', 2), post('a', 0), post('b', 1), post('d', 3)]
    expect(portfolioOrder(items, 'https://x/c.jpg').map((i) => i.id)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('keeps the creator’s order when the profile picture is the cover or isn’t a post', () => {
    const items = [post('b', 1), post('a', 0), post('c', 2)]
    expect(portfolioOrder(items, 'https://x/a.jpg').map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(portfolioOrder(items, 'https://elsewhere/me.jpg').map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(portfolioOrder(items, null).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('skips hidden posts for the cover and the profile picture', () => {
    const items = [post('h', 0, { is_hidden: true }), post('a', 1), post('b', 2, { is_hidden: true, media_url: 'https://x/me.jpg' })]
    expect(portfolioOrder(items, 'https://x/me.jpg').map((i) => i.id)).toEqual(['a', 'h', 'b'])
  })
})
