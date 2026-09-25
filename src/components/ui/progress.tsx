import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export function Progress({ className, value, tone = 'ink', ...props }: React.ComponentProps<typeof ProgressPrimitive.Root> & { tone?: 'ink' | 'brand' | 'success' }) {
  return (
    <ProgressPrimitive.Root className={cn('relative h-2 w-full overflow-hidden rounded-pill bg-muted-surface', className)} value={value} {...props}>
      <ProgressPrimitive.Indicator
        className={cn('h-full w-full flex-1 rounded-pill transition-transform duration-500 ease-spring', tone === 'brand' ? 'bg-brand' : tone === 'success' ? 'bg-success' : 'bg-ink')}
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value ?? 0))}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}
