import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { KeyRound, LinkIcon } from 'lucide-react'
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
 * Landing page for the password-recovery email. supabase-js exchanges the
 * PKCE code in the URL for a recovery session automatically.
 */
export default function ResetPassword() {
  const { initializing, session, profile } = useAuth()
  const navigate = useNavigate()
  const hasCode = React.useMemo(() => new URLSearchParams(window.location.search).has('code'), [])
  const [waited, setWaited] = React.useState(!hasCode)
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
      toast.success('Password updated')
      navigate(homeFor(profile?.role, profile?.onboarding_completed), { replace: true })
    } catch (e) {
      form.setError('root', { message: toAppError(e).message })
    }
  })

  if (initializing || (!session && !waited)) return <PageLoader label="Verifying your link" />

  if (!session) {
    return (
      <div className="text-center">
        <Seo title="Reset link expired" noindex />
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <LinkIcon className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-display-md font-semibold">This link has expired</h1>
        <p className="mt-2 text-muted">Reset links work once and expire after an hour. Request a new one to continue.</p>
        <Button asChild className="mt-6">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <Seo title="Choose a new password" noindex />
      <AuthHeading title="Choose a new password" subtitle={`For ${session.user.email}`} />
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
          <KeyRound /> Update password
        </Button>
      </form>
    </>
  )
}
