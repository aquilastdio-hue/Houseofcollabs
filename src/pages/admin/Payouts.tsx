import * as React from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Play, Wallet, Zap } from 'lucide-react'
import { fetchAllPages } from '@/lib/fetch-all'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDate, formatDateTime, formatINR, formatNumber } from '@/lib/format'
import { getAutoPayoutStatus, listPayouts, runAutoPayouts, type AdminPayoutItem } from '@/services/admin.service'
import { Badge } from '@/components/ui/badge'
import { BankTransfers } from '@/components/admin/bank-transfers'
import { usePublicSettings } from '@/hooks/use-catalog'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PAYOUT_STATUS_META, StatusBadge } from '@/components/admin/admin-status'
import { IdentityCell } from '@/components/admin/detail'
import { CreatorBalances } from '@/components/admin/creator-balances'
import { PayoutDialog } from '@/components/admin/payout-dialog'
import { PayoutMethodSummary, latestReference, linkedEarnings, readPayoutSnapshot } from '@/components/admin/payout-parts'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'

const TABS = [
  { value: 'owed', label: 'Owed to creators' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
] as const
const TAB_VALUES = TABS.map((t) => t.value)

type RequestTab = Exclude<(typeof TABS)[number]['value'], 'owed'>

const EMPTY_COPY: Record<RequestTab, { title: string; description: string }> = {
  pending: { title: 'No pending payouts', description: 'New creator payout requests land here. You’re all caught up.' },
  processing: { title: 'Nothing processing', description: 'Payouts you mark as processing (or send via RazorpayX) wait here until they’re confirmed.' },
  paid: { title: 'No paid payouts yet', description: 'Completed transfers are listed here with their references.' },
  failed: { title: 'No failed payouts', description: 'Bounced or reversed transfers would show up here.' },
  rejected: { title: 'No rejected requests', description: 'Requests you decline are kept here for the record.' },
  all: { title: 'No payout requests yet', description: 'Creators request payouts from their earnings page once they have an available balance.' },
}

/**
 * Automatic payouts (0041): whether they're on, whether RazorpayX is
 * connected, and a button to run the 15-minute job now.
 */
function AutoPayoutsBar() {
  const queryClient = useQueryClient()
  // Only once switched on (Settings → Payouts): until RazorpayX works, bank
  // transfers are how creators are paid and the function may not be deployed.
  const settings = usePublicSettings()
  const on = settings.data?.auto_payouts_enabled === true
  const status = useQuery({
    queryKey: [...qk.admin.all, 'auto-payouts'],
    queryFn: getAutoPayoutStatus,
    meta: { silent: true },
    retry: false,
    enabled: on,
  })
  const run = useMutation({
    mutationFn: runAutoPayouts,
    onSuccess: (r) => {
      const parts = [
        r.skipped === 'RAZORPAYX_NOT_CONFIGURED' ? 'RazorpayX isn’t connected' : `${r.sent} sent`,
        r.failed ? `${r.failed} failed` : '',
        r.synced.paid ? `${r.synced.paid} confirmed paid` : '',
        r.synced.failed ? `${r.synced.failed} bounced` : '',
      ].filter(Boolean)
      toast.success(`Automatic payouts: ${parts.join(', ')}.`)
      void queryClient.invalidateQueries({ queryKey: qk.admin.all })
    },
  })
  // Not deployed yet (RazorpayX pending): bank transfers below are how creators are paid.
  const s = status.data
  if (!on || status.isError || !s) return null
  const connected = s.live_configured
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 text-sm">
        <Zap className={cn('mt-0.5 size-4 shrink-0', s.enabled && connected ? 'text-success' : 'text-muted')} aria-hidden />
        <p>
          <span className="font-medium text-ink">Automatic payouts {s.enabled ? 'on' : 'off'}.</span>{' '}
          {s.enabled
            ? connected
              ? `Creators are paid through RazorpayX ${s.hold_hours} hours after an order completes, every 15 minutes.`
              : 'RazorpayX isn’t connected: add RAZORPAYX_ACCOUNT_NUMBER in Supabase secrets.'
            : 'Turn them on in Settings → Payouts.'}{' '}
          <span className="text-muted">RazorpayX live {s.live_configured ? '✓' : '✗'} · test {s.test_configured ? '✓' : '✗'}</span>
        </p>
      </div>
      <Button size="sm" variant="secondary" loading={run.isPending} disabled={!s.enabled} onClick={() => run.mutate()}>
        {!run.isPending && <Play />} Run now
      </Button>
    </div>
  )
}

export default function Payouts() {
  const url = useUrlState()
  const rawTab = url.get('status')
  // "Owed to creators" is where the page opens; the rest list payout requests by status.
  const tab = isOneOf(TAB_VALUES, rawTab) ? rawTab : 'owed'
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const requestTab: RequestTab = tab === 'owed' ? 'pending' : tab
  const params = { status: requestTab === 'all' ? ('' as const) : requestTab }
  const query = useQuery({
    queryKey: qk.admin.payouts(params),
    queryFn: () => fetchAllPages((page, pageSize) => listPayouts({ ...params, page, pageSize })),
    placeholderData: keepPreviousData,
    enabled: tab !== 'owed',
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
    {
      key: 'status',
      header: 'Status',
      cell: (p) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge meta={PAYOUT_STATUS_META} value={p.status} size="sm" />
          {p.automatic && (
            <Badge tone="info" size="sm">
              <Zap /> Auto
            </Badge>
          )}
        </span>
      ),
    },
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
        <Button
          size="xs"
          variant={p.status === 'pending' || p.status === 'processing' ? 'primary' : 'secondary'}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedId(p.id)
          }}
        >
          {p.status === 'pending' || p.status === 'processing' ? 'Process' : 'View'}
        </Button>
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
        description="What each creator is owed, and their payout requests. Manual transfers need a reference; RazorpayX sends automatically when configured."
      />

      <AutoPayoutsBar />
      <BankTransfers />

      <Tabs value={tab} onValueChange={(v) => url.update({ status: v === 'owed' ? null : v })}>
        <TabsList aria-label="Payout status" className="mb-5">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="owed">
          <CreatorBalances
            onProcess={(requestId, status) => {
              // Open that request where it lives; the dialog appears once its tab has loaded.
              url.update({ status })
              setSelectedId(requestId)
            }}
          />
        </TabsContent>
        <TabsContent value={requestTab}>
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
                title={EMPTY_COPY[requestTab].title}
                description={EMPTY_COPY[requestTab].description}
                action={
                  requestTab !== 'all' ? (
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
          />
        </TabsContent>
      </Tabs>

      <PayoutDialog payout={selected} onClose={() => setSelectedId(null)} />
    </>
  )
}
