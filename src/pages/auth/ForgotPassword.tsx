import * as React from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotSchema, type ForgotValues } from '@/schemas/auth'
import { requestPasswordReset } from '@/services/auth.service'
import { toAppError } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Seo } from '@/components/shared/seo'
import { AuthHeading, rememberResetEmail, ResetLinkSent } from '@/components/auth/auth-parts'

export default function ForgotPassword() {
  const [sent, setSent] = React.useState<string | null>(null)
  const form = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ email }) => {
    try {
      await requestPasswordReset(email)
      rememberResetEmail(email)
      setSent(email)
    } catch (e) {
      form.setError('root', { message: toAppError(e).message })
    }
  })

  return (
    <>
      <Seo title="Reset your password" noindex />
      {sent ? (
        <ResetLinkSent email={sent} />
      ) : (
        <>
          <AuthHeading title="Forgot your password?" subtitle="Enter the email you signed up with and we’ll send you a reset link." />
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />
            </Field>
            {errors.root?.message && (
              <p role="alert" className="rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
                {errors.root.message}
              </p>
            )}
            <Button type="submit" size="lg" block loading={isSubmitting}>
              Send reset link
            </Button>
          </form>
          <p className="mt-8 text-center text-sm text-muted">
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-ink underline-offset-2 hover:underline">
              Log in
            </Link>
          </p>
        </>
      )}
    </>
  )
}
