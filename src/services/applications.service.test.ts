import { describe, expect, it } from 'vitest'
import { LISTED_STATUSES, statusesFor, type ApplicationStatus } from './applications.service'

/**
 * The queue holds what still needs a decision, and nothing else. Either
 * decision takes an application off it: approved people have accounts now, and
 * rejected ones moved to their own page.
 *
 * Rejected applications are kept, not deleted — "did we already look at this
 * person?" is a question the admin asks when someone applies again — so the
 * tests below also pin that they stay reachable.
 */
describe('statusesFor', () => {
  it('shows only what still needs a decision, by default', () => {
    expect(statusesFor('')).toEqual(['new', 'reviewing'])
  })

  it('drops an application from the queue once it is decided, either way', () => {
    const listed = statusesFor('') as readonly ApplicationStatus[]
    expect(listed).not.toContain('approved')
    expect(listed).not.toContain('rejected')
  })

  it('keeps work that is still open on the queue', () => {
    const listed = statusesFor('') as readonly ApplicationStatus[]
    expect(listed).toContain('new')
    expect(listed).toContain('reviewing')
  })

  it('still reaches rejected applications when asked — they have their own page', () => {
    expect(statusesFor('rejected')).toEqual(['rejected'])
  })

  it('still reaches approved applications when asked for them explicitly', () => {
    expect(statusesFor('approved')).toEqual(['approved'])
  })

  it('applies no filter at all for "all", so nothing is unreachable', () => {
    expect(statusesFor('all')).toBeNull()
  })

  it('narrows to a single status when one is picked', () => {
    for (const s of ['new', 'reviewing', 'approved', 'rejected'] as const) {
      expect(statusesFor(s)).toEqual([s])
    }
  })

  it('keeps LISTED_STATUSES and the default in step', () => {
    expect(statusesFor('')).toEqual([...LISTED_STATUSES])
  })
})
