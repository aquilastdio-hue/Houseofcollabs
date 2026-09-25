import * as React from 'react'
import { cn } from '@/lib/utils'
import { controlBase } from './input'

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(controlBase, 'min-h-24 resize-y px-3.5 py-3 text-sm leading-relaxed', className)}
      {...props}
    />
  )
}
