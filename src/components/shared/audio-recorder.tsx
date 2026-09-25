import * as React from 'react'
import { Mic, Square, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { Button } from '@/components/ui/button'

const MAX_SECONDS = 15

/**
 * Records a short voice clip (brand-name pronunciation) with MediaRecorder,
 * previews it, and hands the blob to `upload`. Falls back to file upload when
 * the browser has no microphone access.
 */
export function AudioRecorder({
  value,
  onChange,
  upload,
  className,
}: {
  value?: string | null
  onChange: (url: string | null) => void
  upload: (blob: Blob, fileName?: string) => Promise<string>
  className?: string
}) {
  const [recording, setRecording] = React.useState(false)
  const [seconds, setSeconds] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const timerRef = React.useRef<number | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  React.useEffect(() => () => {
    stopTimer()
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  const save = async (blob: Blob, name?: string) => {
    setBusy(true)
    try {
      onChange(await upload(blob, name))
      toast.success('Pronunciation saved')
    } catch (e) {
      toast.error(toAppError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const type = (rec.mimeType || 'audio/webm').split(';')[0]!
        void save(new Blob(chunksRef.current, { type }))
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
      setSeconds(0)
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop()
          return s + 1
        })
      }, 1000)
    } catch {
      toast.error('Microphone access was blocked. You can upload an audio file instead.')
    }
  }

  function stop() {
    stopTimer()
    setRecording(false)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  return (
    <div className={cn('rounded-card border border-line bg-surface p-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <Button type="button" variant="danger" size="sm" onClick={stop}>
            <Square /> Stop · 0:{String(seconds).padStart(2, '0')}
          </Button>
        ) : (
          <Button type="button" variant="primary" size="sm" onClick={() => void start()} disabled={!supported || busy} loading={busy}>
            <Mic /> {value ? 'Re-record' : 'Record pronunciation'}
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={recording || busy}>
          <Upload /> Upload audio
        </Button>
        {value && !recording && (
          <Button type="button" variant="danger-ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 /> Remove
          </Button>
        )}
        {recording && (
          <span className="flex items-center gap-2 text-sm text-danger" aria-live="polite">
            <span className="size-2 animate-pulse rounded-full bg-danger" /> Recording… (max {MAX_SECONDS}s)
          </span>
        )}
      </div>
      {value && !recording && <audio controls src={value} className="mt-3 h-10 w-full" aria-label="Pronunciation preview" />}
      <p className="mt-2 text-xs text-muted">Say your brand name clearly so creators pronounce it right in their videos.</p>
      <input
        ref={fileRef}
        type="file"
        accept="audio/webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg,.webm"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload pronunciation audio"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void save(f, f.name)
          e.target.value = ''
        }}
      />
    </div>
  )
}
