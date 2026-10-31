import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { EllipsisVertical, Trash2, X } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { removeProfilePhoto } from '@/services/admin.service'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Avatar } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAdminMutation } from './use-admin-mutation'

const ROUND_BUTTON =
  'focus-ring absolute top-[max(1rem,env(safe-area-inset-top))] inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 [&_svg]:size-5'

/**
 * A creator's or brand's picture on their admin page. Clicking it opens it
 * full screen, with close on the left and a ⋮ menu on the right whose Delete
 * erases it; their dashboard then asks them for a new one.
 */
export function ProfilePhoto({
  profileId,
  src,
  name,
  kind,
  shape,
}: {
  profileId: string
  src: string | null
  name: string
  kind: 'creator' | 'brand'
  shape?: 'circle' | 'rounded'
}) {
  const [open, setOpen] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const remove = useAdminMutation(() => removeProfilePhoto(profileId), {
    invalidate: [qk.admin.all, qk.creators.all],
    success: kind === 'brand' ? 'Logo deleted' : 'Profile picture deleted',
    onSuccess: () => {
      setConfirming(false)
      setOpen(false)
    },
  })

  const avatar = <Avatar src={src} name={name} size="xl" shape={shape} />
  if (!src) return avatar

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${kind === 'brand' ? 'the logo' : 'the profile picture'} full screen`}
        className={cn('focus-ring shrink-0 cursor-zoom-in', shape === 'rounded' ? 'rounded-control' : 'rounded-full')}
      >
        {avatar}
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black data-[state=open]:animate-fade-in" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-20 pb-6 focus:outline-none"
          >
            <DialogPrimitive.Title className="sr-only">{name}</DialogPrimitive.Title>
            <img src={src} alt={name} className="max-h-full max-w-full object-contain" />
            <DialogPrimitive.Close aria-label="Close" className={cn(ROUND_BUTTON, 'left-4')}>
              <X />
            </DialogPrimitive.Close>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="More" className={cn(ROUND_BUTTON, 'right-4')}>
                  <EllipsisVertical />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem destructive onSelect={() => setConfirming(true)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={kind === 'brand' ? 'Delete this logo for good?' : 'Delete this profile picture for good?'}
        description={
          kind === 'brand'
            ? `It’s erased from the platform. The next time ${name} opens their dashboard, they’re asked to upload a clear logo.`
            : `It’s erased from the platform. The next time ${name} opens their dashboard, they’re asked to upload a clear photo of their face. If the same picture is also one of their posts, the post stays.`
        }
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}
