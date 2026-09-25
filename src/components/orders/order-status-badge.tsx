import { Badge, type BadgeTone } from '@/components/ui/badge'
import { ORDER_STATUS_META, type StatusTone } from '@/lib/order-state'
import type { OrderStatus } from '@/types'

const TONE: Record<StatusTone, BadgeTone> = {
  neutral: 'neutral',
  brand: 'brand',
  info: 'info',
  warning: 'warning',
  success: 'success',
  danger: 'danger',
  lilac: 'lilac',
}

export function OrderStatusBadge({ status, size = 'md' }: { status: OrderStatus; size?: 'sm' | 'md' | 'lg' }) {
  const meta = ORDER_STATUS_META[status]
  return (
    <Badge tone={TONE[meta.tone]} size={size} dot>
      {meta.label}
    </Badge>
  )
}
