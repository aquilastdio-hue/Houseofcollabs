import { Link, useSearchParams } from 'react-router'
import * as React from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarRange, FileText, Mail, Package, ReceiptText, ShieldCheck, Wallet } from 'lucide-react'
import { site, supportEmailHref } from '@/config/site'
import { formatDate, formatINR, formatNumber } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { useAuth } from '@/contexts/auth-context'
import { listMyPayments, type PaymentListItem } from '@/services/payments.service'
import { getMyBillingSummary, listInvoices, type BrandBillingSummary } from '@/services/billing.service'
import type { PaymentStatus } from '@/types'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/shared/data-table'
import { Seo } from '@/components/shared/seo'
import { StatsCard } from '@/components/shared/stats-card'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { BrandMissing } from '@/components/brand/brand-missing'
import { BrandSettingsLayout } from '@/components/brand/settings-nav'
import { patchParams, readPage } from '@/components/brand/url-search-field'
import { useBrandDashboardStats } from '@/components/brand/use-brand-stats'
import { SectionCard } from '@/components/brand/section-card'
import { InvoiceTable } from '@/components/billing/invoice-table'
import { TaxProfileForm } from '@/components/billing/tax-profile-form'

const INVOICE_PAGE_SIZE = 10

/** `listMyPayments` default page size (kept in sync so cache keys stay unique). */
const PAGE_SIZE = 20

const STATUS: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  captured: { label: 'Paid', tone: 'success' },
  created: { label: 'Pending', tone: 'warning' },
  authorized: { label: 'Authorised', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  partially_refunded: { label: 'Partly refunded', tone: 'neutral' },
}

const METHODS: Record<string, string> = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  emi: 'EMI',
  paylater: 'Pay later',
  cardless_emi: 'Cardless EMI',
  bank_transfer: 'Bank transfer',
}

