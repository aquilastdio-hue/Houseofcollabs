import type { ConfirmationResult } from 'firebase/auth'
import { loadFirebaseAuth } from './firebase'

/**
 * Firebase phone OTP, wrapped so the rest of the app never imports the SDK.
 *
 * Firebase signs the person in to *Firebase* as a side effect of verifying
 * their number. That session is of no interest here — Supabase remains the
 * identity system — so it is thrown away as soon as the ID token has been
 * taken. What we keep is the token, which is the only part a server can check.
 */

/** reCAPTCHA needs a real element to attach to, even when it is invisible. */
const RECAPTCHA_ID = 'hoc-recaptcha'

/**
 * India unless told otherwise.
 *
 * The form accepts '+91 98765 43210', '9876543210' and '09876543210'; Firebase
 * only accepts E.164. A number that already carries a '+' is passed through
 * with its own country code, so this doesn't trap anyone abroad.
 */
export function toE164(input: string): string | null {
  const trimmed = (input ?? '').trim()
  const digits = trimmed.replace(/[^0-9]/g, '')
  if (!digits) return null
  if (trimmed.startsWith('+')) return digits.length >= 8 ? `+${digits}` : null

  // Drop an Indian country code or trunk '0' that was typed without the plus.
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0') ? digits.slice(1)
    : digits
  return local.length === 10 ? `+91${local}` : null
}

/** For "we sent a code to …" without printing the whole number back. */
export function maskE164(e164: string): string {
  return e164.length > 4 ? `${e164.slice(0, -4).replace(/\d(?=\d{0,}$)/g, '•')}${e164.slice(-4)}` : e164
}

/**
 * The element the challenge anchors to.
 *
 * Emphatically *not* `display: none`. An invisible reCAPTCHA is only invisible
 * until it decides to challenge someone; at that point v2 opens an overlay
 * anchored here, and a hidden anchor leaves the verification unable to finish —
 * the send then either hangs or returns `auth/invalid-app-credential`. Test
 * phone numbers skip reCAPTCHA altogether, which is why they kept working while
 * real numbers did not.
 *
 * So the element stays in the layout but takes up no space and catches no
 * clicks. Google's badge appears bottom-right, which is the attribution their
 * terms expect anyway.
 */
function container(): HTMLElement {
  let el = document.getElementById(RECAPTCHA_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = RECAPTCHA_ID
    el.style.position = 'fixed'
    el.style.bottom = '0'
    el.style.right = '0'
    el.style.width = '0'
    el.style.height = '0'
    el.style.overflow = 'visible'
    el.style.zIndex = '2147483647'
    document.body.appendChild(el)
  }
  return el
}

// One verifier per page. Firebase throws if the same container is wired twice,
// and a stale one survives a failed attempt, so it is cleared rather than
// reused after anything goes wrong.
let verifier: import('firebase/auth').RecaptchaVerifier | null = null

export function resetRecaptcha() {
  try {
    verifier?.clear()
  } catch {
    // already torn down — nothing to recover
  }
  verifier = null
  document.getElementById(RECAPTCHA_ID)?.remove()
}

/** Sends a code. Returns the handle needed to confirm it. */
export async function sendOtp(e164: string): Promise<ConfirmationResult> {
  const auth = await loadFirebaseAuth()
  const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth')
  // Firebase decides the SMS language from this.
  auth.languageCode = 'en'

  // A fresh challenge for every send, without exception.
  //
  // `signInWithPhoneNumber` consumes the reCAPTCHA token. Keeping the verifier
  // around and reusing it posts a spent token, which Firebase rejects as
  // `auth/invalid-app-credential` — so the first code would arrive and every
  // resend after it would fail. Tearing it down first also removes the
  // container element, which is what stops Firebase complaining that a
  // reCAPTCHA has already been rendered here.
  resetRecaptcha()
  verifier = new RecaptchaVerifier(auth, container(), { size: 'invisible' })
  await verifier.render()
  try {
    return await signInWithPhoneNumber(auth, e164, verifier)
  } finally {
    // Spent either way: a success used the token, a failure may have burned it.
    resetRecaptcha()
  }
}

/**
 * Confirms the code and returns the Firebase ID token — the thing the server
 * can actually verify. The Firebase session is signed out immediately
 * afterwards: it has done its job, and leaving it around would mean two
 * logged-in identities on one page.
 */
export async function confirmOtp(confirmation: ConfirmationResult, code: string): Promise<string> {
  const credential = await confirmation.confirm(code.trim())
  const token = await credential.user.getIdToken()
  try {
    const auth = await loadFirebaseAuth()
    await auth.signOut()
  } catch {
    // Signing out is tidiness, not correctness; the token is already in hand.
  }
  resetRecaptcha()
  return token
}

/** Dev machine, where real numbers cannot pass reCAPTCHA. */
const isLocalhost = () =>
  typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)

/** Firebase error codes turned into something worth showing a person. */
export function otpErrorMessage(e: unknown): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That doesn’t look like a valid mobile number.'
    case 'auth/invalid-verification-code':
      return 'That code isn’t right. Check it and try again.'
    case 'auth/code-expired':
      return 'That code has expired. Send a new one.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.'
    case 'auth/quota-exceeded':
      return 'We can’t send codes right now. Please try again later.'
    case 'auth/operation-not-allowed':
      return 'Phone verification isn’t switched on yet. Please contact support.'
    case 'auth/unauthorized-domain':
      return 'This site isn’t authorised for verification yet. Please contact support.'
    case 'auth/invalid-app-credential':
      // On localhost this is not a transient failure and never will be: the
      // reCAPTCHA token is bound to the origin it was minted on, and Google's
      // shared Firebase site key does not accept localhost for this project —
      // a separate allow-list from Firebase's own Authorized domains, which is
      // what makes it so confusing. Real numbers work from the real domain;
      // locally you need a test number from
      // Console > Authentication > Sign-in method > Phone.
      return isLocalhost()
        ? 'Real numbers can’t be verified on localhost — use a Firebase test number, or try it on the live site.'
        : 'That verification attempt expired. Tap Get OTP to try again.'
    case 'auth/missing-phone-number':
      return 'Enter your mobile number first.'
    default:
      return e instanceof Error && e.message ? e.message : 'We couldn’t send the code. Please try again.'
  }
}
