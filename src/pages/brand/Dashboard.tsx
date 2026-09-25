import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { Handshake, Megaphone, Package, Plus, Search, Sparkles, Wallet } from 'lucide-react'
import { range } from '@/lib/utils'
import { formatDate, formatINR, formatNumber } from '@/lib/format'
import { ACTIVE_STATUSES } from '@/lib/order-state'
import { useAuth } from '@/contexts/auth-context'
import { useOrders } from '@/hooks/use-orders'
import { useCreatorSearch } from '@/hooks/use-creators'
import type { CreatorSearchParams } from '@/services/creators.service'
import type { OrderListItem } from '@/services/orders.service'
import type { Brand } from '@/types'
import { Button } from '@/components/ui/button'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { OrderCard } from '@/components/orders/order-card'
import { CreatorCard, CreatorCardSkeleton } from '@/components/marketplace/creator-card'
import { BrandMissing } from '@/components/brand/brand-missing'
import { DashboardPanel, OrderListSkeleton } from '@/components/brand/dashboard-panel'
import { PendingActionsPanel } from '@/components/brand/pending-actions'
import { RecentMessagesPanel } from '@/components/brand/recent-messages'
import { SmartSearchHero } from '@/components/brand/smart-search-hero'
import { useBrandDashboardStats } from '@/components/brand/use-brand-stats'
import { WishlistsPanel } from '@/components/brand/wishlists-panel'

const RECOMMENDED: CreatorSearchParams = { sort: 'relevance', pageSize: 4 }

function greeting(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { brand } = useAuth()
  if (!brand) {
    return (
      <>
        <Seo title="Dashboard" noindex />
        <PageHeader title="Dashboard" />
        <BrandMissing />
      </>
    )
  }
  return <BrandDashboard brand={brand} />
}

function BrandDashboard({ brand }: { brand: Brand }) {
  const now = new Date()

  return (
    <>
      <Seo title="Dashboard" noindex />
      <PageHeader
        eyebrow={formatDate(now, 'EEEE, d MMMM')}
        title={`${greeting(now)}, ${brand.brand_name}`}
        description="Here’s what’s happening across your creator collaborations."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/brand/briefs/new">
                <Plus /> New brief
              </Link>
            </Button>
            <Button asChild>
              <Link to="/brand/creators">
                <Search /> Find creators
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-8 sm:space-y-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <SmartSearchHero className="lg:col-span-7 xl:col-span-8" />
          <PendingActionsPanel className="lg:col-span-5 xl:col-span-4" />
        </div>

        <StatsRow />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12 xl:items-start xl:gap-6">
          <div className="space-y-8 xl:col-span-8">
            <ActiveCollaborations brandId={brand.id} />
            <RecentOrders brandId={brand.id} />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
            <RecentMessagesPanel />
            <WishlistsPanel />
          </div>
        </div>

        <RecommendedCreators />
      </div>
    </>
  )
}

function StatsRow() {
  const stats = useBrandDashboardStats()
  if (stats.isError) {
    return <ErrorState compact title="Couldn’t load your numbers" error={stats.error} onRetry={() => void stats.refetch()} />
  }
  const s = stats.data
  const loading = stats.isPending
  return (
    <section aria-label="Overview" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-6 xl:grid-cols-5">
      <StatsCard
        className="col-span-2 md:col-span-3 xl:col-span-1"
        tone="dark"
        label="Total spend"
        icon={<Wallet />}
        loading={loading}
        value={formatINR(s?.spend_total)}
        hint={s ? `${formatINR(s.spend_30d)} in the last 30 days` : undefined}
      />
      <StatsCard
        className="md:col-span-3 xl:col-span-1"
        label="Active collaborations"
        icon={<Handshake />}
        loading={loading}
        value={formatNumber(s?.orders_active)}
        hint="Orders in progress"
      />
      <StatsCard
        className="md:col-span-2 xl:col-span-1"
        label="Orders"
        icon={<Package />}
        loading={loading}
        value={formatNumber(s?.orders_total)}
        hint={s ? `${formatNumber(s.completed_orders)} completed` : undefined}
      />
      <StatsCard
        className="md:col-span-2 xl:col-span-1"
        label="Creator searches"
        icon={<Search />}
        loading={loading}
        value={formatNumber(s?.creator_searches_30d)}
        hint={s ? `Last 30 days · ${formatNumber(s.creator_profile_views_30d)} profile views` : undefined}
      />
      <StatsCard
        className="md:col-span-2 xl:col-span-1"
        label="Active campaigns"
        icon={<Megaphone />}
        loading={loading}
        value={formatNumber(s?.active_campaigns)}
        hint="Briefs and orders in flight"
      />
    </section>
  )
}

function OrderList({
  query,
  empty,
}: {
  query: UseQueryResult<{ items: OrderListItem[]; total: number }>
  empty: ReactNode
}) {
  if (query.isPending) return <OrderListSkeleton count={3} />
  if (query.isError) return <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
  if (query.data.items.length === 0) return <>{empty}</>
  return (
    <ul className="space-y-3">
      {query.data.items.map((order) => (
        <li key={order.id}>
          <OrderCard order={order} perspective="brand" />
        </li>
      ))}
    </ul>
  )
}

function ActiveCollaborations({ brandId }: { brandId: string }) {
  const query = useOrders({ brandId, statuses: ACTIVE_STATUSES, pageSize: 5 })
  return (
    <DashboardPanel bare title="Active collaborations" href="/brand/orders?group=active">
      <OrderList
        query={query}
        empty={
          <EmptyState
            compact
            icon={<Handshake />}
            title="No active collaborations"
            description="Orders show up here once a creator accepts them."
            action={
              <Button asChild size="sm">
                <Link to="/brand/creators">Find creators</Link>
              </Button>
            }
          />
        }
      />
    </DashboardPanel>
  )
}

function RecentOrders({ brandId }: { brandId: string }) {
  const query = useOrders({ brandId, pageSize: 5 })
  return (
    <DashboardPanel bare title="Recent orders" href="/brand/orders">
      <OrderList
        query={query}
        empty={
          <EmptyState
            compact
            icon={<Package />}
            title="No orders yet"
            description="Pick a creator’s service to place your first order."
            action={
              <Button asChild size="sm" variant="secondary">
                <Link to="/brand/creators">Browse creators</Link>
              </Button>
            }
          />
        }
      />
    </DashboardPanel>
  )
}

function RecommendedCreators() {
  const query = useCreatorSearch(RECOMMENDED)
  const items = query.data?.items ?? []
  const grid = 'grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:gap-5 xl:grid-cols-4'
  return (
    <DashboardPanel bare title="Recommended creators" href="/brand/creators" linkLabel="Browse all">
      {query.isPending ? (
        <div className={grid} aria-hidden>
          {range(4).map((i) => (
            <CreatorCardSkeleton key={i} />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={<Sparkles />}
          title="No creators to recommend yet"
          description="Check back soon, or browse the full marketplace to find your match."
          action={
            <Button asChild size="sm" variant="secondary">
              <Link to="/brand/creators">Open marketplace</Link>
            </Button>
          }
        />
      ) : (
        <ul className={grid}>
          {items.map((creator) => (
            <li key={creator.id} className="flex">
              <CreatorCard creator={creator} href={`/brand/creators/${creator.id}`} showCompare className="w-full" />
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  )
}
