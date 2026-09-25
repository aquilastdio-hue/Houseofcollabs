import { Toaster as Sonner } from 'sonner'

/** Global toast outlet (aria-live handled by sonner). Use `toast` from 'sonner'. */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={16}
      gap={8}
      toastOptions={{
        classNames: {
          toast: 'rounded-card! border! border-line! bg-surface! text-ink! shadow-float! font-sans!',
          title: 'font-medium!',
          description: 'text-muted!',
          actionButton: 'bg-ink! text-white! rounded-pill!',
          cancelButton: 'bg-subtle! text-ink! rounded-pill!',
          error: 'border-danger/30!',
          success: 'border-success/30!',
        },
      }}
    />
  )
}
