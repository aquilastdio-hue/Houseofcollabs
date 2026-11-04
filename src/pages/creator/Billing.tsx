import * as React from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BadgeIndianRupee, CircleCheck, Clock, FileText, Info, Landmark, ReceiptText, Wallet } from 'lucide-react'
import { site } from '@/config/site'
import { formatINR, formatPercent } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { getMyBillingSummary, listInvoices, payInvoice, type CreatorBillingSummary, type Invoice, type InvoiceKind } from '@/services/billing.service'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { StatsCard } from '@/components/shared/stats-card'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { SectionCard } from '@/components/brand/section-card'
import { InvoiceTable } from '@/components/billing/invoice-table'
import { TaxProfileForm } from '@/components/billing/tax-profile-form'

const PAGE_SIZE = 20

const FILTERS: { value: InvoiceKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'creator_commission', label: 'Commission' },
  { value: 'settlement', label: 'Payouts' },
  { value: 'creator_service', label: 'Your invoices to brands' },
  { value: 'credit_note', label: 'Credit notes' },
]

/**
 * Creator → Billing: what brands paid for their work, what was withheld for
 * tax, the commission they owe House of Collabs (paid separately, never taken
 * out of a payout), every document, and the tax details that go on them.
 */
export default function CreatorBilling() {
  const queryClient = useQueryClient()
  const [kind, setKind] = React.useState<InvoiceKind | 'all'>('all')
  const [page, setPage] = React.useState(1)

  const summary = useQuery({ queryKey: qk.billing.summary, queryFn: getMyBillingSummary })
  const s = summary.data?.role === 'creator' ? (summary.data as CreatorBillingSummary) : null

  const due = useQuery({
    queryKey: qk.billing.invoices({ due: true }),
    queryFn: () => listInvoices({ kind: 'creator_commission', status: 'open', pageSize: 50, includeTest: true }),
  })
  const docs = useQuery({
    queryKey: qk.billing.invoices({ kind, page }),
    queryFn: () => listInvoices({ kind, page, pageSize: PAGE_SIZE, includeTest: true }),
    placeholderData: keepPreviousData,
  })

  const pay = useMutation({
    mutationFn: (inv: Invoice) => payInvoice(inv.id, { onFailure: (m) => toast.error(m) }),
    onSuccess: (res) => {
      toast.success(res.status === 'captured' ? 'Payment received. Thank you!' : 'Payment is processing. We’ll update the invoice shortly.')
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: qk.billing.all }),
  })

  return (
    <>
      <Seo title="Billing & tax" noindex />
      <PageHeader
        title="Billing & tax"
        description="Your earnings, the tax withheld on them, the commission you owe, and every invoice and statement."
      />

      <div className="space-y-8">
        {summary.isError ? (
          <ErrorState compact title="Couldn’t load your billing" error={summary.error} onRetry={() => void summary.refetch()} />
        ) : (
          <section aria-label="Billing summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
            <StatsCard
              tone="dark"
              label="Campaign earnings"
              icon={<BadgeIndianRupee />}
              loading={summary.isPending}
              value={formatINR(s?.earnings_total)}
              hint="Fees + GST on completed orders"
            />
            <StatsCard label="Pending payments" icon={<Clock />} loading={summary.isPending} value={formatINR(Number(s?.pending ?? 0) + Number(s?.in_progress ?? 0))} hint="Not paid out yet" />
            <StatsCard label="Paid to you" icon={<CircleCheck />} loading={summary.isPending} value={formatINR(s?.paid)} hint="After TDS and TCS" />
            <StatsCard label="TDS deducted" icon={<Landmark />} loading={summary.isPending} value={formatINR(s?.tds)} hint="Income tax, s.194-O" />
            <StatsCard label="GST TCS" icon={<Landmark />} loading={summary.isPending} value={formatINR(s?.tcs)} hint="GST, s.52 (registered only)" />
            <StatsCard
              tone={Number(s?.commission_outstanding ?? 0) > 0 ? 'brand' : 'default'}
              label="Commission due"
              icon={<Wallet />}
              loading={summary.isPending}
              value={formatINR(s?.commission_outstanding)}
              hint={s ? `${formatINR(s.commission_paid)} paid so far` : undefined}
            />
          </section>
        )}

        {s && !s.tax_profile && (
          <div className="flex gap-3 rounded-card border border-warning/30 bg-warning-soft p-4 text-sm">
            <Info className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <p>
              <span className="font-medium text-ink">Add your tax details below.</span> Your invoices need your legal name and state, and without a
              PAN income-tax TDS is 5% instead of 0.1%.
            </p>
          </div>
        )}

        <SectionCard
          title="Commission to pay"
          description={`${site.name} charges ${formatPercent(s?.commission_percent ?? 15, 0)} commission plus GST on each completed order. It’s invoiced separately, never taken out of your payout.`}
        >
          {due.isError ? (
            <ErrorState compact error={due.error} onRetry={() => void due.refetch()} />
          ) : (
            <InvoiceTable
              rows={due.data?.items}
              perspective="creator"
              loading={due.isPending}
              action={(inv) => (
                <Button size="sm" loading={pay.isPending && pay.variables?.id === inv.id} disabled={pay.isPending} onClick={() => pay.mutate(inv)}>
                  Pay {formatINR(Number(inv.total_amount) - Number(inv.amount_paid))}
                </Button>
              )}
              empty={<EmptyState icon={<CircleCheck />} title="Nothing to pay" description="Commission invoices appear here when an order completes." />}
            />
          )}
        </SectionCard>

        <section aria-labelledby="documents-title" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="documents-title" className="font-display text-lg font-semibold tracking-tight">
                Invoices & statements
              </h2>
              <p className="mt-0.5 text-sm text-muted">Download any of them as a PDF for your records or your CA.</p>
            </div>
            <Tabs
              value={kind}
              onValueChange={(v) => {
                setKind(v as InvoiceKind | 'all')
                setPage(1)
              }}
            >
              <TabsList className="no-scrollbar max-w-full overflow-x-auto">
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value}>
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <InvoiceTable
            rows={docs.data?.items}
            perspective="creator"
            loading={docs.isPending}
            error={docs.isError && !docs.data ? docs.error : undefined}
            onRetry={() => void docs.refetch()}
            pagination={docs.data ? { page, pageSize: PAGE_SIZE, total: docs.data.total, onPageChange: setPage } : undefined}
            empty={<EmptyState icon={<ReceiptText />} title="No documents yet" description="Your invoices and payout statements appear here as orders are paid and completed." />}
          />
        </section>

        <SectionCard
          title="Tax details"
          description="These go on every invoice issued for your work, and decide GST and TDS."
          id="tax-details"
        >
          {summary.isPending ? null : <TaxProfileForm key={s?.tax_profile?.updated_at ?? 'new'} role="creator" profile={s?.tax_profile ?? null} />}
        </SectionCard>

        <HowItWorks summary={s} />
      </div>
    </>
  )
}

function HowItWorks({ summary }: { summary: CreatorBillingSummary | null }) {
  const r = summary?.rates
  return (
    <div className="flex gap-3 rounded-card border border-line bg-subtle/60 p-4 text-sm text-muted sm:p-5">
      <FileText className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden />
      <div className="space-y-1.5">
        <p className="font-medium text-ink">How you’re paid</p>
        <p>
          Brands pay your fee to {site.name}, plus {r ? `${r.gst}%` : '18%'} GST if you’re GST-registered. When an order completes we deduct income-tax TDS
          ({r ? `${r.tds}%` : '0.1%'}, s.194-O
          {r?.tds_limit ? `; individuals and HUFs with a PAN pay none until their year’s total passes ${formatINR(r.tds_limit)}` : ''}) and, for
          registered creators, GST TCS ({r ? `${r.tcs}%` : '0.5%'}, s.52). Both are paid to the government in your name and show up in your Form 26AS and
          on the GST portal.
        </p>
        <p>The rest is paid to you. Our commission is a separate invoice you pay from this page.</p>
      </div>
    </div>
  )
}
