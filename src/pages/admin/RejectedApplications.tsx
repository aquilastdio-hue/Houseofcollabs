import * as React from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listApplications, type ApplicationRole, type ApplicationRow } from '@/services/applications.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'
import { ReviewDialog, applicationColumns, applicationKeys } from './Applications'

const PAGE_SIZE = 25

const ROLE_OPTIONS = [
  { value: 'creator', label: 'Creators' },
  { value: 'brand', label: 'Brands' },
] as const

/**
 * Applications that were turned down.
 *
 * They used to sit in the main queue alongside work that still needed doing,
 * which made it look permanently full. They are kept rather than deleted
 * because they answer "did we already look at this person?" when someone
 * applies again — so they get a page of their own instead of a filter.
 *
 * The table and the review dialog are the ones from the applications queue, so
 * a rejected application opens exactly as it did there, and can still be
 * approved from inside if the decision was wrong.
 */
export default function RejectedApplications() {
  const url = useUrlState()
  const [openRowSnapshot, setOpenRow] = React.useState<ApplicationRow | null>(null)
  const search = url.get('q')
  const rawRole = url.get('role')
  const role: ApplicationRole | '' = isOneOf(ROLE_OPTIONS.map((o) => o.value), rawRole) ? rawRole : ''

  const params = { status: 'rejected' as const, role, search, page: url.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: applicationKeys.list(params),
    queryFn: () => listApplications(params),
    placeholderData: keepPreviousData,
  })

  // Same reason as the queue: approving from inside the dialog moves the row
  // out of this list, and the dialog has to stay open to show the result.
  const openRow = openRowSnapshot
    ? (query.data?.items.find((a) => a.id === openRowSnapshot.id) ?? openRowSnapshot)
    : null

  const filtered = !!role || !!search

  return (
    <>
      <Seo title="Rejected applications" noindex />
      <PageHeader
        eyebrow="Accounts"
        title="Rejected"
        description="Applications that were turned down. Kept so you can tell when someone applies again — open one to review the decision, or approve it after all."
      />

      <div className="space-y-6">
        <FilterBar
          activeCount={role ? 1 : 0}
          onReset={() => url.update({ role: null })}
          search={
            <SearchInput
              value={search}
              onCommit={(q: string) => url.update({ q })}
              placeholder="Search name, email, brand, handle or referral code"
              label="Search rejected applications"
            />
          }
        >
          <FilterField label="Applied as" htmlFor="rejected-role">
            <Select id="rejected-role" size="sm" value={role} onValueChange={(v) => url.update({ role: v })} options={ROLE_OPTIONS} anyLabel="Everyone" />
          </FilterField>
        </FilterBar>

        <DataTable
          className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
          columns={applicationColumns}
          rows={query.data?.items}
          rowKey={(a) => a.id}
          loading={query.isPending}
          error={query.isError ? query.error : undefined}
          onRetry={() => void query.refetch()}
          onRowClick={setOpenRow}
          mobilePrimary="who"
          empty={
            <EmptyState
              icon={<UserX />}
              title={filtered ? 'No rejected applications match' : 'Nothing rejected'}
              description={filtered ? 'Try a different filter.' : 'Applications you turn down will be listed here.'}
              action={
                filtered ? (
                  <Button variant="secondary" size="sm" onClick={() => url.update({ role: null, q: null })}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
          pagination={
            query.data
              ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'rejected applications' }
              : undefined
          }
        />
      </div>

      <ReviewDialog row={openRow} onClose={() => setOpenRow(null)} />
    </>
  )
}
