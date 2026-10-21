import * as React from 'react'
import { CheckCircle2, FileText, Film, ImageIcon, Paperclip, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'
import { toAppError } from '@/lib/errors'
import { acceptFor, BUCKET_RULES, type Bucket } from '@/lib/validation/files'
import { describeSaving, prepareUpload } from '@/lib/video-compression'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

type Kind = 'image' | 'video' | 'audio' | 'doc'

export type UploadItem<R> = {
  id: string
  file: File
  /** `queued` waits its turn; videos are `compressing` before they upload. */
  status: 'queued' | 'compressing' | 'uploading' | 'done' | 'error'
  /** Compression progress, 0–1, while `compressing`. */
  progress?: number
  /** "Compressed 212 MB → 31 MB (85% smaller)", once a compressed video is up. */
  note?: string
  error?: string
  result?: R
}

const isBusy = (status: UploadItem<unknown>['status']) => status === 'queued' || status === 'compressing' || status === 'uploading'

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <ImageIcon className="size-4" />
  if (mime.startsWith('video/')) return <Film className="size-4" />
  return <FileText className="size-4" />
}

/**
 * Drag-and-drop multi-file uploader. Validates MIME/extension against the
 * bucket rules, compresses videos in the browser where the bucket allows it
 * (see `prepareUpload`), checks the size, then calls `upload(file)` per file —
 * one at a time, so only one video is ever being encoded — and reports results.
 * `upload` receives the file as it will be stored: the compressed MP4 when
 * compression helped, the original otherwise.
 */
export function FileUploader<R>({
  bucket,
  kinds,
  maxFiles = 10,
  upload,
  onUploaded,
  onRemove,
  onBusyChange,
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
  /** True while any file is still waiting, compressing or uploading — use it to hold back a submit button. */
  onBusyChange?: (busy: boolean) => void
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
  const controllers = React.useRef(new Map<string, AbortController>())

  const patch = (id: string, next: Partial<UploadItem<R>>) => setInternal((prev) => prev.map((i) => (i.id === id ? { ...i, ...next } : i)))

  const start = async (files: File[]) => {
    const room = Math.max(0, maxFiles - items.filter((i) => i.status !== 'error').length)
    // Every file gets its controller up front, so cancelling one that is still
    // waiting its turn stops it too — not just the one being worked on.
    const batch = files.slice(0, room).map((file) => ({ id: crypto.randomUUID(), file, controller: new AbortController() }))
    for (const { id, controller } of batch) controllers.current.set(id, controller)
    setInternal((prev) => [...prev, ...batch.map(({ id, file }) => ({ id, file, status: 'queued' as const }))])
    for (const { id, file, controller } of batch) {
      if (controller.signal.aborted) {
        controllers.current.delete(id)
        continue
      }
      try {
        let shown = -1
        const prepared = await prepareUpload(bucket, file, {
          kinds,
          signal: controller.signal,
          onProgress: (fraction) => {
            // Encoders report many times a second; repaint on whole percents only.
            const pct = Math.floor(fraction * 100)
            if (pct !== shown) {
              shown = pct
              patch(id, { status: 'compressing', progress: fraction })
            }
          },
        })
        if (controller.signal.aborted) continue
        patch(id, { status: 'uploading', progress: undefined })
        const result = await upload(prepared.file)
        patch(id, { status: 'done', result, note: describeSaving(prepared) ?? undefined })
        onUploaded?.(result, prepared.file)
      } catch (e) {
        if (!controller.signal.aborted) patch(id, { status: 'error', progress: undefined, error: toAppError(e).message })
      } finally {
        controllers.current.delete(id)
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

  /** Stops a file that hasn't started uploading yet; one already uploading finishes first. */
  const cancel = (item: UploadItem<R>) => {
    controllers.current.get(item.id)?.abort()
    setInternal((prev) => prev.filter((i) => i.id !== item.id))
  }

  // Leaving the page mid-compression stops the encoder rather than letting it run on unseen.
  React.useEffect(() => {
    const running = controllers.current
    return () => running.forEach((c) => c.abort())
  }, [])

  const busy = items.some((i) => isBusy(i.status))
  React.useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

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
                  {item.status === 'error'
                    ? item.error
                    : item.status === 'queued'
                      ? 'Waiting…'
                      : item.status === 'compressing'
                        ? `Compressing… ${Math.floor((item.progress ?? 0) * 100)}%`
                        : item.status === 'uploading'
                          ? 'Uploading…'
                          : (item.note ?? formatBytes(item.file.size))}
                </p>
                {item.status === 'compressing' && (
                  <Progress value={(item.progress ?? 0) * 100} className="mt-1.5 h-1" aria-label={`Compressing ${item.file.name}`} />
                )}
              </div>
              {(item.status === 'uploading' || item.status === 'queued') && <Spinner className="size-4 text-muted" />}
              {item.status === 'done' && <CheckCircle2 className="size-4 text-success" aria-label="Uploaded" />}
              {(item.status === 'compressing' || item.status === 'queued') && (
                <button type="button" onClick={() => cancel(item)} className="focus-ring rounded-full p-1 text-faint hover:bg-subtle hover:text-ink" aria-label={`Cancel ${item.file.name}`}>
                  <X className="size-4" />
                </button>
              )}
              {(item.status === 'done' || item.status === 'error') && (
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
