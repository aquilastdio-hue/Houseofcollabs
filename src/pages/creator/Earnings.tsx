import { Link, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowRight, Banknote, CircleDollarSign, Hourglass, Percent, TrendingUp, Wallet } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatDate, formatINR, formatPercent } from '@/lib/format'
import { useAuth } from '@/contexts/auth-context'
import { usePublicSettings } from '@/hooks/use-catalog'
import { getEarningsSummary, listEarnings, type EarningListItem } from '@/services/earnings.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { PageHeader, SectionTitle } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { StatsCard } from '@/components/shared/stats-card'
import { CreatorSetupRequired } from '@/components/creator-studio/parts'
import { EARNING_STATUS_META } from '@/components/creator-studio/status'

const PAGE_SIZE = 20

const columns: Column<EarningListItem>[] = [
  {
    key: 'order',
    header: 'Order',
    cell: (e) => (
      <Link to={`/creator/orders/${e.order_id}`} className="focus-ring rounded group/link inline-flex min-w-0 flex-col">
        <span className="font-mono text-xs font-medium text-ink underline-offset-2 group-hover/link:underline">{e.order.order_number}</span>
        <span className="max-w-56 truncate text-xs text-muted">{e.order.service_title}</span>
      </Link>
    ),
  },
  { key: 'date', header: 'Date', cell: (e) => <span className="whitespace-nowrap">{formatDate(e.created_at)}</span> },
  {
    key: 'brand',
    header: 'Brand',
    cell: (e) => (
      <span className="flex min-w-0 items-center gap-2">
        <Avatar src={e.order.brand.brand_logo_url} name={e.order.brand.brand_name} size="xs" shape="rounded" />
        <span className="truncate">{e.order.brand.brand_name}</span>
      </span>
    ),
  },
  { key: 'gross', header: 'Gross', cell: (e) => <span className="tabular-nums">{formatINR(e.gross_amount)}</span>, className: 'text-right', headerClassName: 'text-right' },
  {
    key: 'fee',
    header: 'Fee',
    cell: (e) => <span className="text-muted tabular-nums">−{formatINR(e.platform_fee)}</span>,
    className: 'text-right',
    headerClassName: 'text-right',
  },
  {
    key: 'net',
    header: 'You earn',
    cell: (e) => <span className="font-semibold tabular-nums">{formatINR(e.net_amount)}</span>,
    className: 'text-right',
    headerClassName: 'text-right',
  },
  {
    key: 'status',
    header: 'Status',
    cell: (e) => (
      <Badge tone={EARNING_STATUS_META[e.status].tone} size="sm" dot>
        {EARNING_STATUS_META[e.status].label}
      </Badge>
    ),
  },
  {
    key: 'available',
    header: 'Available',
    mobileLabel: 'Available from',
    cell: (e) => (
      <span className="whitespace-nowrap text-muted">
        {e.status === 'paid' ? `Paid ${formatDate(e.paid_at)}` : e.status === 'refunded' ? '—' : formatDate(e.available_at)}
      </span>
    ),
  },
]

