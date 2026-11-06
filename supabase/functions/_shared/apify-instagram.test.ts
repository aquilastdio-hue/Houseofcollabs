import { describe, expect, it } from 'vitest'
import { REELS_AVERAGED, clip, normalizeHandle, notFoundRow, reelOwner, summarizeProfile, summarizeReels, type ApifyProfile, type ApifyReel } from './apify-instagram'

describe('normalizeHandle', () => {
  it.each([
    ['@JohnDoe', 'johndoe'],
    ['johndoe', 'johndoe'],
    ['https://www.instagram.com/JohnDoe/?igsh=abc', 'johndoe'],
    ['  ', null],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeHandle(raw)).toBe(expected)
  })
})

const profile: ApifyProfile = {
  username: 'Creator',
  followersCount: 10000,
  followsCount: 300,
  postsCount: 120,
  verified: false,
  private: false,
  profilePicUrlHD: 'https://cdn.example/pic.jpg',
  latestPosts: [
    { shortCode: 'pin', isPinned: true, likesCount: 90000, commentsCount: 900, timestamp: '2025-01-01T00:00:00Z' },
    { shortCode: 'r1', type: 'Video', productType: 'clips', likesCount: 400, commentsCount: 20, videoPlayCount: 8000, timestamp: '2026-10-20T00:00:00Z', displayUrl: 'https://cdn.example/r1.jpg' },
    { shortCode: 'p1', type: 'Image', likesCount: 200, commentsCount: 10, timestamp: '2026-10-10T00:00:00Z' },
    { shortCode: 'h1', type: 'Image', likesCount: -1, commentsCount: 30, timestamp: '2026-10-05T00:00:00Z' },
  ],
}

describe('summarizeProfile', () => {
  it('averages unpinned posts and skips hidden like counts', () => {
    const row = summarizeProfile(profile)
    expect(row.username).toBe('creator')
    expect(row.status).toBe('ok')
    expect(row.posts_sampled).toBe(3)
    expect(row.avg_likes).toBe(300) // (400 + 200) / 2 — the hidden -1 is ignored
    expect(row.avg_comments).toBe(20) // (20 + 10 + 30) / 3
    expect(row.engagement_rate).toBe(3.2) // (300 + 20) / 10000 × 100
    expect(row.avg_reel_views).toBe(8000)
    expect(row.reels_sampled).toBe(1)
  })

  it('lists recent posts newest first, pinned included', () => {
    const row = summarizeProfile(profile)
    expect(row.recent_posts.map((p) => p.short_code)).toEqual(['r1', 'p1', 'h1', 'pin'])
    expect(row.recent_posts[0]).toMatchObject({ is_reel: true, views: 8000, image: 'https://cdn.example/r1.jpg' })
    expect(row.recent_posts[2].likes).toBeNull()
  })

  it('keeps headline numbers but no posts for a private account', () => {
    const row = summarizeProfile({ ...profile, private: true })
    expect(row.status).toBe('private')
    expect(row.followers_count).toBe(10000)
    expect(row.recent_posts).toEqual([])
    expect(row.engagement_rate).toBeNull()
  })

  it('marks Apify errors and missing profiles as not found', () => {
    expect(summarizeProfile({ error: 'not_found', errorDescription: 'Page not found' }, 'ghost')).toMatchObject({
      username: 'ghost',
      status: 'not_found',
      last_error: 'Page not found',
    })
    expect(notFoundRow('ghost').status).toBe('not_found')
  })
})

describe('clip', () => {
  it('never cuts an emoji in half, so the database accepts it', () => {
    const cut = clip('x'.repeat(139) + '😍 love this', 140)
    expect(cut).toBe('x'.repeat(139) + '😍')
    expect(JSON.stringify(cut)).not.toMatch(/\\ud83d"/)
    expect(clip('hi', 140)).toBe('hi')
  })

  it('drops broken emoji halves already in the text', () => {
    expect(clip('ok\ud83d then', 140)).toBe('ok then')
  })
})

describe('summarizeReels', () => {
  const reel = (n: number, extra: Partial<ApifyReel> = {}): ApifyReel => ({
    ownerUsername: 'mansi',
    shortCode: `r${n}`,
    // r1 is the newest
    timestamp: new Date(Date.UTC(2026, 10, 30 - n)).toISOString(),
    videoPlayCount: n * 1000,
    ...extra,
  })

  it(`averages the latest ${REELS_AVERAGED} Reels by date, whatever order they come in`, () => {
    const twelve = Array.from({ length: 12 }, (_, i) => reel(12 - i)) // oldest first
    // r1…r10: (1+…+10) × 1000 / 10
    expect(summarizeReels(twelve)).toEqual({ avg_reel_views: 5500, reels_sampled: 10 })
  })

  it('uses all of them when there are fewer than ten', () => {
    expect(summarizeReels([reel(1), reel(2), reel(3)])).toEqual({ avg_reel_views: 2000, reels_sampled: 3 })
  })

  it('leaves out pinned Reels, repeats, and hidden view counts', () => {
    const reels = [
      reel(1, { isPinned: true, videoPlayCount: 9_000_000 }),
      reel(2),
      reel(2),
      reel(3, { videoPlayCount: null, videoViewCount: -1 }),
      reel(4, { videoPlayCount: undefined, videoViewCount: 4400 }),
    ]
    // r2 (2000) and r4 (4400, from the view count)
    expect(summarizeReels(reels)).toEqual({ avg_reel_views: 3200, reels_sampled: 2 })
  })

  it('has no average without Reels', () => {
    expect(summarizeReels([])).toEqual({ avg_reel_views: null, reels_sampled: 0 })
  })

  it('knows whose Reel it is from the owner, or the profile it was asked for', () => {
    expect(reelOwner({ ownerUsername: 'Mansi.Rana' })).toBe('mansi.rana')
    expect(reelOwner({ inputUrl: 'https://www.instagram.com/_mansirana.07/' })).toBe('_mansirana.07')
  })
})

