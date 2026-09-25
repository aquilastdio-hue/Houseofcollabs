import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-pill font-medium [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'bg-subtle text-ink-soft',
        outline: 'border border-line bg-surface text-ink-soft',
        dark: 'bg-ink text-white',
        brand: 'bg-brand text-white',
        'brand-soft': 'bg-brand-soft text-brand-ink',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        lilac: 'bg-lilac-soft text-lilac',
        rose: 'bg-rose-soft text-rose',
        peach: 'bg-peach-soft text-peach',
        sand: 'bg-sand-soft text-sand',
        mint: 'bg-mint-soft text-mint',
        sky: 'bg-sky-soft text-sky',
        glass: 'bg-white/85 text-ink backdrop-blur-sm',
      },
      size: {
        sm: 'h-5 px-2 text-[0.6875rem]',
        md: 'h-6 px-2.5 text-xs',
        lg: 'h-8 px-3 text-sm',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export function Badge({ className, tone, size, dot, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {props.children}
    </span>
  )
}
