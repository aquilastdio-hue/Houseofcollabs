import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { KeyRound, LinkIcon, PartyPopper } from 'lucide-react'
import { resetSchema, type ResetValues } from '@/schemas/auth'
import { updatePassword } from '@/services/auth.service'
import { toAppError } from '@/lib/errors'
import { homeFor, useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PageLoader } from '@/components/ui/spinner'
import { Seo } from '@/components/shared/seo'
import { AuthHeading, PasswordInput, PasswordMeter } from '@/components/auth/auth-parts'

/**
 * Landing page for the approval invite.
 *
 * Mechanically this is /reset-password — supabase-js exchanges the code in the
 * URL for a session, and `updateUser` sets the password against it. It exists
 * separately because the words have to differ: someone arriving here has just
 * been approved and has never had a password, so "reset" would be wrong and
 * "this link has expired" needs to send them somewhere that works for an
 * account with no password yet.
 *
 * Both Supabase templates — Invite user and Reset password — can point here.
 * The invite is the normal path; the reset is what an already-registered
 * applicant gets when an admin re-approves them.
 */
export default function SetPassword() {
  const { initializing, session, profile } = useAuth()
  const navigate = useNavigate()
  // The link carries either a PKCE `code` or a token hash; either way the
  // client needs a moment to turn it into a session before we judge it missing.
  const hasCode = React.useMemo(() => {
    const url = new URL(window.location.href)
    return url.searchParams.has('code') || url.searchParams.has('token_hash') || url.hash.includes('access_token')
  }, [])
  const [waited, setWaited] = React.useState(!hasCode)
  const [done, setDone] = React.useState(false)
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } })
  const { errors, isSubmitting } = form.formState
  const password = form.watch('password')

  React.useEffect(() => {
    if (!hasCode || session) return
    const t = window.setTimeout(() => setWaited(true), 4000)
    return () => window.clearTimeout(t)
  }, [hasCode, session])

  const onSubmit = form.handleSubmit(async ({ password: pw }) => {
    try {
      await updatePassword(pw)
      toast.success('Password created')
      setDone(true)
    } catch (e) {
      form.setError('root', { message: toAppError(e).message })
    }
  })

  if (initializing || (!session && !waited)) return <PageLoader label="Verifying your invitation" />

  // No session: the link was used already, expired, or was opened in a
  // different browser than it was requested from.
  if (!session) {
    return (
      <div className="text-center">
        <Seo title="Invitation link expired" noindex />
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <LinkIcon className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-display-md font-semibold">This link has expired</h1>
        <p className="mt-2 text-muted">
          Invitation links work once and expire after a while. Ask for a fresh one and we’ll email it to the address you applied
          with.
        </p>
        <Button asChild className="mt-6">
          <Link to="/forgot-password">Email me a new link</Link>
        </Button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center">
        <Seo title="Password created" noindex />
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
          <PartyPopper className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-display-md font-semibold">You’re all set</h1>
        <p className="mt-2 text-muted">
          Your password has been created successfully. You can sign in with {session.user.email} from now on.
        </p>
        {/* They already hold a session from the invite, so "continue" goes
            straight to their dashboard rather than making them type the
            password they just chose. */}
        <Button className="mt-6" onClick={() => navigate(homeFor(profile?.role, profile?.onboarding_completed), { replace: true })}>
          Continue to my dashboard
        </Button>
        <p className="mt-4 text-sm text-muted">
          <Link to="/login" className="font-medium text-ink underline-offset-2 hover:underline">
            Go to the login page instead
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <Seo title="Set your password" noindex />
      <AuthHeading
        title="Set your password"
        subtitle={`Welcome to House of Collabs. Choose a password for ${session.user.email}.`}
      />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <PasswordMeter value={password} />
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        {errors.root?.message && (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" block loading={isSubmitting}>
          <KeyRound /> Set password
        </Button>
      </form>
    </>
  )
}
