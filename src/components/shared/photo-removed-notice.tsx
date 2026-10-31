import * as React from 'react'
import { Link } from 'react-router'
import { ImageOff } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

const COPY = {
  creator: {
    title: 'Your profile picture was removed',
    body: 'Our team removed your profile picture because it didn’t clearly show your face. Please upload a clear picture of your face only.',
    action: 'Upload a new picture',
    href: '/creator/profile',
  },
  brand: {
    title: 'Your logo was removed',
    body: 'Our team removed your logo because it wasn’t clear. Please upload a clear logo of your brand.',
    action: 'Upload a new logo',
    href: '/brand/settings/profile',
  },
} as const

const seenKey = (removedAt: string) => `photo-removed-seen:${removedAt}`

function seen(removedAt: string) {
  try {
    return sessionStorage.getItem(seenKey(removedAt)) === '1'
  } catch {
    return false
  }
}

/**
 * Shown in the middle of the dashboard after an admin removes someone's
 * picture (`profiles.photo_removed_at`), once per visit, until they upload a
 * new one. Uploading clears the flag in the database.
 */
export function PhotoRemovedNotice({ kind }: { kind: 'creator' | 'brand' }) {
  const { profile } = useAuth()
  const removedAt = profile?.photo_removed_at ?? null
  const [closedFor, setClosedFor] = React.useState<string | null>(null)
  if (!removedAt || closedFor === removedAt || seen(removedAt)) return null

  const close = () => {
    try {
      sessionStorage.setItem(seenKey(removedAt), '1')
    } catch {
      // Private mode: it just shows again on the next page load.
    }
    setClosedFor(removedAt)
  }
  const copy = COPY[kind]

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        size="sm"
        hideClose
        // Centred on phones too, rather than the usual bottom sheet.
        className="inset-auto top-1/2 left-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-panel"
      >
        <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger [&_svg]:size-6" aria-hidden>
            <ImageOff />
          </span>
          <DialogTitle className="font-display text-xl font-semibold tracking-tight">{copy.title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-ink-soft">{copy.body}</DialogDescription>
          <div className="mt-6 flex w-full flex-col gap-2">
            <Button asChild>
              <Link to={copy.href} onClick={close}>
                {copy.action}
              </Link>
            </Button>
            <Button variant="ghost" onClick={close}>
              Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
