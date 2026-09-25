import { Link } from 'react-router'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatChatTime, formatNumber } from '@/lib/format'
import { useConversations } from '@/hooks/use-messages'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { DashboardPanel, PanelRowsSkeleton } from './dashboard-panel'

const LIMIT = 4

/** Latest conversations with unread counters (brand inbox preview). */
export function RecentMessagesPanel({ className }: { className?: string }) {
  const conversations = useConversations(false, '')
  const all = conversations.data ?? []
  const items = all.slice(0, LIMIT)
  const unread = all.reduce((sum, c) => sum + Number(c.unread_count || 0), 0)

  return (
    <DashboardPanel
      title="Recent messages"
      href="/brand/messages"
      className={className}
      badge={
        unread > 0 ? (
          <Badge tone="brand" size="sm">
            {formatNumber(unread)} unread
          </Badge>
        ) : undefined
      }
    >
      {conversations.isPending ? (
        <PanelRowsSkeleton rows={LIMIT} />
      ) : conversations.isError ? (
        <ErrorState compact error={conversations.error} onRetry={() => void conversations.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={<MessageSquare />}
          title="No messages yet"
          description="Message a creator from their profile to ask questions before you order."
          action={
            <Button asChild size="sm" variant="secondary">
              <Link to="/brand/creators">Find creators</Link>
            </Button>
          }
        />
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {items.map((c) => {
            const count = Number(c.unread_count || 0)
            return (
              <li key={c.id}>
                <Link
                  to={`/brand/messages/${c.id}`}
                  className="focus-ring flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-subtle"
                >
                  <Avatar src={c.counterpart_avatar_url} name={c.counterpart_name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm', count > 0 ? 'font-semibold' : 'font-medium')}>{c.counterpart_name || 'Creator'}</span>
                      {c.last_message_at && (
                        <time dateTime={c.last_message_at} className="shrink-0 text-xs text-faint">
                          {formatChatTime(c.last_message_at)}
                        </time>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn('truncate text-sm', count > 0 ? 'text-ink' : 'text-muted')}>
                        {c.last_message_preview || 'No messages yet'}
                      </span>
                      {count > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-pill bg-ink px-1.5 text-[0.6875rem] font-semibold text-brand">
                          <span aria-hidden>{count > 99 ? '99+' : count}</span>
                          <span className="sr-only">{`${count} unread`}</span>
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </DashboardPanel>
  )
}
