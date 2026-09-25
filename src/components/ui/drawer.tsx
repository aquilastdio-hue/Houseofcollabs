import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Drawer = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close

const SIDES = {
  right: 'inset-y-0 right-0 h-full w-[min(92vw,26rem)] rounded-l-panel data-[state=open]:animate-drawer-right',
  left: 'inset-y-0 left-0 h-full w-[min(88vw,22rem)] rounded-r-panel data-[state=open]:animate-drawer-left',
  bottom: 'inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-panel data-[state=open]:animate-drawer-bottom',
} as const

export function DrawerContent({
  side = 'right',
  className,
  children,
  title,
  description,
  footer,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Content>, 'title'> & {
  side?: keyof typeof SIDES
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-night/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn('fixed z-50 flex flex-col bg-surface shadow-float focus:outline-none', SIDES[side], className)}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-display text-lg font-semibold tracking-tight">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className={cn('text-sm text-muted', !description && 'sr-only')}>
              {description ?? title}
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close
            className="focus-ring -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && <div className="border-t border-line bg-surface px-5 py-4">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
