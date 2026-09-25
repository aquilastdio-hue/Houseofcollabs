import * as React from 'react'
import { cn } from '@/lib/utils'

export const controlBase = [
  'w-full min-w-0 rounded-control border border-line bg-surface text-ink',
  'transition-[border-color,box-shadow] duration-200 ease-soft',
  'placeholder:text-faint hover:border-line-strong',
  'focus-visible:border-ink focus-visible:outline-none focus-visible:shadow-glow',
  'disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-70',
  'aria-invalid:border-danger aria-invalid:focus-visible:shadow-none',
].join(' ')

export type InputProps = React.ComponentProps<'input'> & {
  leftIcon?: React.ReactNode
  rightSlot?: React.ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

export function Input({ className, leftIcon, rightSlot, inputSize = 'md', type = 'text', ...props }: InputProps) {
  const sizing = inputSize === 'sm' ? 'h-9 text-sm px-3' : inputSize === 'lg' ? 'h-13 text-base px-4' : 'h-11 text-sm px-3.5'
  if (!leftIcon && !rightSlot) {
    return <input type={type} data-slot="input" className={cn(controlBase, sizing, className)} {...props} />
  }
  return (
    <div className="relative w-full">
      {leftIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-faint [&_svg]:size-4">{leftIcon}</span>
      )}
      <input
        type={type}
        data-slot="input"
        className={cn(controlBase, sizing, leftIcon && 'pl-10', rightSlot && 'pr-11', className)}
        {...props}
      />
      {rightSlot && <span className="absolute inset-y-0 right-1.5 flex items-center">{rightSlot}</span>}
    </div>
  )
}
