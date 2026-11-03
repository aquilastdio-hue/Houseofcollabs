import * as React from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, EyeOff, LinkIcon, MailCheck, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { requestPasswordReset } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input, type InputProps } from '@/components/ui/input'
import { Seo } from '@/components/shared/seo'
import { forgotSchema, passwordStrength, type ForgotValues } from '@/schemas/auth'

export function AuthHeading({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <h1 className="font-display text-display-md font-semibold">{title}</h1>
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
    </div>
  )
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4', className)} aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.24 1.4-1.66 4.1-5.4 4.1-3.25 0-5.9-2.69-5.9-6s2.65-6 5.9-6c1.85 0 3.09.79 3.8 1.47l2.59-2.49C16.73 3.7 14.57 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51H12z" />
      <path fill="#34A853" d="M3.88 7.36l3.2 2.35C7.94 7.6 9.8 6.2 12 6.2c1.85 0 3.09.79 3.8 1.47l2.59-2.49C16.73 3.7 14.57 2.8 12 2.8 8.47 2.8 5.42 4.8 3.88 7.36z" opacity=".9" />
      <path fill="#FBBC05" d="M12 21.2c2.5 0 4.6-.82 6.14-2.24l-2.84-2.33c-.78.54-1.83.92-3.3.92-2.2 0-4.06-1.41-4.73-3.36l-3.3 2.54C5.52 19.3 8.5 21.2 12 21.2z" />
      <path fill="#4285F4" d="M20.83 12.21c0-.6-.07-1.06-.15-1.51H12v3.9h5.4c-.25 1.2-1 2.23-2.1 2.95l2.84 2.33c1.66-1.53 2.69-3.79 2.69-7.67z" />
    </svg>
  )
}

export function GoogleButton({ onClick, loading, label = 'Continue with Google' }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <Button type="button" variant="secondary" size="lg" block onClick={onClick} loading={loading}>
      {!loading && <GoogleIcon />}
      {label}
    </Button>
  )
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-faint" role="separator">
      <span className="h-px flex-1 bg-line" />
      or continue with email
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(function PasswordInput(props, ref) {
  const [show, setShow] = React.useState(false)
  return (
    <Input
      ref={ref}
      {...props}
      type={show ? 'text' : 'password'}
      rightSlot={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="focus-ring flex size-8 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-ink"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  )
})

export function PasswordMeter({ value }: { value: string }) {
  if (!value) return null
  const score = passwordStrength(value)
  const labels = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong']
  const tones = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-brand-strong', 'bg-success']
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-pill', i < score ? tones[score] : 'bg-muted-surface')} />
        ))}
      </div>
      <span className="text-xs text-muted">{labels[score]}</span>
    </div>
  )
}

const RESET_EMAIL_KEY = 'reset-email'

/** Remembers the address this browser asked a reset link for, so an expired link can send a new one in a tap. */
export function rememberResetEmail(email: string) {
  try {
    localStorage.setItem(RESET_EMAIL_KEY, email)
  } catch {
    // Private mode: the field just starts empty.
  }
}

function rememberedResetEmail() {
  try {
    return localStorage.getItem(RESET_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

/** "Check your email", after a reset link has gone out. */
export function ResetLinkSent({ email }: { email: string }) {
  return (
    <div className="text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand text-white">
        <MailCheck className="size-6" />
      </span>
      <h1 className="mt-5 font-display text-display-md font-semibold">Check your email</h1>
      <p className="mt-2 text-muted">
        If an account exists for <span className="font-medium text-ink">{email}</span>, you’ll receive a link to choose a new password. The
        link expires in an hour.
      </p>
      <Button asChild variant="secondary" className="mt-6">
        <Link to="/login">
          <ArrowLeft /> Back to log in
        </Link>
      </Button>
    </div>
  )
}

/**
 * What an expired reset or invitation link shows: the email and a button that
 * sends a new link right away, filled in when this browser asked for the last
 * one. The expired link itself can't say whose it was.
 */
export function ExpiredLinkResend({ seoTitle, description }: { seoTitle: string; description: string }) {
  const [sent, setSent] = React.useState<string | null>(null)
  const form = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: rememberedResetEmail() } })
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

  if (sent) return <ResetLinkSent email={sent} />

  return (
    <div>
      <Seo title={seoTitle} noindex />
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <LinkIcon className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-display-md font-semibold">This link has expired</h1>
        <p className="mt-2 text-muted">{description}</p>
      </div>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <Field label="Email" htmlFor="resend-email" error={errors.email?.message}>
          <Input id="resend-email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />
        </Field>
        {errors.root?.message && (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" block loading={isSubmitting}>
          <Send /> Send new link
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-medium text-ink underline-offset-2 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  )
}
