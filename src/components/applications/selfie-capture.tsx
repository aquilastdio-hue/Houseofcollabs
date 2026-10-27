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
 * Camera only, on purpose: there is no file picker, so the photo has to be
 * taken now rather than chosen from a gallery. When the camera can't open,
 * the message says why and how to fix it instead of offering a way round.
 *
 * The site's Permissions-Policy header (vercel.json) must allow `camera=(self)`,
 * or every browser refuses before asking.
 */

function cameraProblem(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access is blocked. Allow the camera for this site in your browser settings, then tap Try again.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'We couldn’t find a camera on this device. Please continue on your phone.'
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'Your camera is busy in another app. Close it and tap Try again.'
  }
  return 'We couldn’t open your camera. Tap Try again, or continue on your phone.'
}

const NO_CAMERA_API =
  'This browser can’t open the camera. Open this page in Chrome or Safari — in-app browsers such as Instagram’s don’t allow it.'

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
  const [stream, setStream] = React.useState<MediaStream | null>(null)
  const [starting, setStarting] = React.useState(false)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)

  const stop = React.useCallback(() => {
    setStream((s) => {
      s?.getTracks().forEach((t) => t.stop())
      return null
    })
  }, [])

  // Attach once the <video> exists; stop the camera when leaving the page.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => undefined)
  }, [stream])
  React.useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream])
  React.useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const upload = useMutation({
    mutationFn: (file: File) => uploadApplicationFile(file),
    onSuccess: (p, file) => {
      setProblem(null)
      setPreview(URL.createObjectURL(file))
      onUploaded(p)
    },
    onError: (e) => setProblem(toAppError(e).message),
  })

  async function open() {
    setProblem(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem(NO_CAMERA_API)
      return
    }
    setStarting(true)
    try {
      setStream(
        await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        }),
      )
    } catch (e) {
      setProblem(cameraProblem(e))
    } finally {
      setStarting(false)
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

  if (stream) {
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

  const busy = starting || upload.isPending
  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        block
        disabled={busy}
        aria-invalid={invalid || undefined}
        onClick={() => void open()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Camera />}
        {upload.isPending ? 'Uploading…' : starting ? 'Opening camera…' : problem ? 'Try again' : 'Open camera'}
      </Button>
      <p className={cn('mt-1.5 text-xs', problem ? 'text-danger' : 'text-muted')}>
        {problem ?? 'Take a live selfie: face the camera in good light, no sunglasses. Only our team sees this — it never appears on your profile.'}
      </p>
    </div>
  )
}
