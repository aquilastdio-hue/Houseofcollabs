import * as React from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div aria-hidden data-slot="skeleton" className={cn('animate-pulse rounded-control bg-muted-surface/70', className)} {...props} />
}
