import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { Package, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { needsActionStatuses, ORDER_FILTER_GROUPS } from '@/lib/order-state'
import { useAuth } from '@/contexts/auth-context'
import { useOrders } from '@/hooks/use-orders'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { OrderCard } from '@/components/orders/order-card'
import { BrandMissing } from '@/components/brand/brand-missing'
import { OrderListSkeleton } from '@/components/brand/dashboard-panel'
import { patchParams, readPage, UrlSearchField } from '@/components/brand/url-search-field'

const PAGE_SIZE = 10

const EMPTY_COPY: Record<string, { title: string; description: string }> = {
  all: { title: 'No orders yet', description: 'Browse creators, pick a service and your orders will appear here.' },
  action: { title: 'Nothing needs your attention', description: 'Orders waiting on you — payments, shipments and delivery reviews — appear here.' },
  active: { title: 'No active orders.', description: 'Orders move here once a creator accepts them.' },
  completed: { title: 'No completed orders yet.', description: 'Approved and finished orders will be listed here.' },
  cancelled: { title: 'No cancelled orders.', description: 'Cancelled and refunded orders will be listed here.' },
}

export default function Orders() {
  const { brand } = useAuth()
  const [sp, setSp] = useSearchParams()
  const requested = sp.get('group')
  const group = ORDER_FILTER_GROUPS.some((g) => g.value === requested) ? requested! : 'all'
  const q = (sp.get('q') ?? '').trim()
  const page = readPage(sp)
  const statuses = React.useMemo(
    () => (group === 'action' ? needsActionStatuses('brand') : ORDER_FILTER_GROUPS.find((g) => g.value === group)?.statuses),
    [group],
  )
  const orders = useOrders({ brandId: brand?.id, statuses, search: q || undefined, page, pageSize: PAGE_SIZE }, !!brand)

  const setGroup = (value: string) => setSp((prev) => patchParams(prev, { group: value === 'all' ? null : value, page: null }))
  const setPage = (next: number) => {
    setSp((prev) => patchParams(prev, { page: next > 1 ? String(next) : null }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const clearSearch = () => setSp((prev) => patchParams(prev, { q: null, page: null }), { replace: true })

  const header = (
    <PageHeader
      title="Orders"
      description="Track every collaboration — from payment to delivery and review."
      actions={
        <Button asChild>
          <Link to="/brand/creators">
            <Search /> Find creators
          </Link>
        </Button>
      }
    />
  )

  if (!brand) {
    return (
      <>
        <Seo title="Orders" noindex />
        {header}
        <BrandMissing />
      </>
    )
  }

  const renderContent = () => {
    if (orders.isPending) return <OrderListSkeleton count={5} />
    if (orders.isError) return <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
    const { items, total } = orders.data
    if (items.length === 0) {
      if (total > 0 && page > 1) {
        return (
          <EmptyState
            title="This page is empty"
            description="The list changed since you opened this page."
            action={
              <Button variant="secondary" size="sm" onClick={() => setPage(1)}>
                Back to the first page
              </Button>
            }
          />
        )
      }
      if (q) {
        return (
          <EmptyState
            icon={<Search />}
            title={`No orders match “${q}”`}
            description="Search by order number (like SPT-010001) or service name."
            action={
              <Button variant="secondary" size="sm" onClick={clearSearch}>
                Clear search
              </Button>
            }
          />
        )
      }
      const copy = EMPTY_COPY[group] ?? EMPTY_COPY.all!
      return (
        <EmptyState
          icon={<Package />}
          title={copy.title}
          description={copy.description}
          action={
            group === 'all' ? (
              <Button asChild size="sm">
                <Link to="/brand/creators">Find creators</Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setGroup('all')}>
                View all orders
              </Button>
            )
          }
        />
      )
    }
    return (
      <div className="space-y-6">
        <ul className={cn('space-y-3 transition-opacity', orders.isPlaceholderData && 'opacity-60')} aria-busy={orders.isFetching || undefined}>
          {items.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} perspective="brand" />
            </li>
          ))}
        </ul>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} label="orders" />
      </div>
    )
  }

  return (
    <>
      <Seo title="Orders" noindex />
      {header}
      <Tabs value={group} onValueChange={setGroup}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList aria-label="Filter orders">
            {ORDER_FILTER_GROUPS.map((g) => (
              <TabsTrigger key={g.value} value={g.value}>
                {g.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <UrlSearchField label="Search orders" placeholder="Search order number or service" />
        </div>
        <TabsContent value={group} className="mt-6">
          {renderContent()}
        </TabsContent>
      </Tabs>
    </>
  )
}
