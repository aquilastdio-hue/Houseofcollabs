import * as React from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isSameDay, format, isToday, isYesterday } from 'date-fns'
import { Archive, ArchiveRestore, ArrowLeft, BadgeCheck, EllipsisVertical, ExternalLink, Flag, MessagesSquare } from 'lucide-react'
import { useConversation, useConversationPresence, useMessages } from '@/hooks/use-messages'
import { useSignedUrls } from '@/hooks/use-signed-url'
import { qk } from '@/lib/query-keys'
import { markConversationRead, setConversationArchived } from '@/services/messages.service'
import { createReport } from '@/services/support.service'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import type { Attachment } from '@/types'
import { MessageBubble } from './message-bubble'
import { Composer } from './composer'

function dayLabel(d: Date) {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, d MMMM')
}

export function ChatWindow({
  conversationId,
  perspective,
  currentUserId,
  archived,
  backHref,
}: {
  conversationId: string
  perspective: 'brand' | 'creator'
  currentUserId: string
  archived: boolean
  backHref: string
}) {
  const qc = useQueryClient()
  const conv = useConversation(conversationId)
  const chat = useMessages(conversationId, currentUserId)
  const { onlineIds, typingIds, notifyTyping } = useConversationPresence(conversationId, currentUserId)
  const [reportOpen, setReportOpen] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const stickToBottom = React.useRef(true)

  const attachmentPaths = React.useMemo(
    () => chat.messages.flatMap((m) => ((m.attachments as unknown as Attachment[]) ?? []).map((a) => a.path)).filter((p) => !p.startsWith('blob:')),
    [chat.messages],
  )
  const urls = useSignedUrls('message-attachments', attachmentPaths)

  // Mark read on open and when new messages arrive while viewing.
  const lastId = chat.messages[chat.messages.length - 1]?.id
  React.useEffect(() => {
    if (!conversationId) return
    void markConversationRead(conversationId).then(() => {
      void qc.invalidateQueries({ queryKey: qk.unreadCounts })
      void qc.invalidateQueries({ queryKey: qk.conversations.all })
    })
  }, [conversationId, lastId, qc])

  // Keep scrolled to the bottom unless the user scrolled up to read history.
  React.useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [chat.messages.length, conversationId])

  const archive = useMutation({
    mutationFn: (value: boolean) => setConversationArchived(conversationId, value),
    meta: { successMessage: archived ? 'Moved to inbox' : 'Conversation archived' },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.conversations.all }),
  })

  const c = conv.data
  const counterpart = c
    ? perspective === 'brand'
      ? { id: c.creator?.profile_id, name: c.creator?.display_name ?? 'Creator', image: c.creator?.profile_image_url, verified: c.creator?.verified, href: `/brand/creators/${c.creator_id}` }
      : { id: c.brand?.profile_id, name: c.brand?.brand_name ?? 'Brand', image: c.brand?.brand_logo_url, verified: false, href: undefined }
    : null
  const counterpartParticipant = c?.conversation_participants.find((p) => p.profile_id === counterpart?.id)
  const online = !!counterpart?.id && onlineIds.includes(counterpart.id)
  const typing = !!counterpart?.id && typingIds.includes(counterpart.id)
  const lastMine = [...chat.messages].reverse().find((m) => m.sender_id === currentUserId && !m.pending)

  if (conv.isError) return <ErrorState error={conv.error} onRetry={() => void conv.refetch()} className="m-4" />
  if (!conv.isPending && !c) {
    return <EmptyState icon={<MessagesSquare />} title="Conversation not found" description="It may have been removed." className="m-4" />
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-5">
        <Button asChild variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back to conversations">
          <Link to={backHref}>
            <ArrowLeft />
          </Link>
        </Button>
        {conv.isPending || !counterpart ? (
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <>
            <Avatar src={counterpart.image} name={counterpart.name} size="md" online={online} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate font-medium">
                {counterpart.name}
                {counterpart.verified && <BadgeCheck className="size-4 fill-brand text-ink" aria-label="Verified" />}
              </p>
              <p className="text-xs text-muted" aria-live="polite">
                {typing ? 'typing…' : online ? 'Online now' : 'Offline'}
              </p>
            </div>
            {counterpart.href && (
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to={counterpart.href}>
                  View profile <ExternalLink />
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Conversation options">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => archive.mutate(!archived)}>
                  {archived ? <ArchiveRestore /> : <Archive />} {archived ? 'Move to inbox' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => setReportOpen(true)}>
                  <Flag /> Report conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}
        className="min-h-0 flex-1 overflow-y-auto bg-canvas px-3 py-4 sm:px-6"
        aria-live="polite"
        aria-label="Messages"
      >
        {chat.hasNextPage && (
          <div className="mb-4 flex justify-center">
            <Button
              variant="secondary"
              size="xs"
              loading={chat.isFetchingNextPage}
              onClick={() => {
                stickToBottom.current = false
                void chat.fetchNextPage()
              }}
            >
              Load earlier messages
            </Button>
          </div>
        )}
        {chat.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-16 w-3/5" />
          </div>
        ) : chat.isError ? (
          <ErrorState compact error={chat.error} onRetry={() => void chat.refetch()} />
        ) : chat.messages.length === 0 ? (
          <EmptyState
            compact
            icon={<MessagesSquare />}
            title="No messages yet"
            description={perspective === 'brand' ? 'Introduce your brand and what you’re looking for.' : 'Say hello and ask anything about the brief.'}
            className="mt-10 border-0 bg-transparent"
          />
        ) : (
          <div className="space-y-2.5">
            {chat.messages.map((m, i) => {
              const d = new Date(m.created_at)
              const prev = chat.messages[i - 1]
              const newDay = !prev || !isSameDay(new Date(prev.created_at), d)
              const seen =
                m.id === lastMine?.id && !!counterpartParticipant?.last_read_at && counterpartParticipant.last_read_at >= m.created_at
              return (
                <React.Fragment key={m.id}>
                  {newDay && (
                    <div className="my-4 flex items-center gap-3 text-xs text-faint" role="separator">
                      <span className="h-px flex-1 bg-line" />
                      {dayLabel(d)}
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  )}
                  <MessageBubble message={m} mine={m.sender_id === currentUserId} urls={urls.data ?? {}} seen={seen} onRetry={() => chat.retry(m)} />
                </React.Fragment>
              )
            })}
          </div>
        )}
      </div>

      <Composer
        conversationId={conversationId}
        onTyping={notifyTyping}
        onSend={(body, attachments) => {
          stickToBottom.current = true
          chat.sendText(body, attachments)
        }}
      />

      <ConfirmDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        title="Report this conversation"
        description="Tell us what’s wrong. Our team reviews every report. Never share payment details or move payments off House of Collabs."
        reasonLabel="What happened?"
        confirmLabel="Send report"
        destructive
        onConfirm={async (reason) => {
          const lastTheirs = [...chat.messages].reverse().find((m) => m.sender_id !== currentUserId && m.message_type !== 'system')
          if (!lastTheirs) {
            setReportOpen(false)
            return
          }
          await createReport('message', lastTheirs.id, 'Conversation reported', reason)
          setReportOpen(false)
        }}
      />
    </div>
  )
}
