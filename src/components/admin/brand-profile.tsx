import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Package, ShieldCheck, UserX, Volume2 } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatDate, formatDateTime, formatRelative } from '@/lib/format'
import { listOrders, setUserStatus, type AdminBrandDetail } from '@/services/admin.service'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { ACCOUNT_STATUS_META, StatusBadge } from './admin-status'
import { adminLists } from './admin-keys'
import { DetailCard, DetailItem, DetailList, ExternalAnchor, IdText } from './detail'
import { orderColumns } from './order-table'
import { ordersHref } from './order-presets'
import { useAdminMutation } from './use-admin-mutation'

export function BrandIdentity({ brand: b }: { brand: AdminBrandDetail }) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <Avatar src={b.brand_logo_url} name={b.brand_name} size="xl" shape="rounded" />
      <div className="min-w-0">
        <h1 className="font-display text-display-sm font-semibold sm:text-display-md">{b.brand_name}</h1>
        <p className="mt-0.5 truncate text-sm text-muted">{[b.industry, b.location].filter(Boolean).join(' · ') || `@${b.brand_slug}`}</p>
        <div className="mt-2">{b.profile && <StatusBadge meta={ACCOUNT_STATUS_META} value={b.profile.status} />}</div>
      </div>
    </div>
  )
}

