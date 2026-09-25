import { Link, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarClock, ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDate, formatINR, formatNumber, formatRelative } from '@/lib/format'
import { CONTENT_TYPES, labelFor } from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'
import { listBriefs, type BriefListParams } from '@/services/briefs.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { Seo } from '@/components/shared/seo'
import { CreatorSetupRequired, ListSkeleton } from '@/components/creator-studio/parts'
import { BRIEF_STATUS_META } from '@/components/creator-studio/status'

const PAGE_SIZE = 10

const TABS = [
  { value: 'sent', label: 'New', empty: 'New briefs from brands will show up here.' },
  { value: 'accepted', label: 'Accepted', empty: 'Briefs you accept will show up here.' },
  { value: 'rejected', label: 'Declined', empty: 'Briefs you decline will show up here.' },
  { value: 'completed', label: 'Completed', empty: 'Finished collaborations will show up here.' },
  { value: 'all', label: 'All', empty: 'When brands send you a brief, it will show up here.' },
] as const

type TabValue = (typeof TABS)[number]['value']
type BriefItem = Awaited<ReturnType<typeof listBriefs>>['items'][number]

function isTab(value: string | null): value is TabValue {
  return TABS.some((t) => t.value === value)
}

function BriefCard({ brief }: { brief: BriefItem }) {
  const meta = BRIEF_STATUS_META[brief.status]
  const details = [brief.brand.brand_name, brief.category?.name, brief.content_type ? labelFor(CONTENT_TYPES, brief.content_type) : null].filter(Boolean)
  return (
    <Link
      to={`/creator/briefs/${brief.id}`}
      className="group focus-ring flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition-[box-shadow,border-color] duration-300 hover:border-line-strong hover:shadow-card-hover sm:flex-row sm:items-center sm:p-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Avatar src={brief.brand.brand_logo_url} name={brief.brand.brand_name} size="lg" shape="rounded" />
        <div className="min-w-0">
          <p className="truncate font-medium">{brief.title}</p>
          <p className="truncate text-sm text-muted">{details.join(' · ')}</p>
          <p className="mt-1 text-xs text-faint">Received {formatRelative(brief.sent_at ?? brief.created_at)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <CalendarClock className="size-3.5" aria-hidden />
            {brief.deadline ? `Due ${formatDate(brief.deadline, 'd MMM yyyy')}` : 'Flexible deadline'}
          </span>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold tabular-nums">{brief.budget != null ? formatINR(brief.budget) : 'Open'}</p>
          <p className="text-xs text-muted">Budget</p>
        </div>
        <ChevronRight className="hidden size-5 text-faint transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden />
      </div>
    </Link>
  )
}

export default function Briefs() {
  const { creator } = useAuth()
  const [params, setParams] = useSearchParams()
  const requested = params.get('status')
  const tab: TabValue = isTab(requested) ? requested : 'sent'
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)

  const queryParams: BriefListParams = { scope: 'creator', ownerId: creator?.id ?? '', status: tab, page, pageSize: PAGE_SIZE }
  const briefs = useQuery({
    queryKey: qk.briefs.list(queryParams),
    queryFn: () => listBriefs(queryParams),
    enabled: !!creator,
    placeholderData: keepPreviousData,
  })

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

  const current = TABS.find((t) => t.value === tab)!
  let list: React.ReactNode
  if (briefs.isPending) {
    list = <ListSkeleton rows={4} itemClassName="h-24" />
  } else if (briefs.isError) {
    list = <ErrorState error={briefs.error} title="Couldn’t load your briefs" onRetry={() => void briefs.refetch()} />
  } else if (briefs.data.items.length === 0) {
    list = <EmptyState icon={<FileText />} title="No briefs yet" description={current.empty} />
  } else {
    list = (
      <div className={cn('space-y-4 transition-opacity', briefs.isPlaceholderData && 'opacity-60')} aria-busy={briefs.isFetching || undefined}>
        <p className="text-sm text-muted">
          {formatNumber(briefs.data.total)} brief{briefs.data.total === 1 ? '' : 's'}
        </p>
        <ul className="space-y-3">
          {briefs.data.items.map((brief) => (
            <li key={brief.id}>
              <BriefCard brief={brief} />
            </li>
          ))}
        </ul>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={briefs.data.total}
          label="briefs"
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
      <Seo title="Briefs" noindex />
      <PageHeader title="Briefs" description="Campaign briefs brands send you directly. Review the details and accept the ones that fit." />
      {!creator ? (
        <CreatorSetupRequired />
      ) : (
        <Tabs value={tab} onValueChange={(value) => update({ status: value === 'sent' ? null : value, page: null })}>
          <TabsList aria-label="Filter briefs">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-5">
              {t.value === tab ? list : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  )
}
