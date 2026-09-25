import * as React from 'react'
import { Accordion as AccordionPrimitive } from 'radix-ui'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Accordion = AccordionPrimitive.Root

export function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn('border-b border-line last:border-b-0', className)} {...props} />
}

export function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'focus-ring group flex flex-1 items-center justify-between gap-6 rounded-control py-5 text-left font-display text-lg font-medium tracking-tight transition-colors hover:text-ink-soft',
          className,
        )}
        {...props}
      >
        {children}
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line transition-[transform,background-color] duration-300 ease-spring group-data-[state=open]:rotate-45 group-data-[state=open]:bg-brand">
          <Plus className="size-4" />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

export function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content className="overflow-hidden text-muted data-[state=open]:animate-fade-in" {...props}>
      <div className={cn('max-w-prose pr-12 pb-5 leading-relaxed', className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}
