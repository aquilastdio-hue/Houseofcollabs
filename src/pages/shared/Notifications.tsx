import * as React from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNotificationActions, useNotifications, useUnreadCounts } from '@/hooks/use-notifications'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Seo } from '@/components/shared/seo'
import { NotificationItem } from '@/components/notifications/notification-list'

const PAGE_SIZE = 20

export default function Notifications({ perspective }: { perspective: 'brand' | 'creator' | 'admin' }) {
  const [tab, setTab] = React.useState<'all' | 'unread'>('all')
  const [page, setPage] = React.useState(1)
  const list = useNotifications({ unreadOnly: tab === 'unread', page, pageSize: PAGE_SIZE })
  const counts = useUnreadCounts()
  const { markAll } = useNotificationActions()
  const unread = counts.data?.notifications ?? 0

  return (
    <>
      <Seo title="Notifications" noindex />
      <PageHeader
        title="Notifications"
        description={
          perspective === 'creator'
            ? 'New orders, revision requests, payouts and messages — live.'
            : perspective === 'brand'
              ? 'Order updates, deliveries, payments and messages — live.'
              : 'Platform alerts that need your attention.'
        }
        actions={
          <Button variant="secondary" onClick={() => markAll.mutate()} loading={markAll.isPending} disabled={!unread}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as 'all' | 'unread')
          setPage(1)
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread{unread ? ` (${unread})` : ''}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-card border border-line bg-surface p-2 shadow-card">
        {list.isPending ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} className="m-2" />
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={<Bell />}
            title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="We’ll let you know when something needs your attention."
            className="border-0"
          />
        ) : (
          <div className="divide-y divide-line">
            {list.data.items.map((n) => (
              <NotificationItem key={n.id} n={n} showDelete />
            ))}
          </div>
        )}
      </div>
      {list.data && (
        <Pagination className="mt-4" page={page} pageSize={PAGE_SIZE} total={list.data.total} onPageChange={setPage} label="notifications" />
      )}
    </>
  )
}
