import * as React from 'react'
import { CheckCircle2, FileText, Film, ImageIcon, Paperclip, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'
import { toAppError } from '@/lib/errors'
import { acceptFor, BUCKET_RULES, validateFile, type Bucket } from '@/lib/validation/files'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'

type Kind = 'image' | 'video' | 'audio' | 'doc'

export type UploadItem<R> = {
  id: string
  file: File
  status: 'uploading' | 'done' | 'error'
  error?: string
  result?: R
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <ImageIcon className="size-4" />
  if (mime.startsWith('video/')) return <Film className="size-4" />
  return <FileText className="size-4" />
}

/**
 * Drag-and-drop multi-file uploader. Validates size/MIME/extension against
 * the bucket rules, then calls `upload(file)` per file and reports results.
 */
export function FileUploader<R>({
  bucket,
  kinds,
  maxFiles = 10,
  upload,
  onUploaded,
  onRemove,
  items: controlledItems,
  label = 'Drag files here or browse',
  hint,
  compact,
  disabled,
  className,
}: {
  bucket: Bucket
  kinds?: Kind[]
  maxFiles?: number
  upload: (file: File) => Promise<R>
  onUploaded?: (result: R, file: File) => void
  onRemove?: (item: UploadItem<R>) => void
  items?: UploadItem<R>[]
  label?: string
  hint?: string
  compact?: boolean
  disabled?: boolean
  className?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const [internal, setInternal] = React.useState<UploadItem<R>[]>([])
  const items = controlledItems ?? internal
  const rules = BUCKET_RULES[bucket]

  const start = async (files: File[]) => {
    const room = Math.max(0, maxFiles - items.filter((i) => i.status !== 'error').length)
    const batch = files.slice(0, room)
    for (const file of batch) {
      const id = crypto.randomUUID()
      const problem = validateFile(bucket, file, { kinds })
      if (problem) {
        setInternal((prev) => [...prev, { id, file, status: 'error', error: problem }])
        continue
      }
      setInternal((prev) => [...prev, { id, file, status: 'uploading' }])
      try {
        const result = await upload(file)
        setInternal((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'done', result } : i)))
        onUploaded?.(result, file)
      } catch (e) {
        setInternal((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'error', error: toAppError(e).message } : i)))
      }
    }
  }

  const onFiles = (list: FileList | null) => {
    if (!list || disabled) return
    void start(Array.from(list))
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = (item: UploadItem<R>) => {
    setInternal((prev) => prev.filter((i) => i.id !== item.id))
    onRemove?.(item)
  }

  const busy = items.some((i) => i.status === 'uploading')

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          onFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed text-center transition-colors',
          compact ? 'px-4 py-5' : 'px-6 py-9',
          dragging ? 'border-ink bg-brand-soft/60' : 'border-line-strong bg-subtle/50',
          disabled && 'opacity-60',
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card">
          {busy ? <Spinner className="size-5" /> : <UploadCloud className="size-5" />}
        </span>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{hint ?? `Up to ${formatBytes(rules.maxBytes)} per file · ${rules.ext.slice(0, 8).map((e) => e.toUpperCase()).join(', ')}`}</p>
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <Paperclip /> Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={acceptFor(bucket, kinds)}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => onFiles(e.target.files)}
          aria-label={label}
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                'flex items-center gap-3 rounded-control border px-3 py-2.5 text-sm',
                item.status === 'error' ? 'border-danger/30 bg-danger-soft/40' : 'border-line bg-surface',
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
                <FileIcon mime={item.file.type} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.file.name}</p>
                <p className={cn('text-xs', item.status === 'error' ? 'text-danger' : 'text-muted')}>
                  {item.status === 'error' ? item.error : item.status === 'uploading' ? 'Uploading…' : formatBytes(item.file.size)}
                </p>
              </div>
              {item.status === 'uploading' && <Spinner className="size-4 text-muted" />}
              {item.status === 'done' && <CheckCircle2 className="size-4 text-success" aria-label="Uploaded" />}
              {item.status !== 'uploading' && (
                <button type="button" onClick={() => remove(item)} className="focus-ring rounded-full p-1 text-faint hover:bg-subtle hover:text-ink" aria-label={`Remove ${item.file.name}`}>
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
