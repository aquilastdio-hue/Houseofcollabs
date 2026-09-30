import * as React from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, CalendarClock, ExternalLink, Package, Volume2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useOrder } from '@/hooks/use-orders'
import { qk } from '@/lib/query-keys'
import { formatDate, formatDateTime, formatDays, formatINR } from '@/lib/format'
import { isOverdue } from '@/lib/order-state'
import { submitReview } from '@/services/orders.service'
import { respondToReview } from '@/services/creators.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { ReviewCard } from '@/components/shared/review-card'
import { Seo } from '@/components/shared/seo'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { OrderActions } from '@/components/orders/order-actions'
import { OrderActivity, OrderTimeline } from '@/components/orders/order-timeline'
import { BriefPanel } from '@/components/orders/brief-panel'
import { DeliverablesList, RevisionsList } from '@/components/orders/deliverables-list'
import { DisputePanel } from '@/components/orders/dispute-panel'
import { ReviewForm } from '@/components/orders/order-dialogs'
import type { Review } from '@/types'

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Line({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? 'font-display text-lg font-semibold tabular-nums' : 'tabular-nums'}>{value}</span>
    </div>
  )
}

function RespondToReview({ review, orderId }: { review: Review; orderId: string }) {
  const qc = useQueryClient()
  const [text, setText] = React.useState('')
  const m = useMutation({
    mutationFn: () => respondToReview(review.id, text.trim()),
    meta: { successMessage: 'Response posted' },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orders.detail(orderId) }),
  })
  if (review.response) return null
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) m.mutate()
      }}
    >
      <Textarea rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Thank the brand or add context (public)" aria-label="Respond to review" />
      <Button type="submit" size="sm" variant="secondary" className="self-end" loading={m.isPending} disabled={!text.trim()}>
        Post response
      </Button>
    </form>
  )
}

