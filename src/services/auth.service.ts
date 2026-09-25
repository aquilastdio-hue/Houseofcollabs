import { supabase } from '@/lib/supabase/client'
import { toAppError, unwrap } from '@/lib/errors'
import type { UserRole } from '@/types'

const origin = () => window.location.origin

// Self-serve email sign-up was removed with the /signup screen: new brands and
// creators apply through /get-started and are set up by an admin. Restore
// `supabase.auth.signUp` here if self-serve accounts come back.

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw toAppError(error)
  void recordAuthEvent('login')
  return data
}

/** Google OAuth. The chosen role (signup) travels through the callback URL. */
export async function signInWithGoogle(opts: { role?: Exclude<UserRole, 'admin'>; redirect?: string } = {}) {
  const params = new URLSearchParams()
  if (opts.role) params.set('role', opts.role)
  if (opts.redirect) params.set('redirect', opts.redirect)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin()}/auth/callback${params.size ? `?${params}` : ''}`,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw toAppError(error)
}

export async function signOut() {
  await recordAuthEvent('logout')
  const { error } = await supabase.auth.signOut()
  if (error) throw toAppError(error)
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${origin()}/reset-password`,
  })
  if (error) throw toAppError(error)
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw toAppError(error)
  void recordAuthEvent('password_changed')
}

/**
 * Change the password of a signed-in user. The current password is re-checked
 * first (GoTrue lets an active session set a new password without it), so a
 * walk-up attacker on an unlocked device can't take the account over.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email
  if (!email) throw toAppError(new Error('You need to be signed in to change your password.'))

  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
  if (verifyError) throw toAppError(new Error('That current password is not right.'))

  await updatePassword(newPassword)
}

/** Sign out of every device by revoking all refresh tokens for this user. */
export async function signOutEverywhere() {
  await recordAuthEvent('logout')
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) throw toAppError(error)
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${origin()}/auth/callback` },
  })
  if (error) throw toAppError(error)
}

export async function setInitialRole(role: Exclude<UserRole, 'admin'>) {
  return unwrap(await supabase.rpc('set_initial_role', { p_role: role }))
}

export async function completeOnboarding() {
  return unwrap(await supabase.rpc('complete_onboarding'))
}

export async function recordAuthEvent(event: 'login' | 'logout' | 'password_changed' | 'password_reset') {
  try {
    await supabase.rpc('record_auth_event', { p_event: event })
  } catch {
    // audit logging must never block auth flows
  }
}
