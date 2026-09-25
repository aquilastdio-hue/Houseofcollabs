import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, variant = 'pill', ...props }: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: 'pill' | 'underline' }) {
  return (
    <TabsPrimitive.List
      data-variant={variant}
      className={cn(
        'no-scrollbar inline-flex max-w-full items-center overflow-x-auto',
        variant === 'pill' ? 'gap-1 rounded-pill bg-subtle p-1' : 'w-full gap-6 border-b border-line',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:text-ink disabled:opacity-50',
        'in-data-[variant=pill]:h-9 in-data-[variant=pill]:rounded-pill in-data-[variant=pill]:px-4 in-data-[variant=pill]:data-[state=active]:bg-surface in-data-[variant=pill]:data-[state=active]:text-ink in-data-[variant=pill]:data-[state=active]:shadow-card',
        'in-data-[variant=underline]:-mb-px in-data-[variant=underline]:border-b-2 in-data-[variant=underline]:border-transparent in-data-[variant=underline]:pb-3 in-data-[variant=underline]:data-[state=active]:border-ink in-data-[variant=underline]:data-[state=active]:text-ink',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('focus-visible:outline-none', className)} {...props} />
}
