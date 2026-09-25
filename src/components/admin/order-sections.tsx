import * as React from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BadgeCheck, Check, ChevronDown, Circle, ExternalLink, FileText, Film, Gavel, Link2, Minus, Paperclip, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatDateTime, formatINR, formatLocation, formatPercent, formatRelative, titleCase } from '@/lib/format'
import { ADDON_TYPES, CONTENT_TYPES, labelFor } from '@/lib/constants'
import { buildTimeline, historyLabel } from '@/lib/order-state'
import { listPaymentRefunds } from '@/services/admin.service'
import type { OrderDetail } from '@/services/orders.service'
import { useSignedUrls } from '@/hooks/use-signed-url'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { RatingLabel, StarRating } from '@/components/shared/star-rating'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { DISPUTE_STATUS_META, PAYMENT_STATUS_META, REFUND_STATUS_META, REVIEW_STATUS_META, REVISION_STATUS_META, RoleBadge, StatusBadge } from './admin-status'
import { adminKeys } from './admin-keys'
import { asRecord, asNumber, asString, asStringList } from './admin-utils'
import { DetailCard, DetailItem, DetailList, ExternalAnchor, IdText, SummaryRow } from './detail'
import { JsonDialogButton, isEmptyJson } from './json-view'
import { AttachmentList, OrderFileRow, readAttachments, useOrderFileUrls } from './order-files'

const SETTLED = ['captured', 'partially_refunded', 'refunded'] as const

export function capturedTotal(payments: OrderDetail['payments']) {
  return payments.filter((p) => (SETTLED as readonly string[]).includes(p.status)).reduce((sum, p) => sum + Number(p.amount), 0)
}

export function refundedTotal(payments: OrderDetail['payments']) {
  return payments.reduce((sum, p) => sum + Number(p.refunded_amount ?? 0), 0)
}

