import * as React from 'react'
import { toast } from 'sonner'
import { FileText, Loader2, Paperclip, SendHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { acceptFor, validateFile } from '@/lib/validation/files'
import { uploadMessageAttachment } from '@/services/messages.service'
import { Button } from '@/components/ui/button'
import type { Attachment } from '@/types'

type Pending = { id: string; file: File; status: 'uploading' | 'done' | 'error'; result?: Attachment; preview?: string }

export function Composer({
  conversationId,
  onSend,
  onTyping,
  disabled,
}: {
  conversationId: string
  onSend: (body: string, attachments: Attachment[]) => void
  onTyping?: () => void
  disabled?: boolean
}) {
  const [text, setText] = React.useState('')
  const [files, setFiles] = React.useState<Pending[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)
  const areaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [text])

  React.useEffect(
    () => () => {
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    for (const file of Array.from(list).slice(0, 10 - files.length)) {
      const problem = validateFile('message-attachments', file)
      if (problem) {
        toast.error(problem)
        continue
      }
      const id = crypto.randomUUID()
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      setFiles((prev) => [...prev, { id, file, status: 'uploading', preview }])
      try {
        const result = await uploadMessageAttachment(conversationId, file)
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'done', result } : f)))
      } catch (e) {
        toast.error(toAppError(e).message)
        setFiles((prev) => prev.filter((f) => f.id !== id))
      }
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const uploading = files.some((f) => f.status === 'uploading')
  const ready = files.filter((f) => f.status === 'done' && f.result).map((f) => f.result!)
  const canSend = !disabled && !uploading && (text.trim().length > 0 || ready.length > 0)

  const send = () => {
    if (!canSend) return
    onSend(text.trim(), ready)
    setText('')
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview))
    setFiles([])
    areaRef.current?.focus()
  }

  return (
    <div className="border-t border-line bg-surface p-3 sm:p-4">
      {files.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.id} className="relative flex items-center gap-2 rounded-control border border-line bg-subtle py-1.5 pr-8 pl-2 text-xs">
              {f.preview ? <img src={f.preview} alt="" className="size-8 rounded object-cover" /> : <FileText className="size-4" />}
              <span className="max-w-32 truncate">{f.file.name}</span>
              {f.status === 'uploading' && <Loader2 className="size-3.5 animate-spin" aria-label="Uploading" />}
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-0.5 text-muted hover:bg-muted-surface hover:text-ink"
                aria-label={`Remove ${f.file.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => inputRef.current?.click()} disabled={disabled || files.length >= 10} aria-label="Attach files">
          <Paperclip />
        </Button>
        <input ref={inputRef} type="file" multiple className="sr-only" tabIndex={-1} accept={acceptFor('message-attachments')} onChange={(e) => void addFiles(e.target.files)} aria-label="Attach files" />
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <textarea
          id="composer"
          ref={areaRef}
          rows={1}
          value={text}
          maxLength={5000}
          disabled={disabled}
          placeholder={disabled ? 'Messaging is unavailable' : 'Write a message…'}
          onChange={(e) => {
            setText(e.target.value)
            onTyping?.()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          className={cn(
            'max-h-44 min-h-10 flex-1 resize-none rounded-control border border-line bg-canvas px-3.5 py-2.5 text-sm leading-relaxed outline-none',
            'placeholder:text-faint focus-visible:border-ink focus-visible:shadow-glow',
          )}
        />
        <Button type="button" size="icon-sm" onClick={send} disabled={!canSend} aria-label="Send message">
          <SendHorizontal />
        </Button>
      </div>
      <p className="mt-1.5 hidden text-[0.6875rem] text-faint sm:block">Enter to send · Shift + Enter for a new line · Keep payments on House of Collabs</p>
    </div>
  )
}
