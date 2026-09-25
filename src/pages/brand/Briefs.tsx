import { Link, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileText, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { useAuth } from '@/contexts/auth-context'
import { listBriefs, type BriefListParams } from '@/services/briefs.service'
import type { BriefStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { BrandMissing } from '@/components/brand/brand-missing'
import { patchParams, readPage, UrlSearchField } from '@/components/brand/url-search-field'
import { BriefCard, BriefListSkeleton } from '@/components/briefs/brief-card'
import { BRIEF_STATUS_FILTERS } from '@/components/briefs/brief-status'

const PAGE_SIZE = 10

const EMPTY_COPY: Record<BriefStatus | 'all', { title: string; description: string }> = {
  all: {
    title: 'No briefs yet',
    description: 'Write a brief once — objectives, deliverables, talking points and files — and share it with any creator.',
  },
  draft: { title: 'No drafts', description: 'Briefs you haven’t sent to a creator yet appear here.' },
  sent: { title: 'No briefs awaiting a reply', description: 'Briefs you’ve sent that the creator hasn’t answered yet appear here.' },
  accepted: { title: 'No accepted briefs yet', description: 'When a creator accepts your brief, you’ll find it here ready to hire.' },
  rejected: { title: 'No declined briefs', description: 'Briefs a creator passed on appear here so you can send them to someone else.' },
  completed: { title: 'No completed briefs yet', description: 'Briefs whose collaboration has finished are kept here for reference.' },
}

export default function Briefs() {
  const { brand } = useAuth()
  const [sp, setSp] = useSearchParams()
  const requested = sp.get('status')
  const status = BRIEF_STATUS_FILTERS.find((f) => f.value === requested)?.value ?? 'all'
  const q = (sp.get('q') ?? '').trim()
  const page = readPage(sp)

  const params: BriefListParams = { scope: 'brand', ownerId: brand?.id ?? '', status, search: q || undefined, page, pageSize: PAGE_SIZE }
  const briefs = useQuery({
    queryKey: qk.briefs.list(params),
    queryFn: () => listBriefs(params),
    enabled: !!brand,
    placeholderData: keepPreviousData,
  })

  const setStatus = (value: string) => setSp((prev) => patchParams(prev, { status: value === 'all' ? null : value, page: null }))
  const setPage = (next: number) => {
    setSp((prev) => patchParams(prev, { page: next > 1 ? String(next) : null }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const clearSearch = () => setSp((prev) => patchParams(prev, { q: null, page: null }), { replace: true })

  const newBrief = (
    <Button asChild>
      <Link to="/brand/briefs/new">
        <Plus /> New brief
      </Link>
    </Button>
  )
  const header = (
    <PageHeader
      title="Briefs"
      description="Share campaign goals, deliverables and guardrails with creators before you hire."
      actions={brand ? newBrief : undefined}
    />
  )

  if (!brand) {
    return (
      <>
        <Seo title="Briefs" noindex />
        {header}
        <BrandMissing />
      </>
    )
  }

  const renderContent = () => {
    if (briefs.isPending) return <BriefListSkeleton count={4} />
    if (briefs.isError) return <ErrorState error={briefs.error} onRetry={() => void briefs.refetch()} />
    const { items, total } = briefs.data
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
            title={`No briefs match “${q}”`}
            description="Search looks at brief titles. Try a shorter word."
            action={
              <Button variant="secondary" size="sm" onClick={clearSearch}>
                Clear search
              </Button>
            }
          />
        )
      }
      const copy = EMPTY_COPY[status]
      return (
        <EmptyState
          icon={<FileText />}
          title={copy.title}
          description={copy.description}
          action={
            status === 'all' || status === 'draft' ? (
              newBrief
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setStatus('all')}>
                View all briefs
              </Button>
            )
          }
        />
      )
    }
    return (
      <div className="space-y-6">
        <ul className={cn('space-y-3 transition-opacity', briefs.isPlaceholderData && 'opacity-60')} aria-busy={briefs.isFetching || undefined}>
          {items.map((brief) => (
            <li key={brief.id}>
              <BriefCard brief={brief} perspective="brand" />
            </li>
          ))}
        </ul>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} label="briefs" />
      </div>
    )
  }

  return (
    <>
      <Seo title="Briefs" noindex />
      {header}
      <Tabs value={status} onValueChange={setStatus}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList aria-label="Filter briefs by status">
            {BRIEF_STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <UrlSearchField label="Search briefs" placeholder="Search brief titles" />
        </div>
        <TabsContent value={status} className="mt-6">
          {renderContent()}
        </TabsContent>
      </Tabs>
    </>
  )
}
