import { Link } from 'react-router'
import { BadgeCheck, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatChatTime } from '@/lib/format'
import { Avatar } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorState } from '@/components/shared/states'
import { isOnline } from '@/components/marketplace/creator-card'
import type { ConversationSummary } from '@/types'

export function ConversationList({
  items,
  loading,
  error,
  onRetry,
  activeId,
  basePath,
  currentUserId,
  search,
  onSearch,
  archived,
  onArchivedChange,
  empty,
}: {
  items: ConversationSummary[] | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  activeId?: string
  basePath: string
  currentUserId?: string
  search: string
  onSearch: (v: string) => void
  archived: boolean
  onArchivedChange: (v: boolean) => void
  empty: React.ReactNode
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-line p-4">
        <Input leftIcon={<Search />} inputSize="sm" placeholder="Search conversations" value={search} onChange={(e) => onSearch(e.target.value)} aria-label="Search conversations" />
        <Tabs value={archived ? 'archived' : 'inbox'} onValueChange={(v) => onArchivedChange(v === 'archived')}>
          <TabsList className="w-full">
            <TabsTrigger value="inbox" className="flex-1">
              Inbox
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex-1">
              Archived
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState compact error={error} onRetry={onRetry} className="m-2" />
        ) : !items?.length ? (
          <div className="p-2">{empty}</div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((c) => {
              const active = c.id === activeId
              const mine = c.last_message_sender_id === currentUserId
              return (
                <li key={c.id}>
                  <Link
                    to={`${basePath}/${c.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn('focus-ring flex items-center gap-3 rounded-control p-3 transition-colors', active ? 'bg-ink text-white' : 'hover:bg-subtle')}
                  >
                    <Avatar src={c.counterpart_avatar_url} name={c.counterpart_name} size="lg" online={isOnline(c.counterpart_last_seen_at)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('flex min-w-0 items-center gap-1 truncate text-sm', c.unread_count ? 'font-semibold' : 'font-medium')}>
                          <span className="truncate">{c.counterpart_name}</span>
                          {c.counterpart_verified && <BadgeCheck className={cn('size-3.5 shrink-0', active ? 'fill-brand text-ink' : 'fill-brand text-ink')} />}
                        </p>
                        <span className={cn('shrink-0 text-xs', active ? 'text-white/60' : 'text-faint')}>{formatChatTime(c.last_message_at ?? c.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('truncate text-sm', active ? 'text-white/70' : c.unread_count ? 'text-ink' : 'text-muted')}>
                          {c.last_message_preview ? `${mine ? 'You: ' : ''}${c.last_message_preview}` : 'Say hello 👋'}
                        </p>
                        {c.unread_count > 0 && (
                          <span className={cn('flex h-5 min-w-5 shrink-0 items-center justify-center rounded-pill px-1.5 text-[0.6875rem] font-bold', active ? 'bg-brand text-white' : 'bg-ink text-brand')}>
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
