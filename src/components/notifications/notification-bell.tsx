import * as React from 'react'
import { Link } from 'react-router'
import { Bell, CheckCheck } from 'lucide-react'
import { useNotificationActions, useNotifications, useUnreadCounts } from '@/hooks/use-notifications'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { NotificationItem } from './notification-list'

/** Bell + popover panel with the latest notifications (live via Realtime). */
export function NotificationBell({ allHref, className }: { allHref: string; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const counts = useUnreadCounts()
  const list = useNotifications({ page: 1, pageSize: 8 })
  const { markAll } = useNotificationActions()
  const unread = counts.data?.notifications ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className={className} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <span className="relative">
            <Bell />
            {unread > 0 && (
              <span className="absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-ink px-1 text-[0.625rem] font-semibold text-brand">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,24rem)] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-display font-semibold">Notifications</p>
          <Button variant="ghost" size="xs" disabled={!unread} loading={markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto p-2">
          {list.isPending ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} compact />
          ) : list.data.items.length === 0 ? (
            <EmptyState compact icon={<Bell />} title="You’re all caught up" description="Order updates, messages and payouts will show up here." className="border-0" />
          ) : (
            list.data.items.map((n) => <NotificationItem key={n.id} n={n} onNavigate={() => setOpen(false)} />)
          )}
        </div>
        <div className="border-t border-line p-2">
          <Button asChild variant="ghost" size="sm" block>
            <Link to={allHref} onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
