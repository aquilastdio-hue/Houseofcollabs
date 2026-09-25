import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Dialog wrapping a `<form>`: Enter submits, the footer holds cancel/submit,
 * and the dialog can't be dismissed while the request is in flight.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitLabel,
  loading,
  destructive,
  submitDisabled,
  size = 'md',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  submitLabel: string
  loading?: boolean
  destructive?: boolean
  submitDisabled?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : 'sr-only'}>{description ?? title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <DialogBody className="space-y-4">{children}</DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? 'danger' : 'primary'} loading={loading} disabled={submitDisabled}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Inline notice inside dialogs/cards (warning, info, danger). */
export function Notice({ tone = 'info', icon, children, className }: { tone?: 'info' | 'warning' | 'danger' | 'success'; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const tones = {
    info: 'bg-info-soft text-info',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    success: 'bg-success-soft text-success',
  } as const
  return (
    <div className={cn('flex items-start gap-2.5 rounded-control px-3.5 py-3 text-sm', tones[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
