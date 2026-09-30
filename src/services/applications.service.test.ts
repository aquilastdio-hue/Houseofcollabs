import { describe, expect, it } from 'vitest'
import { LISTED_STATUSES, statusesFor, type ApplicationStatus } from './applications.service'

/**
 * Approving is the only decision that takes an application off the list — the
 * applicant has an account now, so the row's job is done. A rejected one stays
 * visible with its status, because "did we already look at this person?" is a
 * question the admin asks, and hiding the answer behind a filter is worse than
 * a slightly longer list.
 */
describe('statusesFor', () => {
  it('lists everything except approved by default', () => {
    expect(statusesFor('')).toEqual(['new', 'reviewing', 'rejected'])
  })

  it('drops an application from the list once it is approved', () => {
    expect(statusesFor('') as readonly ApplicationStatus[]).not.toContain('approved')
  })

  it('keeps rejected and reviewing on the list', () => {
    const listed = statusesFor('') as readonly ApplicationStatus[]
    expect(listed).toContain('rejected')
    expect(listed).toContain('reviewing')
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
