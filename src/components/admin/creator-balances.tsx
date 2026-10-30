import { useQuery } from '@tanstack/react-query'
import { CircleDollarSign, Clock3, Download, Hourglass, Wallet } from 'lucide-react'
import { downloadCsv, toCsv } from '@/lib/csv'
import { formatDate, formatINR, formatNumber } from '@/lib/format'
import { istParts } from '@/lib/india-time'
import { qk } from '@/lib/query-keys'
import { listCreatorBalances, type CreatorBalance } from '@/services/admin.service'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { StatsCard } from '@/components/shared/stats-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IdentityCell } from './detail'
import { PayoutMethodSummary, type PayoutSnapshot } from './payout-parts'

const money = (n: number) => formatINR(Number(n), { precise: true })
/** Payable now: earned and released, whether or not the creator has asked yet. */
const owed = (b: CreatorBalance) => Number(b.ready) + Number(b.requested)

const snapshotOf = (b: CreatorBalance): PayoutSnapshot => ({
  methodType: b.method_type,
  holder: b.method_holder,
  upiId: b.method_upi,
  last4: b.method_bank_last4,
  ifsc: b.method_ifsc,
  bankName: b.method_bank_name,
})

/**
 * Admin → Payouts → Owed to creators: one row per creator with money on the
 * platform, so it's clear how much to pay each of them. Creators still ask for
 * their money with a payout request; "Process" opens theirs.
 */
export function CreatorBalances({ onProcess }: { onProcess: (requestId: string, status: string) => void }) {
  const query = useQuery({ queryKey: qk.admin.creatorBalances, queryFn: listCreatorBalances })
  const rows = query.data ?? []
  const sum = (pick: (b: CreatorBalance) => number) => rows.reduce((t, b) => t + pick(b), 0)
  const owedTotal = sum(owed)
  const owedCount = rows.filter((b) => owed(b) > 0).length
  const requestedTotal = sum((b) => Number(b.requested))

  const columns: Column<CreatorBalance>[] = [
    {
      key: 'creator',
      header: 'Creator',
      cell: (b) => <IdentityCell name={b.display_name} subtitle={b.email} image={b.profile_image_url} to={`/admin/creators/${b.creator_id}`} />,
    },
    {
      key: 'owed',
      header: 'To pay now',
      className: 'whitespace-nowrap',
      cell: (b) => (
        <span className="tabular-nums">
          <span className={owed(b) > 0 ? 'font-semibold text-ink' : 'text-faint'}>{money(owed(b))}</span>
          {Number(b.requested) > 0 ? (
            <span className="block text-xs text-muted">{money(Number(b.requested))} requested</span>
          ) : Number(b.ready) > 0 ? (
            <span className="block text-xs text-faint">Not requested yet</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'hold',
      header: 'On hold',
      className: 'whitespace-nowrap tabular-nums text-muted',
      cell: (b) => (Number(b.on_hold) > 0 ? money(Number(b.on_hold)) : '—'),
    },
    {
      key: 'progress',
      header: 'In progress',
      className: 'whitespace-nowrap tabular-nums text-muted',
      cell: (b) => (Number(b.in_progress) > 0 ? money(Number(b.in_progress)) : '—'),
    },
    {
      key: 'paid',
      header: 'Paid so far',
      className: 'whitespace-nowrap tabular-nums text-muted',
      cell: (b) =>
        Number(b.paid) > 0 ? (
          <span>
            {money(Number(b.paid))}
            {b.last_paid_at && <span className="block text-xs text-faint">Last {formatDate(b.last_paid_at)}</span>}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'method',
      header: 'Pay to',
      className: 'max-w-60',
      cell: (b) =>
        b.method_type ? (
          <PayoutMethodSummary snapshot={snapshotOf(b)} />
        ) : (
          <Badge size="sm" tone="warning">
            No payout details
          </Badge>
        ),
    },
    {
      key: 'action',
      header: <span className="sr-only">Actions</span>,
      mobileLabel: ' ',
      cell: (b) =>
        b.open_request_id ? (
          <Button
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              onProcess(b.open_request_id!, b.open_request_status ?? 'pending')
            }}
          >
            Process
          </Button>
        ) : null,
    },
  ]

  function exportCsv() {
    const header = ['Creator', 'Email', 'To pay now (₹)', 'Requested (₹)', 'On hold (₹)', 'In progress (₹)', 'Paid so far (₹)', 'Last paid', 'Pay to', 'Account holder', 'IFSC']
    const lines = rows.map((b) => [
      b.display_name,
      b.email,
      owed(b),
      Number(b.requested),
      Number(b.on_hold),
      Number(b.in_progress),
      Number(b.paid),
      b.last_paid_at ? istParts(b.last_paid_at).date : '',
      b.method_type === 'upi' ? b.method_upi : b.method_type ? `Bank ••••${b.method_bank_last4 ?? ''}` : '',
      b.method_holder ?? '',
      b.method_ifsc ?? '',
    ])
    downloadCsv(`house-of-collabs-owed-to-creators-${istParts(new Date().toISOString()).date}.csv`, toCsv(header, lines))
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="To pay now"
          value={money(owedTotal)}
          icon={<Wallet />}
          tone="brand"
          loading={query.isPending}
          hint={`${formatNumber(owedCount)} creator${owedCount === 1 ? '' : 's'}${requestedTotal > 0 ? ` · ${money(requestedTotal)} requested` : ''}`}
        />
        <StatsCard label="On hold" value={money(sum((b) => Number(b.on_hold)))} icon={<Hourglass />} loading={query.isPending} hint="Earned, in the waiting period" />
        <StatsCard
          label="In progress"
          value={money(sum((b) => Number(b.in_progress)))}
          icon={<Clock3 />}
          loading={query.isPending}
          hint="Paid orders not approved yet"
        />
        <StatsCard label="Paid so far" value={money(sum((b) => Number(b.paid)))} icon={<CircleDollarSign />} loading={query.isPending} hint="All time" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          “To pay now” is each creator’s earnings after commission, released and not yet paid. Creators ask for it with a payout request.
        </p>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download /> Export CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={query.data}
        rowKey={(b) => b.creator_id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        mobilePrimary="creator"
        empty={
          <EmptyState
            icon={<Wallet />}
            title="Nobody is owed anything yet"
            description="Creators show up here once a brand pays for an order with them, and stay with what they’ve earned and been paid."
          />
        }
      />
    </div>
  )
}
