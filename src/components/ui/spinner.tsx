import { cn } from '@/lib/utils'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <svg className={cn('size-5 animate-spin', className)} viewBox="0 0 24 24" fill="none" role="status" aria-label={label}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center text-muted" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-6 text-ink" label={label} />
        <span className="text-sm">{label}…</span>
      </div>
    </div>
  )
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <div className="flex items-center gap-3">
        <span className="relative flex size-3">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-80" />
          <span className="relative inline-flex size-3 rounded-full bg-ink" />
        </span>
        <span className="font-display text-lg font-semibold tracking-tight">House of Collabs</span>
      </div>
    </div>
  )
}
