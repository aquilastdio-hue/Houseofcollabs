import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

/**
 * Turns an emailed auth link into a session.
 *
 * Supabase's email templates send people through `/auth/v1/verify`, which
 * redirects back with the tokens in the URL **fragment** — `#access_token=…`.
 * Our client is configured `flowType: 'pkce'`, and in that mode
 * `detectSessionInUrl` only looks for a `?code=` query parameter. It never
 * touches the fragment, so the link silently does nothing:
 *
 *   - with no session, the page decides the link is dead and says "expired"
 *   - with a session already in the browser — an admin who just approved the
 *     application, say — the page shows *that* account instead, and setting a
 *     password would change the wrong person's password
 *
 * Both were live. So the link is consumed explicitly here rather than left to
 * `detectSessionInUrl`, and the caller is told which account the link belongs
 * to instead of reading whatever session happened to be lying around.
 *
 * Every shape Supabase can send is handled, because which one arrives depends
 * on the email template and on project settings we don't control from here.
 */

type Link =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'otp'; tokenHash: string; type: EmailOtpType }
  | { kind: 'code' }
  | { kind: 'error'; message: string }

const OTP_TYPES: EmailOtpType[] = ['invite', 'recovery', 'signup', 'magiclink', 'email', 'email_change']

/**
 * Reads the link out of the current URL. Call this during the first render:
 * supabase-js strips `?code=` once it exchanges it, so waiting until an effect
 * runs can miss it.
 */
export function readAuthLink(href: string = window.location.href): Link | null {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const query = url.searchParams

  // GoTrue reports a dead link as an error fragment rather than an HTTP error.
  const error = hash.get('error_description') ?? hash.get('error') ?? query.get('error_description') ?? query.get('error')
  if (error) return { kind: 'error', message: error.replace(/\+/g, ' ') }

  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken }

  const tokenHash = query.get('token_hash') ?? hash.get('token_hash')
  const rawType = query.get('type') ?? hash.get('type')
  const type = OTP_TYPES.find((t) => t === rawType)
  if (tokenHash && type) return { kind: 'otp', tokenHash, type }

  if (query.get('code')) return { kind: 'code' }
  return null
}

/** Drops the token from the address bar and from browser history. */
function scrubUrl() {
  try {
    window.history.replaceState({}, '', window.location.pathname + window.location.search.replace(/[?&](code|token_hash|type)=[^&]*/g, '').replace(/^&/, '?'))
  } catch {
    // Not worth failing the sign-in over.
  }
}

export type LinkResult = { ok: true; email: string | null } | { ok: false; reason: string }

/**
 * Establishes the session the link stands for.
 *
 * Returns the account the link belongs to, so the page can show that rather
 * than trusting whatever session already existed.
 */
export async function establishSessionFromLink(link: Link): Promise<LinkResult> {
  if (link.kind === 'error') return { ok: false, reason: link.message }

  if (link.kind === 'tokens') {
    const { data, error } = await supabase.auth.setSession({
      access_token: link.accessToken,
      refresh_token: link.refreshToken,
    })
    if (error || !data.session) return { ok: false, reason: error?.message ?? 'That link is no longer valid.' }
    scrubUrl()
    return { ok: true, email: data.session.user.email ?? null }
  }

  if (link.kind === 'otp') {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
    if (error || !data.session) return { ok: false, reason: error?.message ?? 'That link is no longer valid.' }
    scrubUrl()
    return { ok: true, email: data.session.user.email ?? null }
  }

  // PKCE: supabase-js does exchange this one itself, but asynchronously — so
  // wait for it to land rather than racing it.
  const deadline = Date.now() + 8000
  for (;;) {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      scrubUrl()
      return { ok: true, email: data.session.user.email ?? null }
    }
    if (Date.now() > deadline) return { ok: false, reason: 'That link is no longer valid.' }
    await new Promise((r) => setTimeout(r, 200))
  }
}