export default function Earnings() {
  const { creator } = useAuth()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const settings = usePublicSettings()
  const summary = useQuery({ queryKey: qk.earnings.summary, queryFn: getEarningsSummary, enabled: !!creator })
  const earnings = useQuery({
    queryKey: qk.earnings.list(page),
    queryFn: () => listEarnings(page, PAGE_SIZE),
    enabled: !!creator,
    placeholderData: keepPreviousData,
  })

  const holdDays = Number(settings.data?.earning_hold_days ?? 0)
  const s = summary.data

  return (
    <>
      <Seo title="Earnings" noindex />
      <PageHeader
        title="Earnings"
        description="Every completed order, the platform fee and what you take home."
        actions={
          creator ? (
            <Button asChild>
              <Link to="/creator/payouts">
                Request payout <ArrowRight />
              </Link>
            </Button>
          ) : undefined
        }
      />
      {!creator ? (
        <CreatorSetupRequired />
      ) : (
        <div className="space-y-8">
          {summary.isError ? (
            <ErrorState error={summary.error} title="Couldn’t load your balance" onRetry={() => void summary.refetch()} />
          ) : (
            <section aria-label="Earnings summary" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-5">
              <StatsCard
                tone="dark"
                label="Total earned"
                icon={<TrendingUp />}
                loading={summary.isPending}
                value={formatINR(s?.total_earned)}
                hint={s ? `${s.earning_count} completed order${s.earning_count === 1 ? '' : 's'}` : undefined}
              />
              <StatsCard label="Pending" icon={<Hourglass />} loading={summary.isPending} value={formatINR(s?.pending)} hint="Not yet withdrawable" />
              <StatsCard
                tone="brand"
                label="Available"
                icon={<Wallet />}
                loading={summary.isPending}
                value={formatINR(s?.available)}
                hint="Ready to withdraw"
              />
              <StatsCard label="Paid" icon={<Banknote />} loading={summary.isPending} value={formatINR(s?.paid)} hint="Sent to your account" />
              <StatsCard
                label="In payout"
                icon={<CircleDollarSign />}
                loading={summary.isPending}
                value={formatINR(s?.in_payout)}
                hint={s && s.held > 0 ? `${formatINR(s.held)} on hold` : 'Being processed'}
              />
            </section>
          )}

          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold tracking-tight">How earnings work</h2>
            {summary.isPending ? (
              <div className="mt-3 space-y-2" aria-busy="true">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ) : s ? (
              <ul className="mt-3 grid grid-cols-1 gap-4 text-sm text-ink-soft md:grid-cols-3">
                <li className="flex gap-3">
                  <Percent className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                  <span>
                    House of Collabs keeps {formatPercent(s.platform_fee_percent)} of each order to run the marketplace.
                    {s.fees_total > 0 && ` You’ve paid ${formatINR(s.fees_total)} in fees so far.`}
                  </span>
                </li>
                <li className="flex gap-3">
                  <Hourglass className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                  <span>
                    {holdDays > 0
                      ? `Earnings unlock ${holdDays} day${holdDays === 1 ? '' : 's'} after an order is completed.`
                      : 'Earnings are added to your balance as soon as an order is completed.'}
                    {s.next_available_at && ` Next release: ${formatDate(s.next_available_at)}.`}
                  </span>
                </li>
                <li className="flex gap-3">
                  <Wallet className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                  <span>
                    Withdraw your available balance once it reaches {formatINR(s.minimum_payout)}.{' '}
                    <Link to="/creator/payouts" className="font-medium text-ink underline underline-offset-2">
                      Go to payouts
                    </Link>
                  </span>
                </li>
              </ul>
            ) : null}
          </Card>

          <section aria-labelledby="earnings-history">
            <SectionTitle title={<span id="earnings-history">Earnings history</span>} description="One row per completed order." />
            <DataTable
              columns={columns}
              rows={earnings.data?.items}
              rowKey={(e) => e.id}
              loading={earnings.isPending}
              error={earnings.error}
              onRetry={() => void earnings.refetch()}
              mobilePrimary="order"
              empty={
                <EmptyState
                  icon={<TrendingUp />}
                  title="No earnings yet"
                  description="When a brand approves your delivery and the order completes, your earning shows up here."
                  action={
                    <Button asChild variant="secondary">
                      <Link to="/creator/orders">View your orders</Link>
                    </Button>
                  }
                />
              }
              pagination={
                earnings.data
                  ? {
                      page,
                      pageSize: PAGE_SIZE,
                      total: earnings.data.total,
                      label: 'earnings',
                      onPageChange: (p) =>
                        setParams(
                          (prev) => {
                            const next = new URLSearchParams(prev)
                            if (p > 1) next.set('page', String(p))
                            else next.delete('page')
                            return next
                          },
                          { replace: true },
                        ),
                    }
                  : undefined
              }
            />
          </section>
        </div>
      )}
    </>
  )
}
