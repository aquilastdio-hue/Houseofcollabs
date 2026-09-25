import * as React from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BadgeCheck,
  CalendarClock,
  Check,
  FileText,
  Lock,
  MapPin,
  Package,
  RefreshCcw,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { qk } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { formatDays, formatINR, formatLocation } from '@/lib/format'
import { CONTENT_TYPES, labelFor } from '@/lib/constants'
import { toAppError } from '@/lib/errors'
import { useOrderQuote } from '@/hooks/use-orders'
import { usePublicSettings } from '@/hooks/use-catalog'
import { createOrder, getServiceForCheckout } from '@/services/orders.service'
import { payForOrder } from '@/services/payments.service'
import { createBrief, listBriefs } from '@/services/briefs.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Seo } from '@/components/shared/seo'

type BriefMode = 'quick' | 'saved'

function Section({ step, title, description, children }: { step: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby={`step-${step}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-brand">{step}</span>
        <div>
          <h2 id={`step-${step}`} className="font-display text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function Checkout() {
  const { serviceId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { brand } = useAuth()
  const settings = usePublicSettings()

  const serviceQuery = useQuery({
    queryKey: ['checkout-service', serviceId],
    queryFn: () => getServiceForCheckout(serviceId!),
    enabled: !!serviceId,
  })
  const service = serviceQuery.data

  const [addonIds, setAddonIds] = React.useState<string[]>(() => (params.get('addons') ?? '').split(',').filter(Boolean))
  const quote = useOrderQuote(serviceId, addonIds)

  const briefs = useQuery({
    queryKey: qk.briefs.list({ scope: 'brand', ownerId: brand?.id, status: 'all', page: 1, checkout: true }),
    queryFn: () => listBriefs({ scope: 'brand', ownerId: brand!.id, status: 'all', pageSize: 50 }),
    enabled: !!brand,
  })
  const usableBriefs = (briefs.data?.items ?? []).filter((b) => b.status !== 'completed')

  const [briefMode, setBriefMode] = React.useState<BriefMode>(params.get('brief') ? 'saved' : 'quick')
  const [savedBriefId, setSavedBriefId] = React.useState<string>(params.get('brief') ?? '')
  const [quickTitle, setQuickTitle] = React.useState('')
  const [requirements, setRequirements] = React.useState('')
  const [talkingPoints, setTalkingPoints] = React.useState('')
  const [referenceLink, setReferenceLink] = React.useState('')
  const [shippingAck, setShippingAck] = React.useState(false)
  const [termsAck, setTermsAck] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const orderRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    // Drop add-on ids from the URL that don't belong to this service.
    if (service) setAddonIds((ids) => ids.filter((id) => service.service_addons.some((a) => a.id === id)))
  }, [service])

  const pay = useMutation({
    meta: { silent: true },
    mutationFn: async () => {
      let briefId: string | null = null
      if (briefMode === 'saved' && savedBriefId) briefId = savedBriefId
      if (briefMode === 'quick' && quickTitle.trim()) {
        const created = await createBrief(brand!.id, {
          title: quickTitle.trim(),
          campaign_objective: requirements.trim() || null,
          talking_points: talkingPoints
            .split('\n')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20),
          reference_links: referenceLink.trim() ? [referenceLink.trim()] : [],
          content_type: service?.content_type ?? null,
        })
        briefId = created.id
      }
      if (!orderRef.current) {
        const order = await createOrder({
          serviceId: serviceId!,
          addonIds,
          briefId,
          requirements: briefMode === 'quick' ? requirements : undefined,
        })
        orderRef.current = order.id
      }
      const orderId = orderRef.current
      try {
        const result = await payForOrder(orderId, { onFailure: (m) => toast.error(m) })
        return { orderId, result }
      } catch (e) {
        // Dismissed / failed checkout: the order stays "awaiting payment" and can be resumed.
        throw Object.assign(toAppError(e), { orderId })
      }
    },
    onSuccess: ({ orderId, result }) => {
      void qc.invalidateQueries({ queryKey: qk.orders.all })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(result.status === 'captured' ? 'Payment successful — your order was sent to the creator.' : 'Payment received — confirming with the bank…')
      navigate(`/brand/orders/${orderId}`, { replace: true })
    },
    onError: (e: Error & { orderId?: string }) => {
      const err = toAppError(e)
      void qc.invalidateQueries({ queryKey: qk.orders.all })
      if (e.orderId) {
        toast.message(err.message, { description: 'Your order is saved — you can complete payment from the order page.' })
        navigate(`/brand/orders/${e.orderId}`)
      } else {
        toast.error(err.message)
      }
    },
  })

  const validate = () => {
    const next: Record<string, string> = {}
    if (briefMode === 'quick') {
      if (quickTitle.trim().length < 3) next.quickTitle = 'Give your brief a short title (3+ characters)'
      if (requirements.trim().length < 20) next.requirements = 'Describe what you need in at least 20 characters'
      if (referenceLink.trim() && !/^https?:\/\/\S+$/i.test(referenceLink.trim())) next.referenceLink = 'Links must start with https://'
    } else if (!savedBriefId) next.savedBrief = 'Choose one of your briefs'
    if (service?.requires_shipping && !shippingAck) next.shipping = 'Confirm you can ship the product'
    if (!termsAck) next.terms = 'Please accept the order terms'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  if (serviceQuery.isPending) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }
  if (serviceQuery.isError) return <ErrorState error={serviceQuery.error} onRetry={() => void serviceQuery.refetch()} />
  if (!service || !service.creator || !service.active || service.archived_at || service.creator.status !== 'published') {
    return (
      <EmptyState
        title="This service isn’t available"
        description="The creator may have paused or changed it. Browse other creators or check their profile."
        action={
          <Button asChild>
            <Link to="/brand/creators">Find creators</Link>
          </Button>
        }
      />
    )
  }
  const creator = service.creator
  const unavailable = !creator.available

  return (
    <>
      <Seo title={`Checkout · ${service.title}`} noindex />
      <Breadcrumb
        items={[
          { label: 'Creators', href: '/brand/creators' },
          { label: creator.display_name, href: `/brand/creators/${creator.id}` },
          { label: 'Checkout' },
        ]}
      />
      <h1 className="mb-6 font-display text-display-md font-semibold">Review & pay</h1>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <Section step={1} title="Service">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar src={creator.profile_image_url} name={creator.display_name} size="xl" shape="rounded" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium">
                  {creator.display_name}
                  {creator.verified && <BadgeCheck className="size-4 fill-brand text-ink" aria-label="Verified" />}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {formatLocation(creator.city, creator.state)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 fill-ink text-ink" strokeWidth={0} />
                    {creator.review_count ? `${Number(creator.rating).toFixed(1)} (${creator.review_count})` : 'New'}
                  </span>
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link to={`/brand/creators/${creator.id}#services`}>Change service</Link>
              </Button>
            </div>
            <div className="mt-5 rounded-control border border-line bg-subtle/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge size="sm" tone="neutral" className="mb-1.5">
                    {labelFor(CONTENT_TYPES, service.content_type)}
                  </Badge>
                  <p className="font-display text-lg font-semibold">{service.title}</p>
                </div>
                <p className="font-display text-xl font-semibold tabular-nums">{formatINR(service.price)}</p>
              </div>
              {service.description && <p className="mt-2 text-sm text-muted">{service.description}</p>}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4 text-muted" /> {formatDays(service.delivery_days)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCcw className="size-4 text-muted" /> {service.revisions_included} revision{service.revisions_included === 1 ? '' : 's'}
                </span>
                {service.requires_shipping && (
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="size-4 text-muted" /> Needs your product
                  </span>
                )}
              </div>
              {service.includes.length > 0 && (
                <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {service.includes.map((inc) => (
                    <li key={inc} className="flex items-center gap-2 text-sm">
                      <Check className="size-4 text-success" /> {inc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section step={2} title="Add-ons" description="Optional extras from this creator.">
            {service.service_addons.length === 0 ? (
              <p className="text-sm text-muted">This service has no add-ons.</p>
            ) : (
              <ul className="space-y-2">
                {service.service_addons.map((a) => {
                  const checked = addonIds.includes(a.id)
                  return (
                    <li key={a.id}>
                      <label
                        htmlFor={`addon-${a.id}`}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-control border p-3.5 transition-colors',
                          checked ? 'border-ink bg-brand-soft/40' : 'border-line hover:border-line-strong',
                        )}
                      >
                        <Checkbox
                          id={`addon-${a.id}`}
                          checked={checked}
                          onCheckedChange={(v) => setAddonIds((ids) => (v === true ? [...ids, a.id] : ids.filter((x) => x !== a.id)))}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{a.name}</span>
                          {a.description && <span className="block text-xs text-muted">{a.description}</span>}
                          {a.extra_revisions > 0 && <span className="block text-xs text-muted">+{a.extra_revisions} revision{a.extra_revisions > 1 ? 's' : ''}</span>}
                          {a.delivery_days_override && <span className="block text-xs text-muted">Delivery in {formatDays(a.delivery_days_override)}</span>}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">+{formatINR(a.price)}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section step={3} title="Brief" description="Tell the creator what you need. They’ll see this before accepting.">
            <Tabs value={briefMode} onValueChange={(v) => setBriefMode(v as BriefMode)}>
              <TabsList>
                <TabsTrigger value="quick">Quick brief</TabsTrigger>
                <TabsTrigger value="saved">
                  Use a saved brief{usableBriefs.length ? ` (${usableBriefs.length})` : ''}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="quick" className="mt-4 space-y-4">
                <Field label="Brief title" htmlFor="quickTitle" required error={errors.quickTitle}>
                  <Input id="quickTitle" value={quickTitle} maxLength={140} onChange={(e) => setQuickTitle(e.target.value)} placeholder="Festive gifting reel for our new hamper" />
                </Field>
                <Field label="What do you need?" htmlFor="requirements" required error={errors.requirements} hint="Product, key message, format, tone, dos and don’ts.">
                  <Textarea
                    id="requirements"
                    rows={5}
                    maxLength={4000}
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder="A 30-second vertical video unboxing our Diwali hamper. Warm, family vibe. Mention the handmade diyas and that it ships in 2 days."
                  />
                </Field>
                <Field label="Mandatory talking points" htmlFor="talkingPoints" optional hint="One per line.">
                  <Textarea id="talkingPoints" rows={3} value={talkingPoints} onChange={(e) => setTalkingPoints(e.target.value)} placeholder={'Handmade in Jaipur\nFree shipping above ₹999'} />
                </Field>
                <Field label="Reference link" htmlFor="referenceLink" optional error={errors.referenceLink}>
                  <Input id="referenceLink" type="url" value={referenceLink} onChange={(e) => setReferenceLink(e.target.value)} placeholder="https://instagram.com/reel/…" />
                </Field>
                <p className="flex items-center gap-2 text-xs text-muted">
                  <FileText className="size-3.5" /> Saved to your briefs so you can reuse it.{' '}
                  <Link to="/brand/briefs/new" className="font-medium text-ink underline underline-offset-2">
                    Write a detailed brief instead
                  </Link>
                </p>
              </TabsContent>
              <TabsContent value="saved" className="mt-4">
                {briefs.isPending ? (
                  <Skeleton className="h-11" />
                ) : usableBriefs.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<FileText />}
                    title="No saved briefs"
                    description="Write a quick brief here, or create a detailed one."
                    action={
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/brand/briefs/new">New brief</Link>
                      </Button>
                    }
                  />
                ) : (
                  <Field label="Choose a brief" htmlFor="savedBrief" required error={errors.savedBrief}>
                    <Select
                      id="savedBrief"
                      value={savedBriefId}
                      onValueChange={setSavedBriefId}
                      options={usableBriefs.map((b) => ({ value: b.id, label: `${b.title}${b.status !== 'draft' ? ` · ${b.status}` : ''}` }))}
                      placeholder="Select a brief"
                    />
                  </Field>
                )}
              </TabsContent>
            </Tabs>
          </Section>

          {service.requires_shipping && (
            <Section step={4} title="Product shipping" description="This service needs your physical product.">
              <ol className="mb-4 space-y-2 text-sm text-ink-soft">
                <li>1. After the creator accepts, you’ll see their delivery address on the order page.</li>
                <li>2. Ship the product and add the courier and tracking number.</li>
                <li>3. The delivery timeline starts once the creator confirms they received it.</li>
              </ol>
              <label htmlFor="shipAck" className="flex items-start gap-3 text-sm">
                <Checkbox id="shipAck" checked={shippingAck} onCheckedChange={(v) => setShippingAck(v === true)} className="mt-0.5" aria-invalid={!!errors.shipping} />
                <span>I can ship the product to the creator within a few days of acceptance.</span>
              </label>
              {errors.shipping && <p className="mt-1.5 text-xs font-medium text-danger">{errors.shipping}</p>}
            </Section>
          )}
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
            <h2 className="font-display text-lg font-semibold">Order summary</h2>
            {quote.isError ? (
              <ErrorState compact error={quote.error} onRetry={() => void quote.refetch()} className="mt-4" />
            ) : !quote.data ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-5" />
                <Skeleton className="h-5" />
                <Skeleton className="h-8" />
              </div>
            ) : (
              <div className={cn('mt-4 space-y-3 text-sm transition-opacity', quote.isFetching && 'opacity-60')} aria-live="polite">
                <div className="flex justify-between">
                  <span className="text-muted">{service.title}</span>
                  <span className="tabular-nums">{formatINR(quote.data.subtotal)}</span>
                </div>
                {addonIds.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted">Add-ons ({addonIds.length})</span>
                    <span className="tabular-nums">{formatINR(quote.data.addons_total)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">Delivery</span>
                  <span>{formatDays(quote.data.delivery_days)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Revisions</span>
                  <span>{quote.data.revisions}</span>
                </div>
                <div className="flex items-end justify-between border-t border-line pt-3">
                  <span className="font-medium">Total</span>
                  <span className="font-display text-2xl font-semibold tabular-nums">{formatINR(quote.data.total)}</span>
                </div>
                <p className="text-xs text-muted">Price calculated securely on our servers. No hidden charges.</p>
              </div>
            )}

            <label htmlFor="termsAck" className="mt-5 flex items-start gap-3 text-sm">
              <Checkbox id="termsAck" checked={termsAck} onCheckedChange={(v) => setTermsAck(v === true)} className="mt-0.5" aria-invalid={!!errors.terms} />
              <span className="text-muted">
                I agree to the{' '}
                <Link to="/refund-policy" className="font-medium text-ink underline underline-offset-2" target="_blank">
                  refund policy
                </Link>
                .{' '}
                {typeof settings.data?.cancellation_rules === 'string' ? settings.data.cancellation_rules : 'You can cancel for a full refund until the creator accepts.'}
              </span>
            </label>
            {errors.terms && <p className="mt-1.5 text-xs font-medium text-danger">{errors.terms}</p>}

            <Button
              className="mt-5"
              size="lg"
              block
              variant="accent"
              disabled={unavailable || !quote.data}
              loading={pay.isPending}
              onClick={() => validate() && pay.mutate()}
            >
              <Lock /> Pay {quote.data ? formatINR(quote.data.total) : ''}
            </Button>
            {unavailable && <p className="mt-2 text-center text-xs text-danger">This creator isn’t taking new orders right now.</p>}
            <ul className="mt-5 space-y-2 text-xs text-muted">
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" /> Payment secured by Razorpay (UPI, cards, netbanking)
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" /> Held safely until you approve the delivery
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" /> Full refund if the creator declines
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  )
}
