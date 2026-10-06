import * as React from 'react'
import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { confirmOtp, otpErrorMessage, resetRecaptcha, sendOtp, toE164 } from '@/lib/phone-otp'
import { firebaseConfigured } from '@/lib/firebase'
import { verifyPhoneToken } from '@/services/applications.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ConfirmationResult } from 'firebase/auth'

/** How long before the applicant may ask for another code. */
const RESEND_SECONDS = 45
const CODE_LENGTH = 6

/**
 * Phone verification, split so the action can live *inside* the number field.
 *
 * The hook returns two pieces because they belong in two places: `trailing`
 * goes in the Input's `rightSlot`, and `panel` renders underneath once a code
 * has been sent. Keeping them separate is what lets the number field stay the
 * `Field`'s only child — `Field` clones that child to attach `aria-invalid` and
 * `aria-describedby`, so wrapping the input would move both off it and the
 * error would stop being announced.
 *
 * Nothing here decides anything. "Verified" is a server fact recorded by the
 * `verify-phone` Edge Function after it checks the Firebase token's signature;
 * this only obtains a token and hands it over.
 */
export function usePhoneVerification({
  phone,
  verified,
  onVerified,
}: {
  phone: string
  verified: boolean
  onVerified: (e164: string) => void
}) {
  const [sent, setSent] = React.useState<ConfirmationResult | null>(null)
  const [sentTo, setSentTo] = React.useState('')
  const [code, setCode] = React.useState('')
  const [busy, setBusy] = React.useState<'sending' | 'checking' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [wait, setWait] = React.useState(0)
  const codeRef = React.useRef<HTMLInputElement>(null)

  const e164 = toE164(phone)

  // A code was sent to one number; editing the field makes it meaningless.
  React.useEffect(() => {
    if (sent && e164 !== sentTo) {
      setSent(null)
      setCode('')
      setError(null)
      resetRecaptcha()
    }
  }, [e164, sent, sentTo])

  React.useEffect(() => {
    if (wait <= 0) return
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(id)
  }, [wait])

  React.useEffect(() => () => resetRecaptcha(), [])

  const send = React.useCallback(async () => {
    if (!e164) return setError('Enter your mobile number first.')
    setBusy('sending')
    setError(null)
    try {
      const confirmation = await sendOtp(e164)
      setSent(confirmation)
      setSentTo(e164)
      setWait(RESEND_SECONDS)
      window.setTimeout(() => codeRef.current?.focus(), 50)
    } catch (e) {
      setError(otpErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }, [e164])

  const check = React.useCallback(async () => {
    if (!sent || code.trim().length < CODE_LENGTH) return setError(`Enter the ${CODE_LENGTH}-digit code.`)
    setBusy('checking')
    setError(null)
    try {
      const token = await confirmOtp(sent, code)
      await verifyPhoneToken(token)
      onVerified(sentTo)
      setSent(null)
      setCode('')
    } catch (e) {
      setError(otpErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }, [sent, code, sentTo, onVerified])

  // Nothing is offered when Firebase isn't configured: a button that cannot
  // work is worse than no button.
  const off = !firebaseConfigured

  const trailing = off ? null : verified ? (
    <span className="inline-flex items-center gap-1 pr-2 text-xs font-medium text-success">
      <BadgeCheck className="size-4" aria-hidden /> Verified
    </span>
  ) : (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="mr-0.5 text-xs font-semibold text-brand hover:text-brand-strong"
      loading={busy === 'sending'}
      disabled={!e164 || busy !== null || wait > 0}
      onClick={() => void send()}
    >
      {busy === 'sending' ? 'Sending…' : sent ? (wait > 0 ? `Resend ${wait}s` : 'Resend OTP') : 'Get OTP'}
    </Button>
  )

  const panel =
    off || verified || (!sent && !error) ? null : (
      <div className="mt-2">
        {sent && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
              inputMode="numeric"
              autoComplete="one-time-code"
              inputSize="sm"
              aria-label={`${CODE_LENGTH}-digit code`}
              placeholder={'•'.repeat(CODE_LENGTH)}
              className="w-28 text-center tracking-[0.3em] tabular-nums"
            />
            <Button type="button" size="sm" loading={busy === 'checking'} disabled={code.length < CODE_LENGTH} onClick={() => void check()}>
              {busy === 'checking' ? 'Checking…' : 'Confirm'}
            </Button>
          </div>
        )}
        {error && (
          <p className={cn('text-xs font-medium text-danger', sent && 'mt-1.5')} role="alert">
            {error}
          </p>
        )}
      </div>
    )

  return { trailing, panel }
}
