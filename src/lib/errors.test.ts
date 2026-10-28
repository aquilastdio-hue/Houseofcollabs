import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AuthApiError } from '@supabase/supabase-js'
import { SUSPENDED_SIGN_IN_MESSAGE, toAppError } from './errors'

describe('toAppError: sign-in', () => {
  // Node has a `navigator` without `onLine`, which the helper reads as offline.
  beforeAll(() => vi.stubGlobal('navigator', { onLine: true }))

  it('explains a suspended (banned) account instead of "User is banned"', () => {
    const err = toAppError(new AuthApiError('User is banned', 400, 'user_banned'))
    expect(err.message).toBe(SUSPENDED_SIGN_IN_MESSAGE)
    expect(err.code).toBe('user_banned')
  })

  it('still words wrong passwords as before', () => {
    expect(toAppError(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')).message).toMatch(/don’t match/)
  })
})
