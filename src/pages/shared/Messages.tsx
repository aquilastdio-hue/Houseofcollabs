import * as React from 'react'
import { Link, useParams } from 'react-router'
import { MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useConversations } from '@/hooks/use-messages'
import { useDebounce } from '@/hooks/use-utils'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/states'
import { Seo } from '@/components/shared/seo'
import { ConversationList } from '@/components/messaging/conversation-list'
import { ChatWindow } from '@/components/messaging/chat-window'

export default function Messages({ perspective }: { perspective: 'brand' | 'creator' }) {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const [search, setSearch] = React.useState('')
  const [archived, setArchived] = React.useState(false)
  const debounced = useDebounce(search, 300)
  const list = useConversations(archived, debounced)
  const basePath = `/${perspective}/messages`

  return (
    <>
      <Seo title="Messages" noindex />
      <h1 className="sr-only">Messages</h1>
      <div
        className={cn(
          'overflow-hidden rounded-panel border border-line bg-surface shadow-card',
          perspective === 'brand'
            ? 'h-[calc(100dvh-var(--header-height)-8.5rem)] md:h-[calc(100dvh-var(--header-height)-4rem)]'
            : 'h-[calc(100dvh-var(--header-height)-3rem)] sm:h-[calc(100dvh-var(--header-height)-4rem)]',
        )}
      >
        <div className="grid grid-cols-1 h-full lg:grid-cols-[22rem_1fr]">
          <div className={cn('h-full min-h-0 border-line lg:border-r', conversationId ? 'hidden lg:block' : 'block')}>
            <ConversationList
              items={list.data}
              loading={list.isPending}
              error={list.isError ? list.error : null}
              onRetry={() => void list.refetch()}
              activeId={conversationId}
              basePath={basePath}
              currentUserId={user?.id}
              search={search}
              onSearch={setSearch}
              archived={archived}
              onArchivedChange={setArchived}
              empty={
                <EmptyState
                  compact
                  icon={<MessagesSquare />}
                  title={search ? 'No conversations found' : archived ? 'No archived conversations' : 'No messages yet'}
                  description={
                    perspective === 'brand'
                      ? 'Message a creator from their profile to start a conversation.'
                      : 'Brands will reach out here. A complete storefront gets more messages.'
                  }
                  action={
                    !search && !archived ? (
                      <Button asChild size="sm">
                        <Link to={perspective === 'brand' ? '/brand/creators' : '/creator/profile'}>{perspective === 'brand' ? 'Find creators' : 'Improve my profile'}</Link>
                      </Button>
                    ) : undefined
                  }
                  className="border-0 bg-transparent"
                />
              }
            />
          </div>
          <div className={cn('h-full min-h-0', conversationId ? 'block' : 'hidden lg:block')}>
            {conversationId && user ? (
              <ChatWindow key={conversationId} conversationId={conversationId} perspective={perspective} currentUserId={user.id} archived={archived} backHref={basePath} />
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <EmptyState
                  icon={<MessagesSquare />}
                  title="Select a conversation"
                  description="Messages update in real time. Keep all communication and payments on House of Collabs for protection."
                  className="border-0 bg-transparent"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
