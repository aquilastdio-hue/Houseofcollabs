import { describe, expect, it } from 'vitest'
import { OPEN_STATUSES, statusesFor, type ApplicationStatus } from './applications.service'

/**
 * The applications list is a queue: deciding an application takes it off the
 * list. These pin down that it is *hidden*, not deleted — an approved row has
 * to survive for the applicant to claim their account on first sign-in.
 */
describe('statusesFor', () => {
  it('shows only what still needs a decision by default', () => {
    expect(statusesFor('')).toEqual(['new', 'reviewing'])
  })

  it('drops an application from the queue once it is approved or rejected', () => {
    const queue = statusesFor('') as readonly ApplicationStatus[]
    expect(queue).not.toContain('approved')
    expect(queue).not.toContain('rejected')
  })

  it('still reaches decided applications when asked for one explicitly', () => {
    expect(statusesFor('approved')).toEqual(['approved'])
    expect(statusesFor('rejected')).toEqual(['rejected'])
  })

  it('applies no filter at all for "all", so nothing is unreachable', () => {
    expect(statusesFor('all')).toBeNull()
  })

  it('narrows to a single status when one is picked', () => {
    for (const s of ['new', 'reviewing', 'approved', 'rejected'] as const) {
      expect(statusesFor(s)).toEqual([s])
    }
  })

  it('keeps OPEN_STATUSES and the default in step', () => {
    expect(statusesFor('')).toEqual([...OPEN_STATUSES])
  })
})
