import { useNavigate } from 'react-router'
import {
  Bell,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  MessageSquare,
  Package,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/format'
import { useNotificationActions } from '@/hooks/use-notifications'
import type { Notification } from '@/types'

function iconFor(type: string) {
  if (type === 'message') return MessageSquare
  if (type.startsWith('payout') || type === 'earnings_available') return Wallet
  if (type.startsWith('payment') || type.startsWith('refund')) return CircleDollarSign
  if (type.startsWith('shipment')) return Truck
  if (type.startsWith('revision')) return RefreshCcw
  if (type.startsWith('review')) return Star
  if (type.startsWith('brief')) return FileText
  if (type.startsWith('report') || type.includes('suspended')) return ShieldAlert
  if (type.includes('verified') || type.includes('approved') || type === 'order_completed') return CheckCircle2
  if (type === 'announcement') return Sparkles
  if (type.startsWith('order') || type === 'content_delivered') return Package
  return Bell
}

export function NotificationItem({ n, onNavigate, showDelete }: { n: Notification; onNavigate?: () => void; showDelete?: boolean }) {
  const navigate = useNavigate()
  const { markRead, remove } = useNotificationActions()
  const Icon = iconFor(n.type)
  return (
    <div className={cn('group relative flex gap-3 rounded-control p-3 transition-colors hover:bg-subtle', !n.read && 'bg-brand-soft/40')}>
      <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', n.read ? 'bg-subtle text-muted' : 'bg-ink text-brand')}>
        <Icon className="size-4" />
      </span>
      <button
        type="button"
        className="min-w-0 flex-1 text-left focus-visible:outline-none"
        onClick={() => {
          if (!n.read) markRead.mutate(n.id)
          if (n.action_url) navigate(n.action_url)
          onNavigate?.()
        }}
      >
        <p className={cn('text-sm', n.read ? 'text-ink-soft' : 'font-medium text-ink')}>{n.title}</p>
        {n.message && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.message}</p>}
        <p className="mt-1 text-xs text-faint">{formatRelative(n.created_at)}</p>
      </button>
      {!n.read && <span className="absolute top-4 right-3 size-2 rounded-full bg-ink group-hover:hidden" aria-label="Unread" />}
      {showDelete && (
        <button
          type="button"
          onClick={() => remove.mutate(n.id)}
          className="focus-ring hidden size-8 shrink-0 items-center justify-center rounded-full text-faint hover:bg-danger-soft hover:text-danger group-hover:flex focus-visible:flex"
          aria-label="Delete notification"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}
