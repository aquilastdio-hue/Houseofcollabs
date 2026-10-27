import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Camera, FileCheck2, Loader2, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { uploadApplicationFile } from '@/services/applications.service'
import { Button } from '@/components/ui/button'

/**
 * A live selfie for confirming that the person applying is the person on the
 * Instagram account. Admins compare it with the profile by eye while reviewing;
 * it stays in the private applications bucket and is never published.
 *
 * The front camera opens in the page so the photo is taken now rather than
 * picked from the gallery. Where there is no camera, or access is refused, the
 * fallback is a file input with `capture="user"` — on phones that still opens
 * the front camera.
 */
export function SelfieCapture({
  path,
  onUploaded,
  onClear,
  invalid,
}: {
  path: string
  onUploaded: (path: string) => void
  onClear: () => void
  invalid?: boolean
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [live, setLive] = React.useState(false)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [fallback, setFallback] = React.useState(false)

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLive(false)
  }, [])

  React.useEffect(() => stop, [stop])
  React.useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const upload = useMutation({
    mutationFn: (file: File) => uploadApplicationFile(file),
    onSuccess: (p, file) => {
      setMessage(null)
      setPreview(URL.createObjectURL(file))
      onUploaded(p)
    },
    onError: (e) => setMessage(toAppError(e).message),
  })

  async function open() {
    setMessage(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setFallback(true)
      inputRef.current?.click()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      setLive(true)
      // The <video> mounts with `live`; attach once it exists.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => undefined)
        }
      })
    } catch {
      setFallback(true)
      setMessage('We couldn’t open your camera. Allow camera access and try again, or take a photo with the button below.')
    }
  }

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Saved the way a mirror shows it, matching the preview the person framed.
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        stop()
        if (blob) upload.mutate(new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9,
    )
  }

  function retake() {
    setPreview(null)
    onClear()
    void open()
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="user"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) upload.mutate(file)
      }}
    />
  )

  if (live) {
    return (
      <div className="space-y-3">
        <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-card bg-ink">
          <video ref={videoRef} playsInline muted autoPlay className="size-full -scale-x-100 object-cover" />
          {/* An oval to frame the face in; purely a guide. */}
          <div aria-hidden className="pointer-events-none absolute inset-[12%_20%] rounded-[50%] border-2 border-white/80" />
        </div>
        <div className="mx-auto flex max-w-xs gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={stop}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={capture}>
            <Camera /> Take selfie
          </Button>
        </div>
      </div>
    )
  }

  if (path) {
    return (
      <div className="flex items-center gap-3 rounded-control border border-line bg-subtle p-2.5">
        {preview ? (
          <img src={preview} alt="Your selfie" className="size-14 shrink-0 rounded-control object-cover" />
        ) : (
          <FileCheck2 className="ml-1 size-5 shrink-0 text-success" aria-hidden />
        )}
        <span className="min-w-0 flex-1 text-sm">Selfie added</span>
        <Button type="button" variant="ghost" size="sm" onClick={retake}>
          <RotateCcw /> Retake
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Remove selfie"
          onClick={() => {
            setPreview(null)
            onClear()
          }}
        >
          <X />
        </Button>
      </div>
    )
  }

  return (
    <div>
      {fileInput}
      <Button
        type="button"
        variant="secondary"
        block
        disabled={upload.isPending}
        aria-invalid={invalid || undefined}
        onClick={() => (fallback ? inputRef.current?.click() : void open())}
      >
        {upload.isPending ? <Loader2 className="animate-spin" /> : <Camera />}
        {upload.isPending ? 'Uploading…' : fallback ? 'Take a photo' : 'Open camera'}
      </Button>
      <p className={cn('mt-1.5 text-xs', message ? 'text-danger' : 'text-muted')}>
        {message ?? 'Face the camera in good light, no sunglasses. Only our team sees this — it never appears on your profile.'}
      </p>
    </div>
  )
}
