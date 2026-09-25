import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'

/**
 * Accessible confirmation dialog. With `reasonLabel`, asks for a (required)
 * reason and passes it to `onConfirm`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  loading,
  onConfirm,
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = true,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: (reason: string) => void | Promise<void>
  reasonLabel?: string
  reasonPlaceholder?: string
  reasonRequired?: boolean
  children?: React.ReactNode
}) {
  const [reason, setReason] = React.useState('')
  const [touched, setTouched] = React.useState(false)
  React.useEffect(() => {
    if (!open) {
      setReason('')
      setTouched(false)
    }
  }, [open])
  const invalid = !!reasonLabel && reasonRequired && reason.trim().length < 3

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent size="sm" role="alertdialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : 'sr-only'}>{description ?? title}</DialogDescription>
        </DialogHeader>
        {(reasonLabel || children) && (
          <DialogBody className="space-y-4">
            {children}
            {reasonLabel && (
              <Field label={reasonLabel} htmlFor="confirm-reason" required={reasonRequired} error={touched && invalid ? 'Please add a short reason.' : undefined}>
                <Textarea
                  id="confirm-reason"
                  rows={3}
                  value={reason}
                  placeholder={reasonPlaceholder}
                  onChange={(e) => setReason(e.target.value)}
                  onBlur={() => setTouched(true)}
                  maxLength={1000}
                />
              </Field>
            )}
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onClick={() => {
              setTouched(true)
              if (invalid) return
              void onConfirm(reason.trim())
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
