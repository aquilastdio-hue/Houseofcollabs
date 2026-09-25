import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { MailWarning } from 'lucide-react'
import { loginSchema, type LoginValues } from '@/schemas/auth'
import { resendVerification, signInWithEmail, signInWithGoogle } from '@/services/auth.service'
import { toAppError } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Seo } from '@/components/shared/seo'
import { AuthHeading, GoogleButton, OrDivider, PasswordInput } from '@/components/auth/auth-parts'

export default function Login() {
  const [params] = useSearchParams()
  const redirect = params.get('redirect') ?? undefined
  // Carried from the landing page's Collabs / Creators choice. Only ever used
  // for someone who has no role yet — `set_initial_role` refuses anything else,
  // and refuses 'admin' outright — so an existing account is unaffected.
  const roleParam = params.get('role')
  const role = roleParam === 'creator' ? 'creator' : roleParam === 'brand' ? 'brand' : undefined
  const [googleLoading, setGoogleLoading] = React.useState(false)
  const [unconfirmed, setUnconfirmed] = React.useState<string | null>(null)
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setUnconfirmed(null)
    try {
      await signInWithEmail(values.email, values.password)
      // GuestOnly redirects to the workspace (or ?redirect) once the profile loads.
    } catch (e) {
      const err = toAppError(e)
      if (err.code === 'email_not_confirmed') setUnconfirmed(values.email)
      else form.setError('root', { message: err.message })
    }
  })

  return (
    <>
      <Seo title="Log in" description="Log in to your House of Collabs workspace." />
      <AuthHeading title="Welcome back" subtitle="Log in to manage your orders, messages and storefront." />

      <GoogleButton
        loading={googleLoading}
        onClick={async () => {
          setGoogleLoading(true)
          try {
            await signInWithGoogle({ role, redirect })
          } catch (e) {
            toast.error(toAppError(e).message)
            setGoogleLoading(false)
          }
        }}
      />
      <OrDivider />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          labelAction={
            <Link to="/forgot-password" className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput id="password" autoComplete="current-password" {...form.register('password')} />
        </Field>

        {errors.root?.message && (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
        {unconfirmed && (
          <div role="alert" className="flex items-start gap-3 rounded-control bg-warning-soft p-3 text-sm text-warning">
            <MailWarning className="mt-0.5 size-4 shrink-0" />
            <div>
              <p>Please confirm your email first — check your inbox for the verification link.</p>
              <button
                type="button"
                className="mt-1 font-semibold underline underline-offset-2"
                onClick={async () => {
                  try {
                    await resendVerification(unconfirmed)
                    toast.success('Verification email sent')
                  } catch (e) {
                    toast.error(toAppError(e).message)
                  }
                }}
              >
                Resend verification email
              </button>
            </div>
          </div>
        )}

        <Button type="submit" size="lg" block loading={isSubmitting}>
          Log in
        </Button>
      </form>
    </>
  )
}