function methodLabel(method: string | null) {
  if (!method) return '—'
  return METHODS[method.toLowerCase()] ?? method.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

const columns: Column<PaymentListItem>[] = [
  {
    key: 'date',
    header: 'Date',
    cell: (p) => {
      const at = p.captured_at ?? p.created_at
      return (
        <time dateTime={at} className="whitespace-nowrap">
          {formatDate(at)}
        </time>
      )
    },
  },
  {
    key: 'order',
    header: 'Order',
    cell: (p) => (
      <div className="min-w-0">
        <Link
          to={`/brand/orders/${p.order_id}`}
          className="focus-ring rounded font-mono text-sm font-medium underline-offset-4 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {p.order?.order_number ?? 'View order'}
        </Link>
        {p.order?.service_title && <p className="max-w-64 truncate text-xs text-muted">{p.order.service_title}</p>}
      </div>
    ),
  },
  {
    key: 'creator',
    header: 'Creator',
    cell: (p) => <span className="block max-w-48 truncate">{p.order?.creator?.display_name ?? '—'}</span>,
  },
  {
    key: 'amount',
    header: 'Amount',
    headerClassName: 'text-right',
    className: 'text-right',
    cell: (p) => (
      <div className="md:text-right">
        <p className="font-medium tabular-nums">{formatINR(p.amount)}</p>
        {Number(p.refunded_amount) > 0 && <p className="text-xs text-muted tabular-nums">{formatINR(p.refunded_amount)} refunded</p>}
      </div>
    ),
  },
  {
    key: 'method',
    header: 'Method',
    hideOnMobile: true,
    cell: (p) => <span className="whitespace-nowrap">{methodLabel(p.method)}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (p) => {
      const meta = STATUS[p.status] ?? { label: p.status, tone: 'neutral' as const }
      return (
        <Badge tone={meta.tone} size="sm" dot>
          {meta.label}
        </Badge>
      )
    },
  },
]

export default function BillingSettings() {
  const { brand } = useAuth()
  const [sp, setSp] = useSearchParams()
  const page = readPage(sp)
  const stats = useBrandDashboardStats(!!brand)
  const payments = useQuery({
    queryKey: qk.payments.mine(page),
    queryFn: () => listMyPayments(page, PAGE_SIZE),
    enabled: !!brand,
    placeholderData: keepPreviousData,
  })

  const billing = useQuery({ queryKey: qk.billing.summary, queryFn: getMyBillingSummary, enabled: !!brand })
  const b = billing.data?.role === 'brand' ? (billing.data as BrandBillingSummary) : null
  const [invoicePage, setInvoicePage] = React.useState(1)
  const invoices = useQuery({
    queryKey: qk.billing.invoices({ brand: true, page: invoicePage }),
    queryFn: () => listInvoices({ page: invoicePage, pageSize: INVOICE_PAGE_SIZE, includeTest: true }),
    enabled: !!brand,
    placeholderData: keepPreviousData,
  })

  const setPage = (next: number) => {
    setSp((prev) => patchParams(prev, { page: next > 1 ? String(next) : null }))
    document.getElementById('payment-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <Seo title="Billing" noindex />
      <BrandSettingsLayout title="Billing" description="Your spend, your invoices, the details printed on them, and every payment you’ve made.">
        {!brand ? (
          <BrandMissing />
        ) : (
          <>
            {stats.isError ? (
              <ErrorState compact title="Couldn’t load your spend" error={stats.error} onRetry={() => void stats.refetch()} />
            ) : (
              <section aria-label="Spend summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <StatsCard
                  tone="dark"
                  label="Total spend"
                  icon={<Wallet />}
                  loading={stats.isPending}
                  value={formatINR(stats.data?.spend_total)}
                  hint="Net of refunds"
                />
                <StatsCard
                  label="Last 30 days"
                  icon={<CalendarRange />}
                  loading={stats.isPending}
                  value={formatINR(stats.data?.spend_30d)}
                  hint="Net of refunds"
                />
                <StatsCard
                  label="Completed orders"
                  icon={<Package />}
                  loading={stats.isPending}
                  value={formatNumber(stats.data?.completed_orders)}
                  hint={stats.data ? `${formatNumber(stats.data.orders_total)} orders placed` : undefined}
                />
              </section>
            )}

            {b && Number(b.campaign_payments) > 0 && (
              <SectionCard title="Where your money went" description="Across every paid order. Creator GST goes to the creator; GST on our commission is ours to pay.">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                  {[
                    ['Creator fees', b.creator_fees],
                    ['GST on creator fees', b.creator_gst],
                    [`${site.name} commission`, b.hoc_commission],
                    ['GST on commission', b.commission_gst],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-muted">{label}</dt>
                      <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums">{formatINR(value as number)}</dd>
                    </div>
                  ))}
                </dl>
              </SectionCard>
            )}

            <section aria-labelledby="invoices-title" className="space-y-4">
              <div>
                <h2 id="invoices-title" className="font-display text-lg font-semibold tracking-tight">
                  Invoices
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  Every paid order has two: the creator’s invoice for their work, and ours for the commission. Both carry your GSTIN for input credit.
                </p>
              </div>
              <InvoiceTable
                rows={invoices.data?.items}
                perspective="brand"
                loading={invoices.isPending}
                error={invoices.isError && !invoices.data ? invoices.error : undefined}
                onRetry={() => void invoices.refetch()}
                pagination={
                  invoices.data ? { page: invoicePage, pageSize: INVOICE_PAGE_SIZE, total: invoices.data.total, onPageChange: setInvoicePage } : undefined
                }
                empty={<EmptyState icon={<FileText />} title="No invoices yet" description="Invoices are issued the moment an order is paid." />}
              />
            </section>

            <SectionCard title="Billing details" description="Printed on your invoices. Add your GSTIN to claim input tax credit." id="billing-details">
              {billing.isPending ? null : billing.isError ? (
                <ErrorState compact error={billing.error} onRetry={() => void billing.refetch()} />
              ) : (
                <TaxProfileForm key={b?.billing_profile?.updated_at ?? 'new'} role="brand" profile={b?.billing_profile ?? null} />
              )}
            </SectionCard>

            <section id="payment-history" aria-labelledby="payment-history-title" className="scroll-mt-28 space-y-4">
              <div>
                <h2 id="payment-history-title" className="font-display text-lg font-semibold tracking-tight">
                  Payment history
                </h2>
                <p className="mt-0.5 text-sm text-muted">Every checkout attempt, newest first.</p>
              </div>
              <DataTable
                columns={columns}
                rows={payments.data?.items}
                rowKey={(p) => p.id}
                loading={payments.isPending}
                error={payments.isError && !payments.data ? payments.error : undefined}
                onRetry={() => void payments.refetch()}
                mobilePrimary="order"
                empty={
                  <EmptyState
                    icon={<ReceiptText />}
                    title="No payments yet"
                    description="Payments appear here after you check out an order."
                    action={
                      <Button asChild size="sm">
                        <Link to="/brand/creators">Find creators</Link>
                      </Button>
                    }
                  />
                }
                pagination={
                  payments.data
                    ? { page, pageSize: PAGE_SIZE, total: payments.data.total, onPageChange: setPage, label: 'payments' }
                    : undefined
                }
              />
            </section>

            <div className="flex gap-3 rounded-card border border-line bg-subtle/60 p-4 sm:p-5">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <div className="space-y-1.5 text-sm text-muted">
                <p className="font-medium text-ink">Secure payments</p>
                <p>Payments are processed securely by Razorpay. {site.name} never stores your card details.</p>
                <p>
                  <Mail className="mr-1 inline size-3.5 align-[-0.125em]" aria-hidden />
                  Questions about an invoice? Email{' '}
                  <a href={supportEmailHref()} target="_blank" rel="noreferrer" className="focus-ring rounded font-medium text-ink underline underline-offset-4">
                    {site.supportEmail}
                  </a>{' '}
                  with your order number.
                </p>
              </div>
            </div>
          </>
        )}
      </BrandSettingsLayout>
    </>
  )
}
