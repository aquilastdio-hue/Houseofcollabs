import * as React from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDate, formatDateTime, formatINR, formatNumber } from '@/lib/format'
import { listPayouts, type AdminPayoutItem } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PAYOUT_STATUS_META, StatusBadge } from '@/components/admin/admin-status'
import { IdentityCell } from '@/components/admin/detail'
import { PayoutDialog } from '@/components/admin/payout-dialog'
import { PayoutMethodSummary, latestReference, linkedEarnings, readPayoutSnapshot } from '@/components/admin/payout-parts'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'

const PAGE_SIZE = 25
const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
] as const
const TAB_VALUES = TABS.map((t) => t.value)

const EMPTY_COPY: Record<(typeof TABS)[number]['value'], { title: string; description: string }> = {
  pending: { title: 'No pending payouts', description: 'New creator payout requests land here. You’re all caught up.' },
  processing: { title: 'Nothing processing', description: 'Payouts you mark as processing (or send via RazorpayX) wait here until they’re confirmed.' },
  paid: { title: 'No paid payouts yet', description: 'Completed transfers are listed here with their references.' },
  failed: { title: 'No failed payouts', description: 'Bounced or reversed transfers would show up here.' },
  rejected: { title: 'No rejected requests', description: 'Requests you decline are kept here for the record.' },
  all: { title: 'No payout requests yet', description: 'Creators request payouts from their earnings page once they have an available balance.' },
}

export default function Payouts() {
  const url = useUrlState()
  const rawTab = url.get('status')
  const tab = isOneOf(TAB_VALUES, rawTab) ? rawTab : 'pending'
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const params = { status: tab === 'all' ? ('' as const) : tab, page: url.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: qk.admin.payouts(params),
    queryFn: () => listPayouts(params),
    placeholderData: keepPreviousData,
  })
  const selected = query.data?.items.find((p) => p.id === selectedId) ?? null

  const columns: Column<AdminPayoutItem>[] = [
    {
      key: 'requested',
      header: 'Requested',
      className: 'whitespace-nowrap text-muted',
      cell: (p) => <span title={formatDateTime(p.created_at)}>{formatDate(p.created_at)}</span>,
    },
    {
      key: 'creator',
      header: 'Creator',
      cell: (p) =>
        p.creator ? (
          <IdentityCell name={p.creator.display_name} subtitle={`@${p.creator.slug}`} image={p.creator.profile_image_url} to={`/admin/creators/${p.creator.id}`} />
        ) : (
          <span className="text-faint">Unknown creator</span>
        ),
    },
    { key: 'amount', header: 'Amount', className: 'tabular-nums whitespace-nowrap font-medium', cell: (p) => formatINR(p.amount, { precise: true }) },
    { key: 'method', header: 'Method', className: 'max-w-56', cell: (p) => <PayoutMethodSummary snapshot={readPayoutSnapshot(p.payout_method_snapshot)} /> },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge meta={PAYOUT_STATUS_META} value={p.status} size="sm" /> },
    {
      key: 'earnings',
      header: 'Earnings',
      className: 'whitespace-nowrap text-muted',
      cell: (p) => {
        const e = linkedEarnings(p)
        return e.count > 0 ? (
          <span>
            {formatNumber(e.count)} order{e.count === 1 ? '' : 's'}
            <span className="block text-xs text-faint tabular-nums">{formatINR(e.amount, { precise: true })}</span>
          </span>
        ) : (
          '—'
        )
      },
    },
    { key: 'processed', header: 'Processed', className: 'whitespace-nowrap text-muted', cell: (p) => (p.processed_at ? formatDate(p.processed_at) : '—') },
    {
      key: 'reference',
      header: 'Reference',
      cell: (p) => {
        const ref = latestReference(p)
        return ref ? (
          <span className="block max-w-40 truncate font-mono text-xs" title={ref}>
            {ref}
          </span>
        ) : (
          <span className="text-faint">—</span>
        )
      },
    },
    {
      key: 'action',
      header: <span className="sr-only">Actions</span>,
      mobileLabel: ' ',
      cell: (p) => (
        <>
          <Button
            size="xs"
            variant={p.status === 'pending' || p.status === 'processing' ? 'primary' : 'secondary'}
            className="hidden md:inline-flex"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedId(p.id)
            }}
          >
            {p.status === 'pending' || p.status === 'processing' ? 'Process' : 'View'}
          </Button>
          <span className="text-xs font-medium text-ink md:hidden">{p.status === 'pending' || p.status === 'processing' ? 'Tap to process' : 'Tap for details'}</span>
        </>
      ),
    },
  ]

  const pageTotal = (query.data?.items ?? []).reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <>
      <Seo title="Payouts" noindex />
      <PageHeader
        eyebrow="Money"
        title="Payouts"
        description="Pay creators their available earnings. Manual transfers need a reference; RazorpayX sends automatically when configured."
      />

      <Tabs value={tab} onValueChange={(v) => url.update({ status: v === 'pending' ? null : v })}>
        <TabsList aria-label="Payout status" className="mb-5">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          {query.data && query.data.total > 0 && (
            <p className="mb-3 text-sm text-muted">
              {formatNumber(query.data.total)} request{query.data.total === 1 ? '' : 's'}
              {tab === 'pending' || tab === 'processing' ? ` · ${formatINR(pageTotal)} on this page` : ''}
            </p>
          )}
          <DataTable
            className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
            columns={columns}
            rows={query.data?.items}
            rowKey={(p) => p.id}
            loading={query.isPending}
            error={query.isError ? query.error : undefined}
            onRetry={() => void query.refetch()}
            onRowClick={(p) => setSelectedId(p.id)}
            mobilePrimary="creator"
            empty={
              <EmptyState
                icon={<Wallet />}
                title={EMPTY_COPY[tab].title}
                description={EMPTY_COPY[tab].description}
                action={
                  tab !== 'all' ? (
                    <Button variant="secondary" size="sm" onClick={() => url.update({ status: 'all' })}>
                      View all requests
                    </Button>
                  ) : (
                    <Button asChild variant="secondary" size="sm">
                      <Link to="/admin">Back to dashboard</Link>
                    </Button>
                  )
                }
              />
            }
            pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'requests' } : undefined}
          />
        </TabsContent>
      </Tabs>

      <PayoutDialog payout={selected} onClose={() => setSelectedId(null)} />
    </>
  )
}
