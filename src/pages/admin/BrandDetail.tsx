import * as React from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Building2, Package, Pencil } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { getBrand } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { DetailPageSkeleton } from '@/components/admin/detail'
import { BrandAccountCard, BrandDetailsCard, BrandIdentity, BrandRecentOrders } from '@/components/admin/brand-profile'
import { BrandEditDialog } from '@/components/admin/brand-edit-dialog'
import { ordersHref } from '@/components/admin/order-presets'

export default function BrandDetail() {
  const { id = '' } = useParams()
  const [editing, setEditing] = React.useState(false)
  const query = useQuery({ queryKey: qk.admin.brand(id), queryFn: () => getBrand(id), enabled: !!id })

  if (query.isPending) {
    return (
      <>
        <Seo title="Brand" noindex />
        <DetailPageSkeleton />
      </>
    )
  }
  if (query.isError) {
    return (
      <>
        <Seo title="Brand" noindex />
        <Breadcrumb items={[{ label: 'Brands', href: '/admin/brands' }, { label: 'Brand' }]} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    )
  }
  const b = query.data
  if (!b) {
    return (
      <>
        <Seo title="Brand not found" noindex />
        <Breadcrumb items={[{ label: 'Brands', href: '/admin/brands' }, { label: 'Not found' }]} />
        <EmptyState
          icon={<Building2 />}
          title="Brand not found"
          description="This brand doesn’t exist or the link is wrong."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/admin/brands">Back to brands</Link>
            </Button>
          }
        />
      </>
    )
  }

  return (
    <>
      <Seo title={`${b.brand_name} · Brands`} noindex />
      <Breadcrumb items={[{ label: 'Brands', href: '/admin/brands' }, { label: b.brand_name }]} />

      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <BrandIdentity brand={b} />
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit brand
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to={ordersHref({ brand: b.id })}>
              <Package /> Orders
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <BrandDetailsCard brand={b} />
          <BrandRecentOrders brandId={b.id} />
        </div>
        <aside className="space-y-6">
          <BrandAccountCard brand={b} />
        </aside>
      </div>

      <BrandEditDialog brand={b} open={editing} onOpenChange={setEditing} />
    </>
  )
}
