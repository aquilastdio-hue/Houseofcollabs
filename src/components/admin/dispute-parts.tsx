import * as React from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, FileStack, MessagesSquare, RefreshCcw, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDateTime, formatINR, formatRelative, titleCase } from '@/lib/format'
import { useAuth } from '@/contexts/auth-context'
import { useOrder } from '@/hooks/use-orders'
import { addDisputeMessage } from '@/services/orders.service'
import { getDispute, updateDispute } from '@/services/admin.service'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { ErrorState } from '@/components/shared/states'
import type { DisputeStatus } from '@/types'
import { DISPUTE_STATUS_META, OPEN_DISPUTE_STATUSES, RoleBadge, StatusBadge } from './admin-status'
import { adminLists } from './admin-keys'
import { DetailCard, DetailItem, DetailList, SummaryRow } from './detail'
import { AttachmentList, OrderFileRow, readAttachments, useOrderFileUrls } from './order-files'
import { capturedTotal, refundedTotal } from './order-sections'
import { useAdminMutation } from './use-admin-mutation'

export type AdminDispute = NonNullable<Awaited<ReturnType<typeof getDispute>>>

export function isOpenDispute(status: DisputeStatus) {
  return OPEN_DISPUTE_STATUSES.includes(status)
}

const RESOLUTION_LABELS: Record<string, string> = {
  release_to_creator: 'Released to creator',
  resume_order: 'Order resumed',
  rejected: 'Dispute rejected',
  refund_brand: 'Full refund to brand',
  partial_refund: 'Partial refund',
}

export function DisputeInfoCard({ dispute: d }: { dispute: AdminDispute }) {
  const open = isOpenDispute(d.status)
  return (
    <DetailCard title="Dispute" description={`Raised ${formatRelative(d.created_at)} · ${formatDateTime(d.created_at)}`}>
      <p className="font-medium">{d.reason}</p>
      {d.description ? (
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-soft">{d.description}</p>
      ) : (
        <p className="mt-2 text-sm text-muted italic">No description provided.</p>
      )}
      <DetailList className="mt-5">
        <DetailItem label="Raised by">
          <RoleBadge role={d.raised_by_role} size="md" />
        </DetailItem>
        <DetailItem label="Status">
          <StatusBadge meta={DISPUTE_STATUS_META} value={d.status} size="sm" />
        </DetailItem>
        <DetailItem label="Order status before the dispute">
          <OrderStatusBadge status={d.previous_order_status} size="sm" />
        </DetailItem>
        <DetailItem label="Order status now">{d.order ? <OrderStatusBadge status={d.order.status} size="sm" /> : null}</DetailItem>
        {!open && (
          <>
            <DetailItem label="Outcome">{d.resolution_type ? RESOLUTION_LABELS[d.resolution_type] ?? titleCase(d.resolution_type) : null}</DetailItem>
            <DetailItem label="Closed">{d.resolved_at ? formatDateTime(d.resolved_at) : null}</DetailItem>
            {d.refund_amount != null && <DetailItem label="Refunded">{formatINR(d.refund_amount, { precise: true })}</DetailItem>}
            {d.resolution && (
              <DetailItem label="Resolution note" className="sm:col-span-2">
                <span className="whitespace-pre-line">{d.resolution}</span>
              </DetailItem>
            )}
          </>
        )}
      </DetailList>
    </DetailCard>
  )
}

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------
const replySchema = z.object({ body: z.string().trim().min(1, 'Write a message first').max(4000, 'Keep it under 4,000 characters') })

