import { describe, expect, it } from 'vitest'
import { destinationAfterLogin, homeFor, isSafePath } from './auth-destination'

/**
 * The Collabs and Creators buttons on the landing page are for the public, not
 * a way for a brand or a creator to sign in to their workspace. Whoever clicks
 * one logs in and must come back to that coming-soon page — never an onboarding
 * form, never a dashboard, whatever their account happens to be.
 */
const ENTRY_POINTS = ['/collabs', '/creators'] as const

/** Every kind of account that could click one of those buttons. */
const ACCOUNTS = [
  { name: 'brand new, no role yet', role: null, onboarded: false },
  { name: 'has a role but never finished onboarding', role: 'creator' as const, onboarded: false },
  { name: 'approved creator', role: 'creator' as const, onboarded: true },
  { name: 'approved brand', role: 'brand' as const, onboarded: true },
  { name: 'an admin', role: 'admin' as const, onboarded: true },
]

describe('where a sign-in lands', () => {
  describe('the Collabs / Creators buttons', () => {
    for (const entry of ENTRY_POINTS) {
      for (const account of ACCOUNTS) {
        it(`sends ${account.name} back to ${entry}`, () => {
          expect(destinationAfterLogin({ redirect: entry, role: account.role, onboarded: account.onboarded })).toBe(entry)
        })
      }
    }

    it('never diverts to onboarding or a dashboard', () => {
      const forbidden = ['/onboarding', '/brand', '/creator', '/admin']
      for (const entry of ENTRY_POINTS) {
        for (const account of ACCOUNTS) {
          const landed = destinationAfterLogin({ redirect: entry, role: account.role, onboarded: account.onboarded })
          expect(forbidden).not.toContain(landed)
        }
      }
    })
  })

  describe('logging in directly, with nowhere specific asked for', () => {
    it('takes an approved creator to their dashboard', () => {
      expect(destinationAfterLogin({ redirect: null, role: 'creator', onboarded: true })).toBe('/creator')
    })
    it('takes an approved brand to their dashboard', () => {
      expect(destinationAfterLogin({ redirect: null, role: 'brand', onboarded: true })).toBe('/brand')
    })
    it('takes an admin to the admin area', () => {
      expect(destinationAfterLogin({ redirect: null, role: 'admin', onboarded: true })).toBe('/admin')
    })
    it('holds an unfinished account on its coming-soon page rather than reopening onboarding', () => {
      expect(destinationAfterLogin({ redirect: null, role: 'creator', onboarded: false })).toBe('/creators')
      expect(destinationAfterLogin({ redirect: null, role: 'brand', onboarded: false })).toBe('/collabs')
    })
    it('sends an account with no role at all to onboarding', () => {
      expect(destinationAfterLogin({ redirect: null, role: null, onboarded: false })).toBe('/onboarding')
    })
  })

  describe('an unsafe redirect is ignored', () => {
    const attacks = ['//evil.example', 'https://evil.example', 'javascript:alert(1)', '', null, undefined]
    for (const redirect of attacks) {
      it(`falls back to the account's own home for ${JSON.stringify(redirect)}`, () => {
        expect(destinationAfterLogin({ redirect, role: 'creator', onboarded: true })).toBe('/creator')
      })
    }
  })

  describe('isSafePath', () => {
    it('accepts same-site paths', () => {
      expect(isSafePath('/creators')).toBe(true)
      expect(isSafePath('/brand/orders?page=2')).toBe(true)
    })
    it('rejects anything that could leave the site', () => {
      expect(isSafePath('//evil.example')).toBe(false)
      expect(isSafePath('https://evil.example')).toBe(false)
      expect(isSafePath('')).toBe(false)
      expect(isSafePath(null)).toBe(false)
    })
  })

  describe('homeFor', () => {
    it('defaults to treating an account as onboarded', () => {
      expect(homeFor('creator')).toBe('/creator')
    })
  })
})
