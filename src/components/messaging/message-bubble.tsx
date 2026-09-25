import { AlertCircle, Check, CheckCheck, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'
import { format } from 'date-fns'
import type { Attachment } from '@/types'
import type { ChatMessage } from '@/hooks/use-messages'

export function MessageBubble({
  message,
  mine,
  urls,
  seen,
  onRetry,
}: {
  message: ChatMessage
  mine: boolean
  urls: Record<string, string>
  seen?: boolean
  onRetry?: () => void
}) {
  if (message.message_type === 'system') {
    return (
      <div className="my-3 flex justify-center">
        <p className="rounded-pill bg-subtle px-3 py-1 text-center text-xs text-muted">{message.body}</p>
      </div>
    )
  }
  const attachments = (message.attachments as unknown as Attachment[]) ?? []
  const deleted = !!message.deleted_at
  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-card px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[70%]',
          mine ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md border border-line bg-surface text-ink',
          message.failed && 'opacity-70 ring-2 ring-danger',
        )}
      >
        {deleted ? (
          <p className="italic opacity-70">This message was deleted</p>
        ) : (
          <>
            {attachments.length > 0 && (
              <div className={cn('mb-2 grid gap-2', attachments.length > 1 && 'grid-cols-2')}>
                {attachments.map((a) => {
                  const url = urls[a.path]
                  if (a.mime?.startsWith('image/') && url) {
                    return (
                      <a key={a.path} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-control">
                        <img src={url} alt={a.name} className="max-h-60 w-full object-cover" loading="lazy" />
                      </a>
                    )
                  }
                  return (
                    <a
                      key={a.path}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn('flex items-center gap-2 rounded-control px-2.5 py-2', mine ? 'bg-white/10 hover:bg-white/15' : 'bg-subtle hover:bg-muted-surface')}
                    >
                      <FileText className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      {a.size && <span className="shrink-0 text-xs opacity-70">{formatBytes(a.size)}</span>}
                    </a>
                  )
                })}
              </div>
            )}
            {message.body && <p className="break-words whitespace-pre-wrap">{message.body}</p>}
          </>
        )}
      </div>
      <div className="flex items-center gap-1 px-1 text-[0.6875rem] text-faint">
        <time dateTime={message.created_at}>{format(new Date(message.created_at), 'h:mm a')}</time>
        {mine &&
          (message.pending ? (
            <Loader2 className="size-3 animate-spin" aria-label="Sending" />
          ) : message.failed ? (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-0.5 font-medium text-danger">
              <AlertCircle className="size-3" /> Failed · Retry
            </button>
          ) : seen ? (
            <CheckCheck className="size-3.5 text-ink" aria-label="Seen" />
          ) : (
            <Check className="size-3.5" aria-label="Sent" />
          ))}
      </div>
    </div>
  )
}
