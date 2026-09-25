import * as React from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Package, Pencil, UserX } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { getCreator } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { DetailCard, DetailPageSkeleton } from '@/components/admin/detail'
import { CreatorAccountCard, CreatorIdentity, CreatorOverview, CreatorStorefront } from '@/components/admin/creator-profile'
import { CreatorActionsPanel } from '@/components/admin/creator-actions'
import { CreatorEditDialog } from '@/components/admin/creator-edit-dialog'
import { PortfolioModerationGrid } from '@/components/admin/portfolio-moderation'
import { CreatorSetupCard, CreatorVerificationsCard } from '@/components/admin/creator-setup'
import { ordersHref } from '@/components/admin/order-presets'

export default function CreatorDetail() {
  const { id = '' } = useParams()
  const [editing, setEditing] = React.useState(false)
  const query = useQuery({ queryKey: qk.admin.creator(id), queryFn: () => getCreator(id), enabled: !!id })

  if (query.isPending) {
    return (
      <>
        <Seo title="Creator" noindex />
        <DetailPageSkeleton />
      </>
    )
  }
  if (query.isError) {
    return (
      <>
        <Seo title="Creator" noindex />
        <Breadcrumb items={[{ label: 'Creators', href: '/admin/creators' }, { label: 'Creator' }]} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    )
  }
  const c = query.data
  if (!c) {
    return (
      <>
        <Seo title="Creator not found" noindex />
        <Breadcrumb items={[{ label: 'Creators', href: '/admin/creators' }, { label: 'Not found' }]} />
        <EmptyState
          icon={<UserX />}
          title="Creator not found"
          description="This creator profile doesn’t exist or the link is wrong."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/admin/creators">Back to creators</Link>
            </Button>
          }
        />
      </>
    )
  }

  const portfolio = [...(c.portfolio_items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const hiddenCount = portfolio.filter((p) => p.is_hidden).length

  return (
    <>
      <Seo title={`${c.display_name} · Creators`} noindex />
      <Breadcrumb items={[{ label: 'Creators', href: '/admin/creators' }, { label: c.display_name }]} />

      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CreatorIdentity creator={c} />
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit profile
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to={ordersHref({ creator: c.id })}>
              <Package /> Orders
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={`/creators/${c.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Public storefront
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        </div>
      </header>

      {c.status !== 'published' && !c.deleted_at && (
        <p className="-mt-4 mb-6 text-sm text-muted">This storefront isn’t public right now — only you and the creator can see it.</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <CreatorOverview creator={c} />
          <CreatorVerificationsCard creatorId={c.id} />
          <CreatorStorefront creator={c} />
          <DetailCard
            title="Portfolio"
            description={`${portfolio.length} item${portfolio.length === 1 ? '' : 's'}${hiddenCount ? ` · ${hiddenCount} hidden by moderation` : ''}.`}
          >
            <PortfolioModerationGrid items={portfolio} emptyTitle="No portfolio items" emptyDescription="Samples the creator uploads appear here for review." />
          </DetailCard>
        </div>
        <aside className="space-y-6">
          <CreatorActionsPanel creator={c} />
          <CreatorSetupCard creatorId={c.id} />
          <CreatorAccountCard creator={c} />
        </aside>
      </div>

      <CreatorEditDialog creator={c} open={editing} onOpenChange={setEditing} />
    </>
  )
}