export default function OrderDetail({ perspective }: { perspective: 'brand' | 'creator' }) {
  const { id } = useParams()
  const qc = useQueryClient()
  const { user } = useAuth()
  const query = useOrder(id)

  const review = useMutation({
    mutationFn: (v: { rating: number; comment: string }) => submitReview(id!, v.rating, v.comment),
    meta: { successMessage: 'Thanks for your review!' },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.orders.detail(id!) })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const order = query.data
  if (!order) {
    return (
      <EmptyState
        icon={<Package />}
        title="Order not found"
        description="It may belong to another account, or it hasn’t been paid yet."
        action={
          <Button asChild>
            <Link to={`/${perspective}/orders`}>Back to orders</Link>
          </Button>
        }
      />
    )
  }

  const shipping = Array.isArray(order.shipping_details) ? order.shipping_details[0] : order.shipping_details
  const counterpart =
    perspective === 'brand'
      ? { name: order.creator?.display_name ?? 'Creator', image: order.creator?.profile_image_url, href: `/brand/creators/${order.creator_id}`, verified: order.creator?.verified }
      : { name: order.brand?.brand_name ?? 'Brand', image: order.brand?.brand_logo_url, href: order.brand?.website_url ?? undefined, verified: false }
  const myReview = order.reviews.find((r) => r.reviewer_id === user?.id)
  const brandReview = order.reviews.find((r) => r.reviewer_role === 'brand')
  const creatorReview = order.reviews.find((r) => r.reviewer_role === 'creator')
  const dispute = [...order.disputes].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  const payment = order.payments[0]
  const addons = order.order_items.filter((i) => i.item_type === 'addon')
  const overdue = isOverdue(order.due_at, order.status)
  const briefAttachments = order.brief?.brief_attachments ?? []

  return (
    <>
      <Seo title={`Order ${order.order_number}`} noindex />
      <Breadcrumb items={[{ label: 'Orders', href: `/${perspective}/orders` }, { label: order.order_number }]} />

      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} size="lg" />
            <span className="font-mono text-sm text-muted">{order.order_number}</span>
            {order.requires_shipping && (
              <Badge tone="outline">
                <Package /> Physical product
              </Badge>
            )}
          </div>
          <h1 className="mt-2 font-display text-display-md font-semibold">{order.service_title}</h1>
          <p className="mt-1 text-sm text-muted">
            Placed {formatDate(order.created_at)}
            {order.due_at && !['completed', 'cancelled', 'refunded'].includes(order.status) && (
              <span className={overdue ? 'font-medium text-danger' : undefined}>
                {' '}
                · <CalendarClock className="inline size-3.5 align-[-2px]" /> {overdue ? 'Overdue since' : 'Due'} {formatDate(order.due_at)}
              </span>
            )}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <OrderActions order={order} perspective={perspective} />

          {order.status === 'completed' && (
            <Card title="Reviews">
              <div className="space-y-4">
                {perspective === 'brand' && !myReview && <ReviewForm subject={counterpart.name} loading={review.isPending} onSubmit={(rating, comment) => review.mutate({ rating, comment })} />}
                {perspective === 'creator' && !myReview && (
                  <details className="rounded-control border border-line p-4">
                    <summary className="cursor-pointer text-sm font-medium">Rate this brand (optional)</summary>
                    <div className="mt-4">
                      <ReviewForm subject={counterpart.name} loading={review.isPending} onSubmit={(rating, comment) => review.mutate({ rating, comment })} />
                    </div>
                  </details>
                )}
                {brandReview && (
                  <div>
                    <ReviewCard
                      rating={brandReview.rating}
                      comment={brandReview.comment}
                      authorName={order.brand?.brand_name ?? 'Brand'}
                      authorImage={order.brand?.brand_logo_url}
                      subtitle="Brand’s review"
                      date={brandReview.created_at}
                      response={brandReview.response}
                      responderName={order.creator?.display_name}
                    />
                    {perspective === 'creator' && <RespondToReview review={brandReview} orderId={order.id} />}
                  </div>
                )}
                {creatorReview && (
                  <ReviewCard
                    rating={creatorReview.rating}
                    comment={creatorReview.comment}
                    authorName={order.creator?.display_name ?? 'Creator'}
                    authorImage={order.creator?.profile_image_url}
                    subtitle="Creator’s review of the brand"
                    date={creatorReview.created_at}
                  />
                )}
              </div>
            </Card>
          )}

          <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
            <Tabs defaultValue={['delivered', 'revision_submitted', 'completed'].includes(order.status) ? 'deliverables' : dispute && order.status === 'disputed' ? 'dispute' : 'brief'}>
              <TabsList variant="underline">
                <TabsTrigger value="brief">Brief</TabsTrigger>
                <TabsTrigger value="deliverables">Deliverables ({order.order_deliverables.length})</TabsTrigger>
                <TabsTrigger value="revisions">
                  Revisions ({order.revisions_used}/{order.revisions_allowed})
                </TabsTrigger>
                {dispute && <TabsTrigger value="dispute">Dispute</TabsTrigger>}
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="brief" className="pt-5">
                <BriefPanel snapshot={order.brief_snapshot} requirements={order.requirements} attachments={briefAttachments} />
              </TabsContent>
              <TabsContent value="deliverables" className="pt-5">
                <DeliverablesList deliverables={order.order_deliverables} revisions={order.order_revisions} />
              </TabsContent>
              <TabsContent value="revisions" className="pt-5">
                {order.order_revisions.length === 0 ? (
                  <p className="text-sm text-muted">
                    No revisions requested. This order includes {order.revisions_allowed} revision{order.revisions_allowed === 1 ? '' : 's'}.
                  </p>
                ) : (
                  <RevisionsList revisions={order.order_revisions} revisionsAllowed={order.revisions_allowed} />
                )}
              </TabsContent>
              {dispute && (
                <TabsContent value="dispute" className="pt-5">
                  <DisputePanel dispute={dispute} perspective={perspective} />
                </TabsContent>
              )}
              <TabsContent value="activity" className="pt-5">
                <OrderActivity history={order.order_status_history} />
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <aside className="space-y-6">
          <Card title={perspective === 'brand' ? 'Creator' : 'Brand'}>
            <div className="flex items-center gap-3">
              <Avatar src={counterpart.image} name={counterpart.name} size="lg" shape="rounded" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate font-medium">
                  {counterpart.name}
                  {counterpart.verified && <BadgeCheck className="size-4 fill-brand text-ink" aria-label="Verified" />}
                </p>
                {perspective === 'brand' && order.creator && (
                  <Link to={counterpart.href!} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
                    View profile
                  </Link>
                )}
                {perspective === 'creator' && order.brand?.industry && <p className="text-sm text-muted">{order.brand.industry}</p>}
              </div>
            </div>
            {perspective === 'creator' && order.brand && (order.brand.brand_pronunciation || order.brand.pronunciation_audio_url) && (
              <div className="mt-4 rounded-control bg-subtle p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Volume2 className="size-3.5" /> How to say the brand name
                </p>
                {order.brand.brand_pronunciation && <p className="mt-1 font-medium">“{order.brand.brand_pronunciation}”</p>}
                {order.brand.pronunciation_audio_url && <audio controls src={order.brand.pronunciation_audio_url} className="mt-2 h-9 w-full" aria-label="Brand pronunciation" />}
              </div>
            )}
            {perspective === 'creator' && order.brand && (order.brand.website_url || order.brand.instagram_url) && (
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {order.brand.website_url && (
                  <a href={order.brand.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                    Website <ExternalLink className="size-3" />
                  </a>
                )}
                {order.brand.instagram_url && (
                  <a href={order.brand.instagram_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                    Instagram <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            )}
          </Card>

          <Card title="Summary">
            <div className="space-y-2.5">
              <Line label={order.service_title} value={formatINR(order.subtotal)} />
              {addons.map((a) => (
                <Line key={a.id} label={`+ ${a.name}`} value={formatINR(a.total_price)} />
              ))}
              {perspective === 'brand' ? (
                <div className="border-t border-line pt-2.5">
                  <Line label="Total" value={formatINR(order.total_amount)} strong />
                </div>
              ) : (
                <div className="space-y-2.5 border-t border-line pt-2.5">
                  <Line label="Order total" value={formatINR(order.total_amount)} />
                  <Line label={`Platform fee (${Number(order.platform_fee_percent)}%)`} value={`− ${formatINR(order.platform_fee_amount)}`} />
                  <Line label="You earn" value={formatINR(order.creator_earning_amount)} strong />
                </div>
              )}
              <div className="space-y-2.5 border-t border-line pt-2.5">
                <Line label="Delivery time" value={formatDays(order.delivery_days)} />
                <Line label="Revisions" value={`${order.revisions_used} of ${order.revisions_allowed} used`} />
                {order.accepted_at && <Line label="Accepted" value={formatDate(order.accepted_at)} />}
                {order.completed_at && <Line label="Completed" value={formatDate(order.completed_at)} />}
              </div>
            </div>
          </Card>

          {order.requires_shipping && (
            <Card title="Shipping">
              {shipping?.address ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-medium text-faint">Ship to</p>
                    <p className="mt-0.5 font-medium">{shipping.recipient_name}</p>
                    <p className="whitespace-pre-wrap text-ink-soft">{shipping.address}</p>
                    <p className="text-ink-soft">
                      {[shipping.city, shipping.state, shipping.postal_code].filter(Boolean).join(', ')}
                    </p>
                    {shipping.phone && <p className="text-ink-soft">{shipping.phone}</p>}
                  </div>
                  {shipping.tracking_number && (
                    <div>
                      <p className="text-xs font-medium text-faint">Tracking</p>
                      <p className="mt-0.5">
                        {shipping.courier} · <span className="font-mono">{shipping.tracking_number}</span>
                      </p>
                      {shipping.tracking_url && (
                        <a href={shipping.tracking_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                          Track package <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  )}
                  {shipping.shipped_at && <Line label="Shipped" value={formatDateTime(shipping.shipped_at)} />}
                  {shipping.received_at && <Line label="Received" value={formatDateTime(shipping.received_at)} />}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {perspective === 'brand' ? 'The creator shares their delivery address when they accept.' : 'You’ll add your delivery address when you accept.'}
                </p>
              )}
            </Card>
          )}

          {perspective === 'brand' && (
            <Card title="Payment">
              {payment ? (
                <div className="space-y-2.5">
                  <Line
                    label="Status"
                    value={
                      <Badge tone={payment.status === 'captured' ? 'success' : payment.status === 'failed' ? 'danger' : payment.status.includes('refund') ? 'neutral' : 'warning'}>
                        {payment.status.replace('_', ' ')}
                      </Badge>
                    }
                  />
                  <Line label="Amount" value={formatINR(payment.amount)} />
                  {payment.method && <Line label="Method" value={payment.method.toUpperCase()} />}
                  {payment.captured_at && <Line label="Paid on" value={formatDateTime(payment.captured_at)} />}
                  {Number(payment.refunded_amount) > 0 && <Line label="Refunded" value={formatINR(payment.refunded_amount)} />}
                  {payment.status === 'failed' && payment.error_description && <p className="text-xs text-danger">{payment.error_description}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted">No payment yet.</p>
              )}
            </Card>
          )}

          <Card title="Progress">
            <OrderTimeline status={order.status} history={order.order_status_history} requiresShipping={order.requires_shipping} />
          </Card>
        </aside>
      </div>
    </>
  )
}
