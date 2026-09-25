import * as React from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { acceptFor, validateFile, type Bucket } from '@/lib/validation/files'
import { Button } from '@/components/ui/button'

/**
 * Single image picker with live preview (avatars, logos, covers). The parent
 * supplies `upload(file) → publicUrl` and receives the new URL via onChange.
 */
export function ImageUploader({
  value,
  onChange,
  upload,
  bucket,
  shape = 'circle',
  aspect = 'square',
  label = 'Upload image',
  className,
  removable = true,
}: {
  value?: string | null
  onChange: (url: string | null) => void
  upload: (file: File) => Promise<string>
  bucket: Bucket
  shape?: 'circle' | 'rounded'
  aspect?: 'square' | 'cover'
  label?: string
  className?: string
  removable?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const shown = preview ?? value ?? null

  const onFile = async (file?: File) => {
    if (!file) return
    const problem = validateFile(bucket, file, { kinds: ['image'] })
    if (problem) {
      toast.error(problem)
      return
    }
    const local = URL.createObjectURL(file)
    setPreview(local)
    setBusy(true)
    try {
      const url = await upload(file)
      onChange(url)
    } catch (e) {
      toast.error(toAppError(e).message)
    } finally {
      setBusy(false)
      setPreview(null)
      URL.revokeObjectURL(local)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('flex items-center gap-4', aspect === 'cover' && 'flex-col items-stretch', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'focus-ring group relative shrink-0 overflow-hidden border border-line bg-subtle',
          aspect === 'cover' ? 'aspect-[3/1] w-full rounded-card' : 'size-24',
          aspect !== 'cover' && (shape === 'circle' ? 'rounded-full' : 'rounded-card'),
        )}
        aria-label={label}
      >
        {shown ? (
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-faint">
            <Camera className="size-6" />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-night/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-night/35 text-white">
            <Loader2 className="size-5 animate-spin" />
          </span>
        )}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={busy}>
          {shown ? 'Replace' : label}
        </Button>
        {removable && value && !busy && (
          <Button type="button" variant="danger-ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 /> Remove
          </Button>
        )}
        <p className="w-full text-xs text-muted">JPG, PNG or WebP. We optimise it for you.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptFor(bucket, ['image'])}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void onFile(e.target.files?.[0])}
        aria-label={label}
      />
    </div>
  )
}
