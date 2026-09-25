import { BadgeCheck, Sparkles } from 'lucide-react'
import { formatCompact, formatDate, formatINR, formatLocation, formatNumber } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { RatingLabel } from '@/components/shared/star-rating'
import type { Column } from '@/components/shared/data-table'
import type { AdminCreatorRow } from '@/types'
import { ACCOUNT_STATUS_META, CREATOR_STATUS_META, StatusBadge } from './admin-status'
import { IdentityCell } from './detail'

export const CREATOR_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'orders', label: 'Orders' },
  { value: 'followers', label: 'Followers' },
  { value: 'rating', label: 'Rating' },
  { value: 'name', label: 'Name (A–Z)' },
] as const

export const creatorColumns: Column<AdminCreatorRow>[] = [
  {
    key: 'name',
    header: 'Creator',
    cell: (c) => (
      <IdentityCell
        name={c.display_name}
        subtitle={c.email ?? c.slug}
        image={c.profile_image_url}
        to={`/admin/creators/${c.id}`}
        badge={c.verified ? <BadgeCheck className="size-4 shrink-0 text-sky" aria-label="Verified" /> : null}
      />
    ),
  },
  {
    key: 'category',
    header: 'Category',
    cell: (c) => {
      const cats = c.categories ?? []
      if (cats.length === 0) return <span className="text-faint">—</span>
      return (
        <span className="flex items-center gap-1.5">
          <span className="truncate">{cats[0]}</span>
          {cats.length > 1 && (
            <Badge size="sm" tone="neutral" title={cats.slice(1).join(', ')}>
              +{cats.length - 1}
            </Badge>
          )}
        </span>
      )
    },
  },
  { key: 'location', header: 'Location', cell: (c) => <span className="whitespace-nowrap">{formatLocation(c.city, c.state)}</span> },
  { key: 'followers', header: 'Followers', className: 'tabular-nums', cell: (c) => formatCompact(c.followers_count) },
  { key: 'orders', header: 'Orders', className: 'tabular-nums', cell: (c) => formatNumber(c.orders_count) },
  { key: 'revenue', header: 'Revenue', className: 'tabular-nums whitespace-nowrap', cell: (c) => formatINR(c.revenue) },
  { key: 'rating', header: 'Rating', cell: (c) => <RatingLabel rating={Number(c.rating ?? 0)} count={Number(c.review_count ?? 0)} /> },
  {
    key: 'status',
    header: 'Status',
    cell: (c) => (
      <span className="flex flex-wrap items-center gap-1">
        <StatusBadge meta={CREATOR_STATUS_META} value={c.status} size="sm" />
        {c.deleted_at && (
          <Badge tone="dark" size="sm">
            Removed
          </Badge>
        )}
        {c.account_status && c.account_status !== 'active' && <StatusBadge meta={ACCOUNT_STATUS_META} value={c.account_status} size="sm" dot={false} />}
      </span>
    ),
  },
  {
    key: 'verification',
    header: 'Badges',
    mobileLabel: 'Badges',
    cell: (c) =>
      c.verified || c.featured ? (
        <span className="flex flex-wrap items-center gap-1">
          {c.verified && (
            <Badge tone="sky" size="sm">
              <BadgeCheck /> Verified
            </Badge>
          )}
          {c.featured && (
            <Badge tone="brand-soft" size="sm">
              <Sparkles /> Featured
            </Badge>
          )}
        </span>
      ) : (
        <span className="text-xs text-faint">Unverified</span>
      ),
  },
  { key: 'joined', header: 'Joined', className: 'whitespace-nowrap text-muted', cell: (c) => formatDate(c.joined_at) },
]