export function DisputeThread({ dispute: d }: { dispute: AdminDispute }) {
  const { user } = useAuth()
  const open = isOpenDispute(d.status)
  const messages = [...(d.dispute_messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const form = useForm<z.infer<typeof replySchema>>({ resolver: zodResolver(replySchema), defaultValues: { body: '' } })
  const send = useAdminMutation((body: string) => addDisputeMessage(d.id, body), {
    invalidate: [qk.admin.dispute(d.id)],
    success: 'Message sent to both parties',
    onSuccess: () => form.reset({ body: '' }),
  })
  const e = form.formState.errors

  const nameFor = (role: string, senderId: string | null) => {
    if (senderId && senderId === user?.id) return 'You'
    if (role === 'brand') return d.order?.brand?.brand_name ?? 'Brand'
    if (role === 'creator') return d.order?.creator?.display_name ?? 'Creator'
    if (role === 'admin') return 'House of Collabs team'
    return 'System'
  }
  const imageFor = (role: string) => (role === 'brand' ? d.order?.brand?.brand_logo_url : role === 'creator' ? d.order?.creator?.profile_image_url : null)

  return (
    <DetailCard title="Conversation" description="Messages here are visible to the brand, the creator and admins.">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-control border border-dashed border-line-strong px-4 py-8 text-center">
          <MessagesSquare className="size-5 text-faint" aria-hidden />
          <p className="text-sm text-muted">No messages yet.{open ? ' Ask both sides for their evidence to get started.' : ''}</p>
        </div>
      ) : (
        <ol className="space-y-4" aria-label="Dispute messages">
          {messages.map((m) => {
            const mine = !!m.sender_id && m.sender_id === user?.id
            const name = nameFor(m.sender_role, m.sender_id)
            return (
              <li key={m.id} className={cn('flex gap-3', mine && 'flex-row-reverse')}>
                <Avatar src={imageFor(m.sender_role)} name={name} size="sm" shape={m.sender_role === 'brand' ? 'rounded' : 'circle'} />
                <div className={cn('max-w-[85%] min-w-0 rounded-card px-4 py-3', mine || m.sender_role === 'admin' ? 'bg-ink text-white' : 'bg-subtle')}>
                  <p className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{name}</span>
                    <RoleBadge role={m.sender_role} />
                    <time dateTime={m.created_at} className={cn(mine || m.sender_role === 'admin' ? 'text-white/60' : 'text-faint')} title={formatDateTime(m.created_at)}>
                      {formatRelative(m.created_at)}
                    </time>
                  </p>
                  <p className="text-sm leading-relaxed break-words whitespace-pre-line">{m.body}</p>
                  <div className="text-ink">
                    <AttachmentList attachments={readAttachments(m.attachments)} />
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {open ? (
        <form onSubmit={form.handleSubmit((v) => send.mutate(v.body))} className="mt-6 border-t border-line pt-5" noValidate>
          <Field label="Reply as House of Collabs team" htmlFor="dispute-reply" error={e.body?.message} hint="Both parties are notified.">
            <Textarea id="dispute-reply" rows={3} maxLength={4000} placeholder="Ask for evidence, share next steps…" {...form.register('body')} />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button type="submit" size="sm" loading={send.isPending}>
              {!send.isPending && <Send />} Send message
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-6 border-t border-line pt-4 text-sm text-muted">This dispute is closed, so the conversation is read-only.</p>
      )}
    </DetailCard>
  )
}

// ---------------------------------------------------------------------------
// Status changer
// ---------------------------------------------------------------------------
const STATUS_TARGETS = ['under_review', 'waiting_for_brand', 'waiting_for_creator'] as const
const statusSchema = z.object({
  status: z.enum(STATUS_TARGETS, { message: 'Choose a status' }),
  note: z.string().trim().max(4000, 'Keep it under 4,000 characters'),
})
type StatusValues = z.infer<typeof statusSchema>

export function DisputeStatusCard({ dispute: d }: { dispute: AdminDispute }) {
  const initial = (STATUS_TARGETS as readonly string[]).includes(d.status) ? (d.status as StatusValues['status']) : 'under_review'
  const values = React.useMemo<StatusValues>(() => ({ status: initial, note: '' }), [initial])
  const form = useForm<StatusValues>({ resolver: zodResolver(statusSchema), values })
  const change = useAdminMutation((v: StatusValues) => updateDispute(d.id, v.status, v.note || undefined), {
    invalidate: [qk.admin.dispute(d.id), adminLists.disputes, qk.admin.stats],
    success: (_r, v) => `Dispute marked “${DISPUTE_STATUS_META[v.status].label.toLowerCase()}”`,
    onSuccess: () => form.reset({ status: form.getValues('status'), note: '' }),
  })
  const status = form.watch('status')
  const e = form.formState.errors

  return (
    <DetailCard title="Status" description="Tell both sides whose move it is.">
      <form onSubmit={form.handleSubmit((v) => change.mutate(v))} className="space-y-4" noValidate>
        <Field label="Set status to" htmlFor="dispute-status" error={e.status?.message}>
          <Select
            id="dispute-status"
            value={status}
            onValueChange={(v) => form.setValue('status', v as StatusValues['status'], { shouldDirty: true, shouldValidate: true })}
            options={STATUS_TARGETS.map((s) => ({ value: s, label: DISPUTE_STATUS_META[s].label }))}
          />
        </Field>
        <Field label="Note" htmlFor="dispute-status-note" optional error={e.note?.message} hint="Posted to the conversation for both parties.">
          <Textarea id="dispute-status-note" rows={3} maxLength={4000} placeholder="e.g. Please upload the unedited video file by Friday." {...form.register('note')} />
        </Field>
        <Button type="submit" variant="secondary" block loading={change.isPending} disabled={status === d.status && !form.watch('note').trim()}>
          {!change.isPending && <RefreshCcw />} Update status
        </Button>
      </form>
    </DetailCard>
  )
}

// ---------------------------------------------------------------------------
// Order + delivery summary
// ---------------------------------------------------------------------------
export function DisputeOrderCard({ dispute: d }: { dispute: AdminDispute }) {
  const o = d.order
  if (!o) {
    return (
      <DetailCard title="Order">
        <p className="text-sm text-muted">The order linked to this dispute is unavailable.</p>
      </DetailCard>
    )
  }
  return (
    <DetailCard
      title="Order"
      action={
        <Button asChild variant="secondary" size="xs">
          <Link to={`/admin/orders/${o.id}`}>
            Open order <ArrowRight />
          </Link>
        </Button>
      }
    >
      <p className="font-mono text-sm font-semibold">{o.order_number}</p>
      <p className="mt-0.5 text-sm text-ink-soft">{o.service_title}</p>
      <dl className="mt-3">
        <SummaryRow label="Order value" value={formatINR(o.total_amount)} />
        <SummaryRow label="Status" value={<OrderStatusBadge status={o.status} size="sm" />} />
      </dl>
      <div className="mt-4 space-y-3 border-t border-line pt-4">
        {o.brand && (
          <Link to={`/admin/brands/${o.brand.id}`} className="focus-ring flex items-center gap-3 rounded-control p-1 hover:bg-subtle">
            <Avatar src={o.brand.brand_logo_url} name={o.brand.brand_name} size="sm" shape="rounded" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{o.brand.brand_name}</span>
              <span className="block text-xs text-muted">Brand</span>
            </span>
          </Link>
        )}
        {o.creator && (
          <Link to={`/admin/creators/${o.creator.id}`} className="focus-ring flex items-center gap-3 rounded-control p-1 hover:bg-subtle">
            <Avatar src={o.creator.profile_image_url} name={o.creator.display_name} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{o.creator.display_name}</span>
              <span className="block text-xs text-muted">Creator</span>
            </span>
          </Link>
        )}
      </div>
    </DetailCard>
  )
}

/** Compact evidence: latest delivery round, revision requests and money on the order. */
export function DisputeEvidenceCard({ orderId }: { orderId: string }) {
  const order = useOrder(orderId)
  const deliverables = order.data?.order_deliverables ?? []
  const latestRound = deliverables.length ? Math.max(...deliverables.map((x) => x.round)) : 0
  const latest = deliverables.filter((x) => x.round === latestRound)
  const urls = useOrderFileUrls(latest.map((x) => x.storage_path))

  return (
    <DetailCard
      title="Delivery & money"
      description="Summary of what was delivered. Full details are on the order."
      action={<FileStack className="size-4 text-faint" aria-hidden />}
    >
      {order.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : order.isError ? (
        <ErrorState error={order.error} onRetry={() => void order.refetch()} compact />
      ) : !order.data ? (
        <p className="text-sm text-muted">Order details are unavailable.</p>
      ) : (
        <div className="space-y-4">
          <dl>
            <SummaryRow label="Captured" value={formatINR(capturedTotal(order.data.payments), { precise: true })} />
            <SummaryRow label="Refunded" value={formatINR(refundedTotal(order.data.payments), { precise: true })} />
            <SummaryRow label="Creator earning" value={formatINR(order.data.creator_earning_amount, { precise: true })} />
            <SummaryRow label="Revisions used" value={`${order.data.revisions_used} of ${order.data.revisions_allowed}`} />
          </dl>
          <div>
            <p className="mb-2 text-xs font-medium text-faint">
              {latestRound === 0 ? 'Deliveries' : latestRound === 1 ? 'Original delivery' : `Latest delivery (round ${latestRound})`}
              {latest[0] && ` · ${formatDateTime(latest[0].created_at)}`}
            </p>
            {latest.length === 0 ? (
              <p className="text-sm text-muted">Nothing has been delivered yet.</p>
            ) : (
              <ul className="space-y-2">
                {latest.map((x) =>
                  x.external_url ? (
                    <li key={x.id} className="truncate text-sm">
                      <a href={x.external_url} target="_blank" rel="noopener noreferrer" className="focus-ring rounded-sm underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
                        {x.file_name && x.file_name !== x.external_url ? x.file_name : x.external_url}
                      </a>
                    </li>
                  ) : x.storage_path ? (
                    <OrderFileRow
                      key={x.id}
                      path={x.storage_path}
                      name={x.file_name ?? x.storage_path.split('/').pop() ?? 'File'}
                      mime={x.mime_type}
                      size={x.size_bytes}
                      url={urls.data?.[x.storage_path]}
                      loading={urls.isLoading}
                    />
                  ) : null,
                )}
              </ul>
            )}
          </div>
          {order.data.order_revisions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-faint">Revision requests</p>
              <ul className="space-y-2">
                {[...order.data.order_revisions]
                  .sort((a, b) => b.revision_number - a.revision_number)
                  .slice(0, 3)
                  .map((r) => (
                    <li key={r.id} className="rounded-control bg-subtle px-3 py-2 text-sm">
                      <span className="font-medium">#{r.revision_number}</span> · {r.reason}
                      <span className="block text-xs text-faint">{formatDateTime(r.created_at)}</span>
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
