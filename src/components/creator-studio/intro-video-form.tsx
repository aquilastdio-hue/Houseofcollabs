import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Trash2, Upload, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { BUCKET_RULES } from '@/lib/validation/files'
import { useAuth } from '@/contexts/auth-context'
import { uploadPortfolioMedia } from '@/services/portfolio.service'
import { updateMyCreator, type CreatorProfile } from '@/services/creators.service'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { StudioSection } from './parts'
import { useStudioSync } from './use-studio'

const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime'

/**
 * Short intro video, saved to `creators.intro_video_url`.
 *
 * It's the thing our review team watches before approving a creator, so it is
 * asked for during signup — but left optional, because a creator with a strong
 * profile shouldn't be blocked on recording one. It also shows on the public
 * storefront once they're live, so it does double duty.
 */
export function IntroVideoForm({ creator, className }: { creator: CreatorProfile; className?: string }) {
  const { user } = useAuth()
  const sync = useStudioSync()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = React.useState(false)

  const save = useMutation({
    mutationFn: async (file: File) => {
      const media = await uploadPortfolioMedia(user!.id, file)
      if (media.type !== 'video') throw new Error('Choose a video file.')
      await updateMyCreator(creator.id, { intro_video_url: media.media_url })
      await sync()
    },
    meta: { successMessage: 'Intro video uploaded' },
    onError: (e) => setError(toAppError(e).message),
    onSuccess: () => setError(null),
  })

  const remove = useMutation({
    mutationFn: async () => {
      await updateMyCreator(creator.id, { intro_video_url: null })
      await sync()
    },
    meta: { successMessage: 'Intro video removed' },
    onSuccess: () => setConfirmRemove(false),
  })

  const url = creator.intro_video_url
  const max = BUCKET_RULES['creator-portfolio'].maxBytes / (1024 * 1024)

  return (
    <StudioSection
      title="Intro video"
      description="A short clip introducing yourself. Our team watches this when reviewing your profile, and brands see it on your storefront."
      className={className}
    >
      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) save.mutate(file)
        }}
      />

      {url ? (
        <div className="space-y-3">
          <video src={url} controls playsInline preload="metadata" className="max-h-80 w-full rounded-control bg-night" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" loading={save.isPending} onClick={() => inputRef.current?.click()}>
              <Upload /> Replace video
            </Button>
            <Button type="button" variant="danger-ghost" size="sm" onClick={() => setConfirmRemove(true)}>
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={save.isPending || !user}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'focus-ring flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-line-strong bg-subtle/50 px-6 py-10 text-center',
            'transition-colors hover:border-brand-strong/50 hover:bg-brand-soft/40 disabled:opacity-60',
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink [&_svg]:size-5" aria-hidden>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Video />}
          </span>
          <span className="text-sm font-medium">{save.isPending ? 'Uploading…' : 'Upload an intro video'}</span>
          <span className="text-xs text-muted">MP4, WebM or MOV, up to {max} MB. 30–60 seconds is plenty.</span>
        </button>
      )}

      <p className={cn('text-xs', error ? 'text-danger' : 'text-muted')}>
        {error ?? 'Optional, but profiles with a video are reviewed faster. Say who you are, what you make and who you make it for.'}
      </p>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove your intro video?"
        description="Brands won’t see it on your storefront any more. You can upload a new one at any time."
        confirmLabel="Remove video"
        destructive
        reasonRequired={false}
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </StudioSection>
  )
}
