import { beforeEach, describe, expect, it, vi } from 'vitest'
import { instagramTestMode, resolveInstagramConnectMode } from './instagram-connect'

describe('resolveInstagramConnectMode', () => {
  it('follows the setting', () => {
    expect(resolveInstagramConnectMode('hidden', null)).toBe('hidden')
    expect(resolveInstagramConnectMode('optional', null)).toBe('optional')
    expect(resolveInstagramConnectMode('required', null)).toBe('required')
  })

  it('stays hidden for anything it does not recognise, including a setting that has not loaded', () => {
    expect(resolveInstagramConnectMode(undefined, null)).toBe('hidden')
    expect(resolveInstagramConnectMode('on', null)).toBe('hidden')
    expect(resolveInstagramConnectMode(true, null)).toBe('hidden')
  })

  it('lets a tester see it (optional or required) while it is hidden for everyone else', () => {
    expect(resolveInstagramConnectMode('hidden', 'optional')).toBe('optional')
    expect(resolveInstagramConnectMode(undefined, 'optional')).toBe('optional')
    expect(resolveInstagramConnectMode('hidden', 'required')).toBe('required')
    expect(resolveInstagramConnectMode('optional', 'required')).toBe('required')
  })

  it('never relaxes the live setting for testers', () => {
    expect(resolveInstagramConnectMode('required', 'optional')).toBe('required')
  })
})

describe('instagramTestMode', () => {
  // A tab's own sessionStorage, the same on every Node version.
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })

  it('turns on with ?instagram_test=1, stays on for the tab (through the Instagram round trip), and off with =0', () => {
    expect(instagramTestMode('?role=creator')).toBeNull()
    expect(instagramTestMode('?role=creator&instagram_test=1')).toBe('optional')
    expect(instagramTestMode('?role=creator')).toBe('optional')
    expect(instagramTestMode('?instagram_test=required')).toBe('required')
    expect(instagramTestMode('?role=creator')).toBe('required')
    expect(instagramTestMode('?instagram_test=0')).toBeNull()
    expect(instagramTestMode('?role=creator')).toBeNull()
  })

  it('ignores values it does not know', () => {
    expect(instagramTestMode('?instagram_test=yes-please')).toBeNull()
  })

  it('still honours the link itself when storage is blocked', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(instagramTestMode('?instagram_test=1')).toBe('optional')
    expect(instagramTestMode('?role=creator')).toBeNull()
  })
})
