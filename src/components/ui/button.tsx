import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Spinner } from './spinner'

export const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none',
    'transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-spring',
    'focus-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  ],
  {
    variants: {
      variant: {
        // The signature CTA: pink→violet gradient. `bg-size`/`bg-position` shift
        // on hover so the gradient animates instead of just changing shade.
        primary: [
          'bg-brand-gradient text-white shadow-brand [background-size:150%_150%] [background-position:0%_50%]',
          'transition-[background-position,box-shadow,transform] hover:[background-position:100%_50%]',
          'hover:shadow-card-hover',
        ],
        /** Flat brand fill — for dense UI where the gradient would be noisy. */
        accent: 'bg-brand text-white hover:bg-brand-strong',
        /** The former primary: neutral ink. Kept for secondary CTAs on brand surfaces. */
        ink: 'bg-ink text-white shadow-card hover:bg-ink-soft',
        secondary: 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-subtle',
        outline: 'border border-ink/15 bg-transparent text-ink hover:border-ink hover:bg-ink hover:text-white',
        ghost: 'bg-transparent text-ink hover:bg-subtle',
        subtle: 'bg-subtle text-ink hover:bg-muted-surface',
        inverse: 'bg-white text-ink hover:bg-canvas',
        'ghost-inverse': 'bg-transparent text-white hover:bg-white/10',
        danger: 'bg-danger text-white hover:bg-danger/90',
        'danger-ghost': 'bg-transparent text-danger hover:bg-danger-soft',
        link: 'h-auto px-0 text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink',
      },
      size: {
        xs: 'h-7 rounded-pill px-2.5 text-xs',
        sm: 'h-9 rounded-pill px-3.5 text-sm',
        md: 'h-11 rounded-pill px-5 text-sm',
        lg: 'h-12 rounded-pill px-6 text-[0.95rem]',
        xl: 'h-14 rounded-pill px-8 text-base',
        icon: 'size-11 rounded-pill',
        'icon-sm': 'size-9 rounded-pill',
        'icon-xs': 'size-7 rounded-pill',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }

export function Button({ className, variant, size, block, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner className="size-4" />}
          {children}
        </>
      )}
    </Comp>
  )
}
