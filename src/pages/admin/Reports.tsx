import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatNumber } from '@/lib/format'
import { listReports } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { FilterBar, FilterField } from '@/components/admin/filter-bar'
import { REPORT_STATUS_META, REPORT_TARGET_LABEL, metaOptions } from '@/components/admin/admin-status'
import { useReportTable } from '@/components/admin/report-parts'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'
import type { ReportStatus, ReportTarget } from '@/types'

const PAGE_SIZE = 25
const STATUS_OPTIONS = metaOptions(REPORT_STATUS_META)
const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value)
const TARGET_OPTIONS = (Object.keys(REPORT_TARGET_LABEL) as ReportTarget[]).map((value) => ({ value, label: REPORT_TARGET_LABEL[value] }))
const TARGET_VALUES = TARGET_OPTIONS.map((o) => o.value)

export default function Reports() {
  const url = useUrlState()
  const rawStatus = url.get('status')
  const status: ReportStatus | '' = isOneOf(STATUS_VALUES, rawStatus) ? rawStatus : ''
  const rawTarget = url.get('target')
  const targetType: ReportTarget | '' = isOneOf(TARGET_VALUES, rawTarget) ? rawTarget : ''

  const params = { status, targetType, page: url.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: qk.admin.reports(params),
    queryFn: () => listReports(params),
    placeholderData: keepPreviousData,
  })
  const { columns, dialog } = useReportTable()

  const activeCount = [status, targetType].filter(Boolean).length
  const reset = () => url.update({ status: null, target: null })

  return (
    <>
      <Seo title="Reports" noindex />
      <PageHeader
        eyebrow="Trust & safety"
        title="Reports"
        description={query.data ? `${formatNumber(query.data.total)} ${activeCount ? 'matching ' : ''}reports from brands and creators.` : 'Profiles, messages and content flagged by the community.'}
      />

      <FilterBar activeCount={activeCount} onReset={reset}>
        <FilterField label="Status" htmlFor="report-status">
          <Select id="report-status" size="sm" value={status} onValueChange={(v) => url.update({ status: v })} options={STATUS_OPTIONS} anyLabel="All statuses" />
        </FilterField>
        <FilterField label="Reported item" htmlFor="report-target">
          <Select id="report-target" size="sm" value={targetType} onValueChange={(v) => url.update({ target: v })} options={TARGET_OPTIONS} anyLabel="Anything" />
        </FilterField>
      </FilterBar>

      <DataTable
        className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
        columns={columns}
        rows={query.data?.items}
        rowKey={(r) => r.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        mobilePrimary="reason"
        empty={
          <EmptyState
            icon={<Flag />}
            title={activeCount ? 'No reports match these filters' : 'No reports yet'}
            description={activeCount ? 'Try another status or item type.' : 'When brands or creators flag something, it lands here for review.'}
            action={
              activeCount ? (
                <Button variant="secondary" size="sm" onClick={reset}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild variant="secondary" size="sm">
                  <Link to="/admin/content">Review content instead</Link>
                </Button>
              )
            }
          />
        }
        pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'reports' } : undefined}
      />
      {dialog}
    </>
  )
}