export function BrandDetailsCard({ brand: b }: { brand: AdminBrandDetail }) {
  return (
    <DetailCard title="Brand profile" description="What creators see when they work with this brand.">
      {b.description && <p className="mb-6 max-w-prose text-sm leading-relaxed whitespace-pre-line text-ink-soft">{b.description}</p>}
      <DetailList>
        <DetailItem label="Industry">{b.industry}</DetailItem>
        <DetailItem label="Location">{b.location}</DetailItem>
        <DetailItem label="Website">{b.website_url ? <ExternalAnchor href={b.website_url}>{b.website_url.replace(/^https?:\/\//, '')}</ExternalAnchor> : null}</DetailItem>
        <DetailItem label="Instagram">{b.instagram_url ? <ExternalAnchor href={b.instagram_url}>{b.instagram_url.replace(/^https?:\/\/(www\.)?/, '')}</ExternalAnchor> : null}</DetailItem>
        <DetailItem label="Pronunciation" className="sm:col-span-2">
          {b.brand_pronunciation || b.pronunciation_audio_url ? (
            <span className="flex flex-col gap-2">
              {b.brand_pronunciation && <span>“{b.brand_pronunciation}”</span>}
              {b.pronunciation_audio_url && (
                <span className="flex items-center gap-2">
                  <Volume2 className="size-4 shrink-0 text-muted" aria-hidden />
                  <audio controls preload="none" src={b.pronunciation_audio_url} className="h-9 w-full max-w-sm" aria-label={`How to pronounce ${b.brand_name}`} />
                </span>
              )}
            </span>
          ) : null}
        </DetailItem>
        <DetailItem label="Contact email">
          {b.contact_email ? (
            <a href={`mailto:${b.contact_email}`} className="focus-ring rounded-sm underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
              {b.contact_email}
            </a>
          ) : null}
        </DetailItem>
        <DetailItem label="Contact phone">{b.contact_phone ? <a href={`tel:${b.contact_phone.replace(/[^+\d]/g, '')}`} className="focus-ring rounded-sm hover:underline">{b.contact_phone}</a> : null}</DetailItem>
        <DetailItem label="Slug" mono>
          {b.brand_slug}
        </DetailItem>
        <DetailItem label="Profile updated">{formatDateTime(b.updated_at)}</DetailItem>
      </DetailList>
    </DetailCard>
  )
}

/** Login identity + suspend / reactivate (confirmed, with a reason). */
export function BrandAccountCard({ brand: b }: { brand: AdminBrandDetail }) {
  const p = b.profile
  const [pending, setPending] = React.useState<'suspend' | 'reactivate' | null>(null)
  const status = p?.status ?? 'active'

  const change = useAdminMutation(({ next, reason }: { next: 'suspended' | 'active'; reason: string }) => setUserStatus(b.profile_id, next, reason || undefined), {
    invalidate: [qk.admin.brand(b.id), adminLists.brands, qk.admin.stats],
    success: (_d, v) => (v.next === 'suspended' ? 'Brand account suspended' : 'Brand account reactivated'),
    onSuccess: () => setPending(null),
  })

  return (
    <DetailCard title="Account" description="Login identity behind this brand.">
      <DetailList className="sm:grid-cols-1">
        <DetailItem label="Login email">
          {p?.email ? (
            <a href={`mailto:${p.email}`} className="focus-ring rounded-sm underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
              {p.email}
            </a>
          ) : null}
        </DetailItem>
        <DetailItem label="Account holder">{p?.full_name}</DetailItem>
        <DetailItem label="Phone">{p?.phone}</DetailItem>
        <DetailItem label="Status">
          <StatusBadge meta={ACCOUNT_STATUS_META} value={status} size="sm" />
        </DetailItem>
        <DetailItem label="Last seen">{p?.last_seen_at ? <span title={formatDateTime(p.last_seen_at)}>{formatRelative(p.last_seen_at)}</span> : 'Never'}</DetailItem>
        <DetailItem label="Joined">{formatDate(b.created_at)}</DetailItem>
        <DetailItem label="Brand id">
          <IdText value={b.id} />
        </DetailItem>
      </DetailList>
      <div className="mt-5 border-t border-line pt-4">
        {status === 'active' ? (
          <Button variant="danger-ghost" size="sm" onClick={() => setPending('suspend')}>
            <UserX /> Suspend account
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setPending('reactivate')}>
            <ShieldCheck /> Reactivate account
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending === 'suspend' ? `Suspend ${b.brand_name}?` : `Reactivate ${b.brand_name}?`}
        description={
          pending === 'suspend'
            ? 'The brand can’t sign in to place orders, message creators or pay. Existing orders stay as they are.'
            : 'The brand can sign in and use their workspace again.'
        }
        confirmLabel={pending === 'suspend' ? 'Suspend account' : 'Reactivate account'}
        destructive={pending === 'suspend'}
        loading={change.isPending}
        reasonLabel={pending === 'suspend' ? 'Reason (sent to the brand)' : 'Internal note'}
        reasonPlaceholder={pending === 'suspend' ? 'e.g. Chargeback abuse on multiple orders.' : 'Optional context for the audit log.'}
        reasonRequired={pending === 'suspend'}
        onConfirm={(reason) => {
          if (pending) change.mutate({ next: pending === 'suspend' ? 'suspended' : 'active', reason })
        }}
      />
    </DetailCard>
  )
}

const RECENT_PAGE_SIZE = 10

/** Latest orders placed by the brand, linking into the admin order view. */
export function BrandRecentOrders({ brandId }: { brandId: string }) {
  const navigate = useNavigate()
  const [page, setPage] = React.useState(1)
  const params = { brandId, page, pageSize: RECENT_PAGE_SIZE }
  const query = useQuery({ queryKey: qk.admin.orders(params), queryFn: () => listOrders(params), placeholderData: keepPreviousData })

  return (
    <DetailCard
      title="Orders"
      description={query.data ? `${query.data.total} order${query.data.total === 1 ? '' : 's'} placed, newest first.` : 'Orders placed by this brand.'}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to={ordersHref({ brand: brandId })}>View all in Orders</Link>
        </Button>
      }
    >
      <DataTable
        columns={orderColumns(['number', 'creator', 'service', 'amount', 'payment', 'status', 'created'])}
        rows={query.data?.items}
        rowKey={(o) => o.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
        mobilePrimary="number"
        empty={<EmptyState compact icon={<Package />} title="No orders yet" description="This brand hasn’t checked out with any creator." />}
        pagination={query.data ? { page, pageSize: RECENT_PAGE_SIZE, total: query.data.total, onPageChange: setPage, label: 'orders' } : undefined}
      />
    </DetailCard>
  )
}
