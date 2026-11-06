import { describe, expect, it } from 'vitest'
import { creatorsCsv, type CreatorSheetRow } from './creators-csv.ts'

const row: CreatorSheetRow = {
  id: 'c1',
  profile_id: 'p1',
  display_name: 'Tuba Khan',
  email: 'tuba@example.com',
  whatsapp: '+917217336938',
  slug: 'tuba-khan',
  city: 'Delhi',
  state: 'Delhi',
  status: 'published',
  account_status: 'active',
  verified: false,
  featured: true,
  followers_count: 7400,
  engagement_rate: '0.8312',
  avg_reel_views: 3444,
  service_prices: { ugc_video: 8000, reel: 15000.5 },
  rating: 4.5,
  review_count: 0,
  categories: ['Beauty', 'Fashion'],
  orders_count: 2,
  revenue: 12000,
  // 10 pm on the 4th in London is the 5th in India.
  joined_at: '2026-11-04T22:00:00Z',
  deleted_at: null,
  referral_code: 'RIYA10',
}

const lookups = {
  names: new Map([['p1', 'Tuba Khan Ansari']]),
  instagram: new Map([['c1', { username: 'tuba_khan', profile_url: 'https://www.instagram.com/tuba_khan/?igsh=abc' }]]),
  services: new Map([['c1', [{ title: 'UGC', price: 8000 }, { title: 'Reel', price: '150000.00' }]]]),
  siteUrl: 'https://www.houseofcollabs.com/',
}

const parse = (csv: string) => {
  const [header, line] = csv.split('\r\n')
  return { header: header!.split(','), line: line! }
}

describe('creatorsCsv', () => {
  it('has every column the admin list shows, in the upload template order first', () => {
    const { header } = parse(creatorsCsv([row], lookups))
    expect(header.slice(0, 8)).toEqual(['Name', 'Email', 'WhatsApp', 'Instagram', 'Followers', 'Categories', 'City', 'State'])
    for (const col of ['Engagement rate (%)', 'Avg views', 'UGC (₹)', 'Reel (₹)', 'Story (₹)', 'Feed post (₹)', 'YouTube video (₹)', 'IFCR (₹)', 'All services', 'Revenue (₹)', 'Profile link', 'Joined']) {
      expect(header).toContain(col)
    }
  })

  it('writes each value the way Excel and Google Sheets keep it', () => {
    const { line } = parse(creatorsCsv([row], lookups))
    expect(line).toContain('72173 36938') // WhatsApp as text, no + to guard
    expect(line).toContain('https://www.instagram.com/tuba_khan/') // link, tracking removed
    expect(line).toContain('Beauty; Fashion')
    expect(line).toContain(',0.83,3444,8000,15000.5,,,,1722,') // engagement, views, prices, IFCR
    expect(line).toContain('"UGC: ₹8,000; Reel: ₹1,50,000"') // Indian grouping, quoted for its commas
    expect(line).toContain('Tuba Khan Ansari,published,active,No,Yes,2,12000,,0,RIYA10')
    expect(line).toContain('https://www.houseofcollabs.com/creators/tuba-khan,2026-11-05')
  })

  it('marks a removed storefront and leaves missing lookups empty', () => {
    const { line } = parse(creatorsCsv([{ ...row, deleted_at: '2026-11-01T00:00:00Z', avg_reel_views: null }], { ...lookups, instagram: new Map(), services: new Map() }))
    expect(line).toContain(',removed,')
    expect(line).toContain('tuba@example.com,72173 36938,,7400,')
    expect(line).toMatch(/,8000,15000\.5,,,,,,Tuba Khan Ansari,/) // no IFCR, no services
  })
})
