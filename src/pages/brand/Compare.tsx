import * as React from 'react'
import { Link } from 'react-router'
import { GitCompareArrows, Plus, TriangleAlert } from 'lucide-react'
import { MAX_COMPARE, useCompare } from '@/contexts/compare-context'
import { useCreatorsByIds } from '@/hooks/use-creators'
import type { CreatorProfile } from '@/services/creators.service'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { CompareTable, CompareTableSkeleton } from '@/components/marketplace/compare-table'

export default function Compare() {
  const { items, remove, clear } = useCompare()
  const ids = React.useMemo(() => items.map((i) => i.id), [items])
  const query = useCreatorsByIds(ids)

  // Keep showing already-loaded creators while a smaller selection refetches.
  const [loaded, setLoaded] = React.useState<CreatorProfile[]>([])
  React.useEffect(() => {
    if (query.data) setLoaded(query.data)
  }, [query.data])

  const creators = query.data ?? loaded.filter((c) => ids.includes(c.id))
  const cachedAll = ids.every((id) => loaded.some((c) => c.id === id))
  const missing = query.data ? ids.filter((id) => !query.data.some((c) => c.id === id)) : []
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? 'A creator'

  let content: React.ReactNode
  if (items.length < 2) {
    content = <NeedMore picked={items.map((i) => i.name)} />
  } else if (query.isError) {
    content = <ErrorState error={query.error} title="We couldn’t load these creators" onRetry={() => void query.refetch()} />
  } else if (query.isPending && !cachedAll) {
    content = <CompareTableSkeleton columns={Math.min(items.length, 3)} />
  } else {
    content = (
      <>
        {missing.length > 0 && (
          <div className="mb-4 flex flex-col gap-3 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {missing.length === 1 ? `${nameOf(missing[0]!)} is` : `${missing.length} creators are`} no longer available to compare.
            </p>
            <Button size="xs" variant="secondary" onClick={() => missing.forEach(remove)}>
              Remove from compare
            </Button>
          </div>
        )}
        {creators.length < 2 ? (
          <NeedMore picked={creators.map((c) => c.display_name)} />
        ) : (
          <>
            <p className="mb-3 flex items-center gap-2 text-sm text-muted">
              <span className="inline-block h-3 w-6 rounded-pill bg-brand" aria-hidden />
              Highlighted values are the best in each row — lowest price, fastest delivery, biggest audience, top rating.
            </p>
            <CompareTable creators={creators} onRemove={remove} />
          </>
        )}
      </>
    )
  }

  return (
    <div className="pb-24">
      <Seo title="Compare creators" noindex />
      <PageHeader
        title="Compare creators"
        description={`Prices, turnaround, audience and ratings side by side — up to ${MAX_COMPARE} creators.`}
        actions={
          <>
            {items.length > 0 && (
              <Button variant="ghost" onClick={clear}>
                Clear all
              </Button>
            )}
            {items.length < MAX_COMPARE && (
              <Button asChild variant="secondary">
                <Link to="/brand/creators">
                  <Plus /> Add creators
                </Link>
              </Button>
            )}
          </>
        }
      />
      {content}
    </div>
  )
}

function NeedMore({ picked }: { picked: string[] }) {
  return (
    <EmptyState
      icon={<GitCompareArrows />}
      title="Add creators to compare from the marketplace"
      description={
        picked.length === 1
          ? `You’ve picked ${picked[0]}. Add at least one more creator — up to ${MAX_COMPARE} — using the compare button on their card or profile.`
          : `Use the compare button on creator cards or profiles to line up 2–${MAX_COMPARE} creators side by side.`
      }
      action={
        <Button asChild>
          <Link to="/brand/creators">Find creators</Link>
        </Button>
      }
    />
  )
}
