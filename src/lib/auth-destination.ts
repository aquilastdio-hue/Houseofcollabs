import type { UserRole } from '@/types'

/**
 * Where a completed sign-in should land.
 *
 * Two places need this answer — `GuestOnly` (email/password, where the session
 * simply appears) and `AuthCallback` (OAuth, which comes back on its own route)
 * — and they must not drift apart, because between them they decide whether the
 * Collabs / Creators buttons keep their promise.
 *
 * Those two buttons are for the public, not for signing a brand or a creator
 * in. Whoever clicks one is sent to log in with `?redirect` pointing back at
 * `/collabs` or `/creators`, and must come back to that coming-soon page — not
 * to an onboarding form and not to a dashboard, whatever role their account
 * happens to hold. Honouring a safe `redirect` above everything else is what
 * guarantees that.
 */

/** A same-site path. `//evil.com` is a protocol-relative URL, not a path. */
export function isSafePath(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//')
}

export function destinationAfterLogin({
  redirect,
  role,
  onboarded,
}: {
  redirect: string | null | undefined
  role: UserRole | null | undefined
  onboarded: boolean
}): string {
  // Asked for somewhere specific — go there. The route runs its own guard, so
  // this can't be used to reach something the account isn't entitled to.
  if (isSafePath(redirect)) return redirect

  return homeFor(role, onboarded)
}

/**
 * Where an account belongs when nothing more specific was asked for.
 *
 * Neither side is open to new accounts yet, so someone who signed up but never
 * finished setting up lands on their coming-soon screen rather than an
 * onboarding form — logging in should never reopen it. Anyone who already
 * finished onboarding keeps their dashboard, so nothing regresses.
 */
export function homeFor(role: UserRole | null | undefined, onboarded = true): string {
  if (!onboarded && role === 'brand') return '/collabs'
  if (!onboarded && role === 'creator') return '/creators'
  if (!role || !onboarded) return '/onboarding'
  if (role === 'admin') return '/admin'
  return role === 'brand' ? '/brand' : '/creator'
}
