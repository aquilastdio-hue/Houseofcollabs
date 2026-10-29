import { describe, expect, it } from 'vitest'
import { istParts, istTimeLabel, istToIso } from './india-time'

describe('india time', () => {
  it('turns an India date and time into the right instant', () => {
    expect(istToIso('2026-10-29', '10:00')).toBe('2026-10-29T04:30:00.000Z')
    expect(istToIso('2026-10-30', '02:15')).toBe('2026-10-29T20:45:00.000Z')
  })

  it('reads an instant back as its India date and time', () => {
    expect(istParts('2026-10-29T04:30:00.000Z')).toEqual({ date: '2026-10-29', time: '10:00' })
    // 20:45 UTC is already the next day in India.
    expect(istParts('2026-10-29T20:45:00Z')).toEqual({ date: '2026-10-30', time: '02:15' })
    expect(istParts(istToIso('2026-12-31', '23:55'))).toEqual({ date: '2026-12-31', time: '23:55' })
  })

  it('labels a time of day', () => {
    expect(istTimeLabel('10:00:00').replace(/\s/g, ' ')).toBe('10:00 am')
    expect(istTimeLabel('18:30').replace(/\s/g, ' ')).toBe('6:30 pm')
    expect(istTimeLabel(null)).toBe('—')
  })
})
