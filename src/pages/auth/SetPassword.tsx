import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { KeyRound, LinkIcon, PartyPopper } from 'lucide-react'
import { resetSchema, type ResetValues } from '@/schemas/auth'
import { updatePassword } from '@/services/auth.service'
import { establishSessionFromLink, readAuthLink } from '@/lib/auth-link'
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
 * The account shown — and the account whose password gets set — comes from the
 * link, never from whatever session the browser already holds. That matters:
 * the person most likely to open one of these is the admin who just approved
 * the application, and they are usually signed in as themselves. Reading the
 * ambient session there would show their own address and quietly change their
 * own password.
 *
 * So: no link, no form. A visitor with nothing to redeem is sent to ask for a
 * fresh one rather than being offered a password box for the wrong account.
 */
export default function SetPassword() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Snapshot during the first render — supabase-js strips `?code=` once it
  // exchanges it, so reading this from an effect can miss it.
  const [link] = React.useState(() => readAuthLink())
  const [state, setState] = React.useState<'checking' | 'ready' | 'invalid'>(link ? 'checking' : 'invalid')
  const [account, setAccount] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } })
  const { errors, isSubmitting } = form.formState
  const password = form.watch('password')

  React.useEffect(() => {
    if (!link) return
    let cancelled = false
    void (async () => {
      const result = await establishSessionFromLink(link)
      if (cancelled) return
      if (result.ok) {
        setAccount(result.email)
        setState('ready')
      } else {
        setState('invalid')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [link])

  const onSubmit = form.handleSubmit(async ({ password: pw }) => {
    try {
      await updatePassword(pw)
      toast.success('Password created')
      setDone(true)
    } catch (e) {
      form.setError('root', { message: toAppError(e).message })
    }
  })

  if (state === 'checking') return <PageLoader label="Verifying your invitation" />

  if (state === 'invalid') {
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
          Your password has been created successfully. You can sign in with {account} from now on.
        </p>
        {/* The link left them holding a session, so "continue" goes straight to
            their dashboard rather than making them retype what they just chose. */}
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
      <AuthHeading title="Set your password" subtitle={`Welcome to House of Collabs. Choose a password for ${account}.`} />
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
