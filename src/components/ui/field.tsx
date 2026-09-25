import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

type FieldProps = {
  label?: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: string
  required?: boolean
  optional?: boolean
  className?: string
  labelAction?: React.ReactNode
  children: React.ReactNode
}

/**
 * Accessible form field wrapper: label + control + hint/error. Pass the same
 * id to the control as `htmlFor`; the error is announced via aria-describedby.
 */
export function Field({ label, htmlFor, hint, error, required, optional, className, labelAction, children }: FieldProps) {
  const describedBy = htmlFor ? `${htmlFor}-desc` : undefined
  const control = React.isValidElement<{ 'aria-invalid'?: boolean; 'aria-describedby'?: string }>(children)
    ? React.cloneElement(children, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? describedBy : undefined,
      })
    : children
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={htmlFor}>
            {label}
            {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
            {optional && <span className="ml-1.5 text-xs font-normal text-faint">Optional</span>}
          </Label>
          {labelAction}
        </div>
      )}
      {control}
      {error ? (
        <p id={describedBy} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
