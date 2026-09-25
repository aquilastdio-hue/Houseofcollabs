import { formatDate, formatDateTime, formatINR, formatNumber, formatRelative } from '@/lib/format'
import type { Column } from '@/components/shared/data-table'
import type { AdminBrandRow } from '@/types'
import { ACCOUNT_STATUS_META, StatusBadge } from './admin-status'
import { IdentityCell } from './detail'

export const BRAND_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'spend', label: 'Spend' },
  { value: 'orders', label: 'Orders' },
  { value: 'activity', label: 'Recent activity' },
  { value: 'name', label: 'Name (A–Z)' },
] as const

export const brandColumns: Column<AdminBrandRow>[] = [
  {
    key: 'brand',
    header: 'Brand',
    cell: (b) => (
      <IdentityCell
        name={b.brand_name}
        subtitle={b.email ?? b.industry}
        image={b.brand_logo_url}
        shape="rounded"
        to={`/admin/brands/${b.id}`}
      />
    ),
  },
  {
    key: 'contact',
    header: 'Contact',
    cell: (b) =>
      b.contact_email || b.contact_phone ? (
        <div className="min-w-0 text-sm">
          {b.contact_email && <p className="truncate">{b.contact_email}</p>}
          {b.contact_phone && <p className="truncate text-xs text-muted">{b.contact_phone}</p>}
        </div>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  { key: 'orders', header: 'Orders', className: 'tabular-nums', cell: (b) => formatNumber(b.orders_count) },
  { key: 'spend', header: 'Spend', className: 'tabular-nums whitespace-nowrap', cell: (b) => formatINR(b.spend) },
  { key: 'status', header: 'Status', cell: (b) => <StatusBadge meta={ACCOUNT_STATUS_META} value={b.account_status} size="sm" /> },
  { key: 'joined', header: 'Joined', className: 'whitespace-nowrap text-muted', cell: (b) => formatDate(b.joined_at) },
  {
    key: 'activity',
    header: 'Last activity',
    className: 'whitespace-nowrap text-muted',
    cell: (b) => (b.last_activity_at ? <span title={formatDateTime(b.last_activity_at)}>{formatRelative(b.last_activity_at)}</span> : <span className="text-faint">Never</span>),
  },
]
