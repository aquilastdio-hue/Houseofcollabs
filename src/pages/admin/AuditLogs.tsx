import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDateTime, formatNumber, formatRelative, titleCase } from '@/lib/format'
import { listAuditLogs, type AuditLogItem } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { RoleBadge } from '@/components/admin/admin-status'
import { IdText } from '@/components/admin/detail'
import { JsonDialogButton, isEmptyJson } from '@/components/admin/json-view'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'

const PAGE_SIZE = 50

/** Entity types written by `private.audit()` across the migrations. */
const ENTITY_TYPES = [
  'order', 'payment', 'payout_request', 'payout_method', 'creator', 'brand', 'profile',
  'brief', 'review', 'report', 'conversation', 'notification', 'contact_message',
] as const

const ENTITY_OPTIONS = ENTITY_TYPES.map((value) => ({ value, label: titleCase(value.replace(/_/g, ' ')) }))

/** Where an audited entity lives in the admin panel, when it has its own page. */
const ENTITY_LINK: Partial<Record<(typeof ENTITY_TYPES)[number], (id: string) => string>> = {
  order: (id) => `/admin/orders/${id}`,
  creator: (id) => `/admin/creators/${id}`,
  brand: (id) => `/admin/brands/${id}`,
}

/** Money/state changes worth spotting at a glance in a long list. */
const NOTABLE = /^(admin_|payout_|refund_|payment_|.*_soft_deleted$)/

function ActionCell({ action }: { action: string }) {
  return (
    <Badge tone={NOTABLE.test(action) ? 'warning' : 'neutral'} size="sm" className="font-mono">
      {action}
    </Badge>
  )
}

function ActorCell({ row }: { row: AuditLogItem }) {
  if (!row.actor) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-muted">System</span>
        <RoleBadge role={row.actor_role} />
      </span>
    )
  }
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-2">
        <span className="truncate font-medium">{row.actor.full_name ?? 'Unnamed'}</span>
        <RoleBadge role={row.actor_role} />
      </span>
      <span className="truncate text-xs text-muted">{row.actor.email}</span>
    </span>
  )
}

function EntityCell({ row }: { row: AuditLogItem }) {
  if (!row.entity_type) return <span className="text-faint">—</span>
  const href = row.entity_id && isOneOf(ENTITY_TYPES, row.entity_type) ? ENTITY_LINK[row.entity_type]?.(row.entity_id) : undefined
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-medium">{titleCase(row.entity_type.replace(/_/g, ' '))}</span>
      {row.entity_id &&
        (href ? (
          <Link to={href} className="focus-ring truncate rounded-sm font-mono text-xs text-sky underline-offset-2 hover:underline">
            {row.entity_id.slice(0, 8)}
          </Link>
        ) : (
          <IdText value={row.entity_id} />
        ))}
    </span>
  )
}

const COLUMNS: Column<AuditLogItem>[] = [
  {
    key: 'created_at',
    header: 'When',
    mobileLabel: 'When',
    className: 'whitespace-nowrap',
    cell: (row) => (
      <span className="flex flex-col gap-0.5">
        <span className="text-xs font-medium">{formatDateTime(row.created_at)}</span>
        <span className="text-xs text-muted">{formatRelative(row.created_at)}</span>
      </span>
    ),
  },
  { key: 'action', header: 'Action', mobileLabel: 'Action', cell: (row) => <ActionCell action={row.action} /> },
  { key: 'actor', header: 'Actor', mobileLabel: 'Actor', cell: (row) => <ActorCell row={row} />, hideOnMobile: true },
  { key: 'entity', header: 'Entity', mobileLabel: 'Entity', cell: (row) => <EntityCell row={row} /> },
  {
    key: 'metadata',
    header: 'Details',
    mobileLabel: 'Details',
    headerClassName: 'text-right',
    className: 'text-right',
    cell: (row) =>
      isEmptyJson(row.metadata) ? (
        <span className="text-faint">—</span>
      ) : (
        <JsonDialogButton value={row.metadata} title={row.action} description={`Recorded ${formatDateTime(row.created_at)}.`} label="Metadata" />
      ),
  },
]

export default function AuditLogs() {
  const url = useUrlState()
  const action = url.get('action')
  const rawEntity = url.get('entity')
  const entityType = isOneOf(ENTITY_TYPES, rawEntity) ? rawEntity : ''
  const from = url.get('from')
  const to = url.get('to')

  const params = {
    action,
    entityType,
    // `to` is a plain date; include the whole day.
    from: from ? `${from}T00:00:00.000Z` : '',
    to: to ? `${to}T23:59:59.999Z` : '',
    page: url.page,
    pageSize: PAGE_SIZE,
  }
  const query = useQuery({
    queryKey: qk.admin.auditLogs(params),
    queryFn: () => listAuditLogs(params),
    placeholderData: keepPreviousData,
  })

  const activeCount = [action, entityType, from, to].filter(Boolean).length
  const reset = () => url.update({ action: null, entity: null, from: null, to: null })

  return (
    <>
      <Seo title="Audit log" noindex />
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description={
          query.data
            ? `${formatNumber(query.data.total)} recorded ${activeCount ? 'matching ' : ''}${query.data.total === 1 ? 'event' : 'events'}. Written by the database — append-only and not editable from the app.`
            : 'Every profile change, order transition, payment and admin action, written by the database itself.'
        }
      />

      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        search={<SearchInput value={action} onCommit={(v) => url.update({ action: v })} placeholder="Search actions, e.g. payout or order_status" label="Search audit actions" />}
      >
        <FilterField label="Entity" htmlFor="audit-entity">
          <Select id="audit-entity" size="sm" value={entityType} onValueChange={(v) => url.update({ entity: v })} options={ENTITY_OPTIONS} anyLabel="All entities" />
        </FilterField>
        <FilterField label="From" htmlFor="audit-from">
          <DatePicker id="audit-from" value={from || null} onChange={(v) => url.update({ from: v })} placeholder="Any time" className="h-9 text-sm" />
        </FilterField>
        <FilterField label="To" htmlFor="audit-to">
          <DatePicker id="audit-to" value={to || null} onChange={(v) => url.update({ to: v })} placeholder="Now" className="h-9 text-sm" />
        </FilterField>
      </FilterBar>

      <DataTable
        className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
        columns={COLUMNS}
        rows={query.data?.items}
        rowKey={(r) => String(r.id)}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        mobilePrimary="action"
        empty={
          <EmptyState
            icon={<ScrollText />}
            title={activeCount ? 'No events match these filters' : 'No audit events yet'}
            description={
              activeCount
                ? 'Try a different action, entity or date range.'
                : 'Audit entries are written automatically as people sign up, order, pay and get paid.'
            }
            action={
              activeCount ? (
                <Button variant="secondary" size="sm" onClick={reset}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
        pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'events' } : undefined}
      />
    </>
  )
}