/** Amount still refundable: captured minus refunded on captured / partly refunded payments. */
export function refundableAmount(payments: OrderDetail['payments']) {
  const total = payments
    .filter((p) => p.status === 'captured' || p.status === 'partially_refunded')
    .reduce((sum, p) => sum + Math.max(0, Number(p.amount) - Number(p.refunded_amount ?? 0)), 0)
  return Math.round(total * 100) / 100
}

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------
export function OrderParties({ order }: { order: OrderDetail }) {
  const b = order.brand
  const c = order.creator
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section className="rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="party-brand">
        <p id="party-brand" className="eyebrow mb-3 text-faint">
          Brand
        </p>
        {b ? (
          <>
            <div className="flex items-center gap-3">
              <Avatar src={b.brand_logo_url} name={b.brand_name} size="lg" shape="rounded" />
              <div className="min-w-0">
                <Link to={`/admin/brands/${b.id}`} className="focus-ring block truncate rounded-sm font-display text-lg font-semibold hover:underline">
                  {b.brand_name}
                </Link>
                <p className="truncate text-sm text-muted">{[b.industry, b.location].filter(Boolean).join(' · ') || `@${b.brand_slug}`}</p>
              </div>
            </div>
            <DetailList className="mt-4 sm:grid-cols-1">
              <DetailItem label="Contact">{[b.contact_email, b.contact_phone].filter(Boolean).join(' · ') || null}</DetailItem>
              {b.website_url && (
                <DetailItem label="Website">
                  <ExternalAnchor href={b.website_url}>{b.website_url.replace(/^https?:\/\//, '')}</ExternalAnchor>
                </DetailItem>
              )}
            </DetailList>
          </>
        ) : (
          <p className="text-sm text-muted">Brand record unavailable.</p>
        )}
      </section>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="party-creator">
        <p id="party-creator" className="eyebrow mb-3 text-faint">
          Creator
        </p>
        {c ? (
          <>
            <div className="flex items-center gap-3">
              <Avatar src={c.profile_image_url} name={c.display_name} size="lg" />
              <div className="min-w-0">
                <Link to={`/admin/creators/${c.id}`} className="focus-ring inline-flex max-w-full items-center gap-1 rounded-sm font-display text-lg font-semibold hover:underline">
                  <span className="truncate">{c.display_name}</span>
                  {c.verified && <BadgeCheck className="size-4 shrink-0 text-sky" aria-label="Verified" />}
                </Link>
                <p className="truncate text-sm text-muted">@{c.slug}</p>
              </div>
            </div>
            <DetailList className="mt-4 sm:grid-cols-1">
              <DetailItem label="Location">{formatLocation(c.city, c.state)}</DetailItem>
              <DetailItem label="Rating">
                <RatingLabel rating={Number(c.rating)} count={c.review_count} />
              </DetailItem>
            </DetailList>
          </>
        ) : (
          <p className="text-sm text-muted">Creator record unavailable.</p>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
export function OrderMoney({ order }: { order: OrderDetail }) {
  const captured = capturedTotal(order.payments)
  const refunded = refundedTotal(order.payments)
  return (
    <DetailCard title="Money" description="Amounts snapshotted at checkout.">
      <dl className="divide-y divide-line">
        <div className="pb-2">
          <SummaryRow label="Service" value={formatINR(order.subtotal)} />
          <SummaryRow label="Add-ons" value={formatINR(order.addons_total)} />
          <SummaryRow label="Order total" value={formatINR(order.total_amount)} strong />
        </div>
        <div className="py-2">
          <SummaryRow label={`Platform fee (${formatPercent(order.platform_fee_percent, 2)})`} value={`− ${formatINR(order.platform_fee_amount)}`} />
          <SummaryRow label="Creator earning" value={formatINR(order.creator_earning_amount)} strong />
        </div>
        <div className="pt-2">
          <SummaryRow label="Captured" value={formatINR(captured)} muted={captured === 0} />
          <SummaryRow label="Refunded" value={refunded > 0 ? `− ${formatINR(refunded)}` : formatINR(0)} muted={refunded === 0} />
        </div>
      </dl>
    </DetailCard>
  )
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export function OrderItemsCard({ order }: { order: OrderDetail }) {
  const items = [...order.order_items].sort((a, b) => (a.item_type === b.item_type ? a.created_at.localeCompare(b.created_at) : a.item_type === 'service' ? -1 : 1))
  return (
    <DetailCard
      title="Order items"
      description={`${labelFor(CONTENT_TYPES, order.content_type) || 'Content'} · ${order.delivery_days}-day delivery · ${order.revisions_used}/${order.revisions_allowed} revisions used`}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted">No line items were recorded for this order.</p>
      ) : (
        <ul className="divide-y divide-line rounded-control border border-line">
          {items.map((it) => {
            const meta = asRecord(it.metadata)
            const addonType = asString(meta.addon_type)
            return (
              <li key={it.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {it.name}
                    <Badge tone={it.item_type === 'service' ? 'dark' : 'neutral'} size="sm">
                      {it.item_type === 'service' ? 'Service' : addonType ? labelFor(ADDON_TYPES, addonType) : 'Add-on'}
                    </Badge>
                  </p>
                  {it.description && <p className="mt-0.5 text-xs text-muted">{it.description}</p>}
                </div>
                <p className="text-sm tabular-nums">
                  <span className="text-muted">
                    {it.quantity} × {formatINR(it.unit_price)}
                  </span>{' '}
                  <span className="ml-2 font-medium">{formatINR(it.total_price)}</span>
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </DetailCard>
  )
}

// ---------------------------------------------------------------------------
// Brief snapshot
// ---------------------------------------------------------------------------
const BRIEF_TEXT_FIELDS: { key: string; label: string }[] = [
  { key: 'campaign_objective', label: 'Objective' },
  { key: 'product_name', label: 'Product' },
  { key: 'product_description', label: 'Product description' },
  { key: 'target_audience', label: 'Target audience' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'tone', label: 'Tone' },
  { key: 'platform', label: 'Platform' },
  { key: 'usage_rights', label: 'Usage rights' },
]

function Collapsible({ summary, children, defaultOpen }: { summary: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-control border border-line" open={defaultOpen}>
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-control px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line px-4 py-4">{children}</div>
    </details>
  )
}

export function BriefSnapshotCard({ order }: { order: OrderDetail }) {
  const snap = asRecord(order.brief_snapshot)
  const hasSnapshot = !isEmptyJson(order.brief_snapshot)
  const attachments = order.brief?.brief_attachments ?? []
  const urls = useSignedUrls(
    'brief-attachments',
    attachments.map((a) => a.storage_path),
  )
  const title = asString(snap.title) ?? order.brief?.title ?? null
  const listField = (key: string, label: string) => {
    const list = asStringList(snap[key])
    return list.length ? (
      <DetailItem key={key} label={label} className="sm:col-span-2">
        <ul className="list-disc space-y-0.5 pl-4">
          {list.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </DetailItem>
    ) : null
  }

  return (
    <DetailCard
      title="Brief"
      description={hasSnapshot ? 'Snapshot of the brief at checkout — later edits don’t change it.' : 'Requirements the brand added at checkout.'}
      action={hasSnapshot ? <JsonDialogButton value={order.brief_snapshot} title="Brief snapshot" description="The brief exactly as it was when the order was placed." label="Raw" /> : undefined}
    >
      {!hasSnapshot && !order.requirements ? (
        <p className="text-sm text-muted">No brief or extra requirements were attached to this order.</p>
      ) : (
        <div className="space-y-3">
          {order.requirements && (
            <div className="rounded-control bg-subtle p-4">
              <p className="mb-1 text-xs font-medium text-faint">Checkout requirements</p>
              <p className="text-sm whitespace-pre-line text-ink-soft">{order.requirements}</p>
            </div>
          )}
          {hasSnapshot && (
            <Collapsible
              summary={
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate">{title ?? 'Untitled brief'}</span>
                </span>
              }
            >
              <DetailList>
                {BRIEF_TEXT_FIELDS.map((f) => {
                  const v = asString(snap[f.key])
                  return v ? (
                    <DetailItem key={f.key} label={f.label}>
                      <span className="whitespace-pre-line">{f.key === 'platform' ? titleCase(v) : v}</span>
                    </DetailItem>
                  ) : null
                })}
                {asString(snap.content_type) && <DetailItem label="Content type">{labelFor(CONTENT_TYPES, asString(snap.content_type))}</DetailItem>}
                {asNumber(snap.budget) !== null && <DetailItem label="Budget">{formatINR(asNumber(snap.budget))}</DetailItem>}
                {asString(snap.deadline) && <DetailItem label="Deadline">{formatDate(asString(snap.deadline))}</DetailItem>}
                {asString(snap.product_url) && (
                  <DetailItem label="Product page">
                    <ExternalAnchor href={asString(snap.product_url)!}>{asString(snap.product_url)}</ExternalAnchor>
                  </DetailItem>
                )}
                {listField('talking_points', 'Talking points')}
                {listField('do_not_say', 'Do not say')}
                {asStringList(snap.reference_links).length > 0 && (
                  <DetailItem label="References" className="sm:col-span-2">
                    <ul className="space-y-1">
                      {asStringList(snap.reference_links).map((l) => (
                        <li key={l}>{/^https?:\/\//i.test(l) ? <ExternalAnchor href={l}>{l}</ExternalAnchor> : l}</li>
                      ))}
                    </ul>
                  </DetailItem>
                )}
              </DetailList>
            </Collapsible>
          )}
          {attachments.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-faint">
                <Paperclip className="size-3.5" aria-hidden /> Brief attachments
              </p>
              <ul className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <li key={a.id}>
                    {urls.data?.[a.storage_path] ? (
                      <ExternalAnchor href={urls.data[a.storage_path]!} className="text-sm">
                        {a.file_name}
                      </ExternalAnchor>
                    ) : (
                      <span className="text-sm text-muted">{a.file_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </DetailCard>
  )
}

// ---------------------------------------------------------------------------
// Payments & refunds
// ---------------------------------------------------------------------------
function RefundsList({ orderId }: { orderId: string }) {
  const refunds = useQuery({ queryKey: adminKeys.refunds(orderId), queryFn: () => listPaymentRefunds(orderId) })
  if (refunds.isPending) return <Skeleton className="h-16 w-full" />
  if (refunds.isError) return <ErrorState error={refunds.error} onRetry={() => void refunds.refetch()} compact />
  if (refunds.data.length === 0) return <p className="text-sm text-muted">No refunds have been issued for this order.</p>
  return (
    <ul className="divide-y divide-line rounded-control border border-line">
      {refunds.data.map((r) => (
        <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {formatINR(r.amount)} <StatusBadge meta={REFUND_STATUS_META} value={r.status} size="sm" />
            </p>
            {r.reason && <p className="mt-0.5 text-muted">{r.reason}</p>}
            {r.provider_refund_id && <IdText value={r.provider_refund_id} className="mt-1" />}
          </div>
          <span className="text-xs text-faint" title={formatDateTime(r.created_at)}>
            {formatRelative(r.created_at)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function PaymentsCard({ order }: { order: OrderDetail }) {
  return (
    <DetailCard title="Payments & refunds" description="Razorpay attempts for this order, newest first.">
      {order.payments.length === 0 ? (
        <p className="text-sm text-muted">No payment has been attempted yet.</p>
      ) : (
        <ul className="space-y-3">
          {order.payments.map((p) => (
            <li key={p.id} className="rounded-control border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-semibold tabular-nums">{formatINR(p.amount)}</span>
                  <StatusBadge meta={PAYMENT_STATUS_META} value={p.status} size="sm" />
                </p>
                <span className="text-xs text-faint">{formatDateTime(p.created_at)}</span>
              </div>
              <DetailList className="mt-3">
                <DetailItem label="Method">{p.method ? titleCase(p.method) : null}</DetailItem>
                <DetailItem label="Captured">{p.captured_at ? formatDateTime(p.captured_at) : null}</DetailItem>
                <DetailItem label="Refunded">{Number(p.refunded_amount) > 0 ? formatINR(p.refunded_amount) : null}</DetailItem>
                <DetailItem label="Currency">{p.currency}</DetailItem>
                <DetailItem label="Provider order id">{p.provider_order_id ? <IdText value={p.provider_order_id} /> : null}</DetailItem>
                <DetailItem label="Provider payment id">{p.provider_payment_id ? <IdText value={p.provider_payment_id} /> : null}</DetailItem>
                {p.error_description && (
                  <DetailItem label="Error" className="sm:col-span-2">
                    <span className="text-danger">{p.error_description}</span>
                  </DetailItem>
                )}
              </DetailList>
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-6 mb-3 text-sm font-semibold">Refunds</h3>
      <RefundsList orderId={order.id} />
    </DetailCard>
  )
}

// ---------------------------------------------------------------------------
// Shipping
// ---------------------------------------------------------------------------
export function ShippingCard({ order }: { order: OrderDetail }) {
  const s = order.shipping_details
  if (!order.requires_shipping && !s) return null
  return (
    <DetailCard title="Shipping" description="Product the brand sends to the creator.">
      {!s ? (
        <p className="text-sm text-muted">No shipping details yet.</p>
      ) : (
        <DetailList>
          <DetailItem label="Recipient">{s.recipient_name}</DetailItem>
          <DetailItem label="Phone">{s.phone}</DetailItem>
          <DetailItem label="Address" className="sm:col-span-2">
            {s.address ? (
              <span className="whitespace-pre-line">
                {s.address}
                {'\n'}
                {[s.city, s.state, s.postal_code].filter(Boolean).join(', ')}
                {s.country ? `\n${s.country}` : ''}
              </span>
            ) : null}
          </DetailItem>
          <DetailItem label="Address added">{s.address_submitted_at ? formatDateTime(s.address_submitted_at) : null}</DetailItem>
          <DetailItem label="Courier">{s.courier}</DetailItem>
          <DetailItem label="Tracking number">{s.tracking_number ? <IdText value={s.tracking_number} /> : null}</DetailItem>
          <DetailItem label="Tracking link">{s.tracking_url ? <ExternalAnchor href={s.tracking_url}>Track shipment</ExternalAnchor> : null}</DetailItem>
          <DetailItem label="Shipped">{s.shipped_at ? formatDateTime(s.shipped_at) : null}</DetailItem>
          <DetailItem label="Received">{s.received_at ? formatDateTime(s.received_at) : null}</DetailItem>
          {s.notes && (
            <DetailItem label="Notes" className="sm:col-span-2">
              <span className="whitespace-pre-line">{s.notes}</span>
            </DetailItem>
          )}
        </DetailList>
      )}
    </DetailCard>
  )
}

// ---------------------------------------------------------------------------
// Deliverables & revisions
// ---------------------------------------------------------------------------
export function DeliverablesCard({ order }: { order: OrderDetail }) {
  const deliverables = order.order_deliverables
  const urls = useOrderFileUrls(deliverables.map((d) => d.storage_path))
  const rounds = [...new Set(deliverables.map((d) => d.round))].sort((a, b) => b - a)
  return (
    <DetailCard title="Deliverables" description={deliverables.length ? `${deliverables.length} item${deliverables.length === 1 ? '' : 's'} across ${rounds.length} round${rounds.length === 1 ? '' : 's'}.` : undefined}>
      {deliverables.length === 0 ? (
        <EmptyState compact icon={<Film />} title="Nothing delivered yet" description="Files and links the creator submits appear here." />
      ) : (
        <div className="space-y-6">
          {rounds.map((round, i) => {
            const items = deliverables.filter((d) => d.round === round)
            const revision = order.order_revisions.find((r) => r.id === items[0]?.revision_id)
            const note = items.find((d) => d.note)?.note
            return (
              <div key={round}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {round === 1 ? 'Original delivery' : `Revision ${revision?.revision_number ?? round - 1}`}
                    {i === 0 && (
                      <Badge tone="brand" size="sm">
                        Latest
                      </Badge>
                    )}
                  </p>
                  <span className="text-xs text-faint">{formatDateTime(items[0]?.created_at)}</span>
                </div>
                {note && <p className="mb-3 rounded-control bg-subtle p-3 text-sm whitespace-pre-line text-ink-soft">“{note}”</p>}
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {items.map((d) =>
                    d.external_url ? (
                      <li key={d.id} className="flex items-center gap-3 rounded-control border border-line bg-surface p-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-subtle text-muted">
                          <Link2 className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1 text-sm">
                          <ExternalAnchor href={d.external_url}>{d.file_name && d.file_name !== d.external_url ? d.file_name : d.external_url}</ExternalAnchor>
                          <p className="text-xs text-faint">External link</p>
                        </div>
                      </li>
                    ) : d.storage_path ? (
                      <OrderFileRow
                        key={d.id}
                        path={d.storage_path}
                        name={d.file_name ?? d.storage_path.split('/').pop() ?? 'File'}
                        mime={d.mime_type}
                        size={d.size_bytes}
                        url={urls.data?.[d.storage_path]}
                        loading={urls.isLoading}
                      />
                    ) : null,
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </DetailCard>
  )
}

export function RevisionsCard({ order }: { order: OrderDetail }) {
  const revisions = [...order.order_revisions].sort((a, b) => b.revision_number - a.revision_number)
  return (
    <DetailCard title="Revisions" description={`${order.revisions_used} of ${order.revisions_allowed} revision${order.revisions_allowed === 1 ? '' : 's'} used.`}>
      {revisions.length === 0 ? (
        <p className="text-sm text-muted">The brand hasn’t requested any revisions.</p>
      ) : (
        <ul className="space-y-3">
          {revisions.map((r) => (
            <li key={r.id} className="rounded-control border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  Revision #{r.revision_number} <StatusBadge meta={REVISION_STATUS_META} value={r.status} size="sm" />
                </p>
                <span className="text-xs text-faint">Requested {formatDateTime(r.created_at)}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{r.reason}</p>
              {r.instructions && <p className="mt-1 text-sm whitespace-pre-line text-muted">{r.instructions}</p>}
              <AttachmentList attachments={readAttachments(r.attachments)} />
              {(r.submitted_at || r.resolved_at) && (
                <p className="mt-2 text-xs text-muted">
                  {r.submitted_at && `Submitted ${formatDateTime(r.submitted_at)}`}
                  {r.submitted_at && r.resolved_at && ' · '}
                  {r.resolved_at && `Resolved ${formatDateTime(r.resolved_at)}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  )
}

// ---------------------------------------------------------------------------
// Timeline & history
// ---------------------------------------------------------------------------
export function TimelineCard({ order }: { order: OrderDetail }) {
  const steps = buildTimeline(order.status, order.order_status_history, order.requires_shipping)
  return (
    <DetailCard title="Progress">
      <ol aria-label="Order progress">
        {steps.map((s, i) => (
          <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className={cn('absolute top-7 bottom-0 left-[0.8125rem] w-px', s.state === 'done' ? 'bg-ink' : 'bg-line')} aria-hidden />}
            <span
              className={cn(
                'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2',
                s.state === 'done' && 'border-ink bg-ink text-brand',
                s.state === 'current' && 'border-ink bg-brand text-white',
                s.state === 'upcoming' && 'border-line-strong bg-surface text-faint',
                s.state === 'skipped' && 'border-line bg-subtle text-faint',
              )}
              aria-hidden
            >
              {s.state === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : s.state === 'skipped' ? <Minus className="size-3.5" /> : <Circle className="size-2.5 fill-current" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn('text-sm', s.state === 'upcoming' || s.state === 'skipped' ? 'text-muted' : 'font-medium')}>
                {s.label}
                <span className="sr-only"> — {s.state}</span>
              </p>
              {s.at && <p className="text-xs text-faint">{formatDateTime(s.at)}</p>}
            </div>
          </li>
        ))}
      </ol>
      {(order.status === 'cancelled' || order.status === 'refunded' || order.status === 'disputed') && (
        <div className="mt-4 flex items-center gap-2 rounded-control bg-subtle px-3 py-2 text-sm">
          Now: <OrderStatusBadge status={order.status} size="sm" />
        </div>
      )}
    </DetailCard>
  )
}

export function HistoryCard({ order }: { order: OrderDetail }) {
  const history = [...order.order_status_history].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <DetailCard title="Status history" description="Every status change with who made it and why.">
      {history.length === 0 ? (
        <p className="text-sm text-muted">No status changes recorded.</p>
      ) : (
        <ol className="space-y-0 divide-y divide-line">
          {history.map((h) => (
            <li key={h.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {historyLabel(h)}
                  <RoleBadge role={h.actor_role} />
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {h.old_status ? <OrderStatusBadge status={h.old_status} size="sm" /> : <span>New order</span>}
                  <ArrowRight className="size-3" aria-label="to" />
                  <OrderStatusBadge status={h.new_status} size="sm" />
                </p>
                {h.reason && <p className="mt-1.5 text-sm whitespace-pre-line text-ink-soft">{h.reason}</p>}
              </div>
              <time dateTime={h.created_at} className="shrink-0 text-xs text-faint" title={formatRelative(h.created_at)}>
                {formatDateTime(h.created_at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </DetailCard>
  )
}

// ---------------------------------------------------------------------------
// Disputes & reviews
// ---------------------------------------------------------------------------
export function DisputesCard({ order }: { order: OrderDetail }) {
  if (order.disputes.length === 0) return null
  const disputes = [...order.disputes].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <DetailCard title="Disputes">
      <ul className="space-y-3">
        {disputes.map((d) => (
          <li key={d.id} className="rounded-control border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <Gavel className="size-4 text-muted" aria-hidden />
                {d.reason}
                <StatusBadge meta={DISPUTE_STATUS_META} value={d.status} size="sm" />
              </p>
              <Button asChild variant="secondary" size="xs">
                <Link to={`/admin/disputes/${d.id}`}>
                  Open dispute <ExternalLink />
                </Link>
              </Button>
            </div>
            {d.description && <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line text-muted">{d.description}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-faint">
              Raised by <RoleBadge role={d.raised_by_role} /> {formatRelative(d.created_at)}
              {d.resolved_at && ` · closed ${formatDate(d.resolved_at)}`}
              {d.refund_amount != null && ` · refund ${formatINR(d.refund_amount)}`}
            </p>
          </li>
        ))}
      </ul>
    </DetailCard>
  )
}

export function ReviewsCard({ order }: { order: OrderDetail }) {
  if (order.reviews.length === 0) return null
  return (
    <DetailCard title="Reviews">
      <ul className="space-y-3">
        {order.reviews.map((r) => (
          <li key={r.id} className="rounded-control border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <StarRating value={r.rating} />
                <StatusBadge meta={REVIEW_STATUS_META} value={r.status} size="sm" />
              </span>
              <span className="flex items-center gap-1.5 text-xs text-faint">
                <Star className="size-3" aria-hidden /> by <RoleBadge role={r.reviewer_role} /> · {formatDate(r.created_at)}
              </span>
            </div>
            {r.comment ? <p className="mt-2 text-sm text-ink-soft">“{r.comment}”</p> : <p className="mt-2 text-sm text-muted italic">No written feedback.</p>}
            {r.response && (
              <p className="mt-2 rounded-control bg-subtle p-3 text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">Creator response</span>
                {r.response}
              </p>
            )}
          </li>
        ))}
      </ul>
    </DetailCard>
  )
}
