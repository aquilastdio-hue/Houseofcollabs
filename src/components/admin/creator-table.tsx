import { BadgeCheck, Sparkles } from 'lucide-react'
import { CONTENT_TYPES, PRICE_COLUMN_TYPES, labelFor, servicePrice } from '@/lib/constants'
import { formatCompact, formatDate, formatINR, formatLocation, formatNumber, formatPercent } from '@/lib/format'
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
  { value: 'engagement', label: 'Engagement rate' },
  { value: 'reel_views', label: 'Avg. Reel views' },
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
    key: 'whatsapp',
    header: 'WhatsApp',
    className: 'whitespace-nowrap tabular-nums',
    cell: (c) => (c.whatsapp ? c.whatsapp : <span className="text-faint">—</span>),
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
  // From the weekly Instagram fetch, as on the creator's stats card. Empty until
  // the first fetch, and for private or missing accounts.
  {
    key: 'engagement',
    header: 'Engagement',
    className: 'tabular-nums',
    cell: (c) => (c.engagement_rate == null ? <span className="text-faint">—</span> : formatPercent(Number(c.engagement_rate), 2)),
  },
  {
    key: 'reel_views',
    header: 'Reel views',
    mobileLabel: 'Avg. Reel views',
    className: 'tabular-nums',
    cell: (c) => (c.avg_reel_views == null ? <span className="text-faint">—</span> : formatCompact(Number(c.avg_reel_views))),
  },
  // What a brand pays for each kind of service (on, not deleted); "—" when they don't offer it.
  ...PRICE_COLUMN_TYPES.map(
    (type): Column<AdminCreatorRow> => ({
      key: `price_${type}`,
      header: labelFor(CONTENT_TYPES, type),
      className: 'tabular-nums whitespace-nowrap',
      cell: (c) => {
        const price = servicePrice(c.service_prices, type)
        return price === null ? <span className="text-faint">—</span> : formatINR(price)
      },
    }),
  ),
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
  {
    // Beside "Joined", because both say how this creator arrived.
    key: 'referral',
    header: 'Referral',
    cell: (c) =>
      c.referral_code ? <span className="font-mono text-xs tracking-wide">{c.referral_code}</span> : <span className="text-faint">—</span>,
  },
  { key: 'joined', header: 'Joined', className: 'whitespace-nowrap text-muted', cell: (c) => formatDate(c.joined_at) },
]
