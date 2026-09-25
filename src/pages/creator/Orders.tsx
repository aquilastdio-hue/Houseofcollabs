import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { Package, Search, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { ORDER_FILTER_GROUPS, needsActionStatuses } from '@/lib/order-state'
import { useAuth } from '@/contexts/auth-context'
import { useOrders } from '@/hooks/use-orders'
import { useDebounce } from '@/hooks/use-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { Seo } from '@/components/shared/seo'
import { OrderCard } from '@/components/orders/order-card'
import { CreatorSetupRequired, ListSkeleton } from '@/components/creator-studio/parts'

const PAGE_SIZE = 10

export default function Orders() {
  const { creator } = useAuth()
  const [params, setParams] = useSearchParams()
  const requestedTab = params.get('tab')
  const tab = ORDER_FILTER_GROUPS.some((g) => g.value === requestedTab) ? requestedTab! : 'all'
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const q = params.get('q') ?? ''
  const [search, setSearch] = React.useState(q)
  const debounced = useDebounce(search.trim(), 350)

  const update = (patch: Record<string, string | null>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  // Push the debounced search into the URL (only when the typed value changes).
  const lastPushed = React.useRef(debounced)
  React.useEffect(() => {
    if (debounced === lastPushed.current) return
    lastPushed.current = debounced
    update({ q: debounced || null, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const group = ORDER_FILTER_GROUPS.find((g) => g.value === tab)
  const statuses = tab === 'action' ? needsActionStatuses('creator') : group?.statuses
  const orders = useOrders({ creatorId: creator?.id, statuses, search: q || undefined, page, pageSize: PAGE_SIZE }, !!creator)
  const filtered = tab !== 'all' || !!q

  const clearFilters = () => {
    setSearch('')
    lastPushed.current = ''
    update({ tab: null, q: null, page: null })
  }

  let list: React.ReactNode
  if (orders.isPending) {
    list = <ListSkeleton rows={5} itemClassName="h-24" />
  } else if (orders.isError) {
    list = <ErrorState error={orders.error} title="Couldn’t load your orders" onRetry={() => void orders.refetch()} />
  } else if (orders.data.items.length === 0) {
    list = filtered ? (
      <EmptyState
        icon={<SearchX />}
        title="No orders match"
        description={q ? `Nothing matches “${q}” in this view.` : 'There are no orders in this view right now.'}
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<Package />}
        title="No orders yet"
        description="Complete your storefront to get discovered — brands order from creators with a full profile, clear services and a strong portfolio."
        action={
          <Button asChild>
            <Link to="/creator/profile">Complete your storefront</Link>
          </Button>
        }
      />
    )
  } else {
    list = (
      <div className={cn('space-y-4 transition-opacity', orders.isPlaceholderData && 'opacity-60')} aria-busy={orders.isFetching || undefined}>
        <p className="text-sm text-muted">
          {formatNumber(orders.data.total)} order{orders.data.total === 1 ? '' : 's'}
        </p>
        <ul className="space-y-3">
          {orders.data.items.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} perspective="creator" />
            </li>
          ))}
        </ul>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={orders.data.total}
          label="orders"
          onPageChange={(p) => {
            update({ page: p > 1 ? String(p) : null })
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      </div>
    )
  }

  return (
    <>
      <Seo title="Orders" noindex />
      <PageHeader title="Orders" description="Accept new orders, deliver your content and keep track of revisions." />
      {!creator ? (
        <CreatorSetupRequired />
      ) : (
        <Tabs value={tab} onValueChange={(value) => update({ tab: value === 'all' ? null : value, page: null })}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList aria-label="Filter orders">
              {ORDER_FILTER_GROUPS.map((g) => (
                <TabsTrigger key={g.value} value={g.value}>
                  {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="w-full lg:w-80">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search />}
                placeholder="Search order number or service"
                aria-label="Search orders"
              />
            </div>
          </div>
          {ORDER_FILTER_GROUPS.map((g) => (
            <TabsContent key={g.value} value={g.value} className="mt-5">
              {g.value === tab ? list : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  )
}
