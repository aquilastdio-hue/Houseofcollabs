import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, type InputProps } from '@/components/ui/input'
import { passwordStrength } from '@/schemas/auth'

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
