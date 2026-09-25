import * as React from 'react'
import { CheckCircle2, Eye, RotateCcw, XCircle } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatDate, formatDateTime, formatRelative } from '@/lib/format'
import { updateReport, type AdminReportItem } from '@/services/admin.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import type { Column } from '@/components/shared/data-table'
import type { ReportStatus } from '@/types'
import { REPORT_STATUS_META, REPORT_TARGET_LABEL, RoleBadge, StatusBadge } from './admin-status'
import { adminLists } from './admin-keys'
import { CellLink, IdText } from './detail'
import { useAdminMutation } from './use-admin-mutation'

const TARGET_HREF: Partial<Record<AdminReportItem['target_type'], (id: string) => string>> = {
  creator: (id) => `/admin/creators/${id}`,
  brand: (id) => `/admin/brands/${id}`,
  order: (id) => `/admin/orders/${id}`,
}

type ReportAction = { report: AdminReportItem; next: ReportStatus }

const ACTION_COPY: Record<ReportStatus, { label: string; title: string; description: string; noteRequired: boolean; success: string }> = {
  under_review: {
    label: 'Review',
    title: 'Mark as under review?',
    description: 'Lets other admins know someone is looking into this report.',
    noteRequired: false,
    success: 'Report marked under review',
  },
  resolved: {
    label: 'Resolve',
    title: 'Resolve this report?',
    description: 'Use this when you took action (e.g. hid content or suspended an account). Record what you did.',
    noteRequired: true,
    success: 'Report resolved',
  },
  dismissed: {
    label: 'Dismiss',
    title: 'Dismiss this report?',
    description: 'Use this when no policy was broken. Record why for the audit trail.',
    noteRequired: true,
    success: 'Report dismissed',
  },
  open: {
    label: 'Reopen',
    title: 'Reopen this report?',
    description: 'Moves the report back to the open queue.',
    noteRequired: false,
    success: 'Report reopened',
  },
}

function nextActions(status: ReportStatus): ReportStatus[] {
  if (status === 'open') return ['under_review', 'resolved', 'dismissed']
  if (status === 'under_review') return ['resolved', 'dismissed']
  return ['open']
}

const ICONS: Record<ReportStatus, typeof Eye> = { under_review: Eye, resolved: CheckCircle2, dismissed: XCircle, open: RotateCcw }

/** Report table columns + a confirm dialog for status changes (with an admin note). */
export function useReportTable() {
  const [pending, setPending] = React.useState<ReportAction | null>(null)
  const update = useAdminMutation(({ report, next, note }: ReportAction & { note: string }) => updateReport(report.id, next, note || undefined), {
    invalidate: [adminLists.reports, qk.admin.stats],
    success: (_d, v) => ACTION_COPY[v.next].success,
    onSuccess: () => setPending(null),
  })

  const columns: Column<AdminReportItem>[] = [
    {
      key: 'target',
      header: 'Reported item',
      cell: (r) => {
        const href = TARGET_HREF[r.target_type]?.(r.target_id)
        return (
          <span className="flex min-w-0 flex-col items-start gap-1">
            <Badge tone="outline" size="sm">
              {REPORT_TARGET_LABEL[r.target_type]}
            </Badge>
            {href ? (
              <CellLink to={href} always className="font-mono text-xs">
                {r.target_id.slice(0, 8)}…
              </CellLink>
            ) : (
              <IdText value={r.target_id} className="max-w-40" />
            )}
          </span>
        )
      },
    },
    {
      key: 'reason',
      header: 'Reason',
      className: 'max-w-80',
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block font-medium">{r.reason}</span>
          {r.description && <span className="mt-0.5 line-clamp-2 block text-xs whitespace-pre-line text-muted">{r.description}</span>}
          {r.admin_note && <span className="mt-1 line-clamp-2 block text-xs text-ink-soft">Admin note: {r.admin_note}</span>}
        </span>
      ),
    },
    {
      key: 'reporter',
      header: 'Reporter',
      cell: (r) =>
        r.reporter ? (
          <span className="block min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate">{r.reporter.full_name || r.reporter.email || 'Unknown'}</span>
              {r.reporter.role && <RoleBadge role={r.reporter.role} />}
            </span>
            {r.reporter.full_name && r.reporter.email && <span className="block truncate text-xs text-muted">{r.reporter.email}</span>}
          </span>
        ) : (
          <span className="text-faint">Deleted account</span>
        ),
    },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge meta={REPORT_STATUS_META} value={r.status} size="sm" /> },
    {
      key: 'created',
      header: 'Date',
      className: 'whitespace-nowrap text-muted',
      cell: (r) => (
        <span title={formatDateTime(r.created_at)}>
          {formatDate(r.created_at)}
          <span className="block text-xs text-faint">{formatRelative(r.created_at)}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      mobileLabel: 'Actions',
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {nextActions(r.status).map((next) => {
            const Icon = ICONS[next]
            return (
              <Button key={next} size="xs" variant={next === 'resolved' ? 'primary' : next === 'dismissed' ? 'ghost' : 'secondary'} onClick={() => setPending({ report: r, next })}>
                <Icon /> {ACTION_COPY[next].label}
              </Button>
            )
          })}
        </span>
      ),
    },
  ]

  const copy = pending ? ACTION_COPY[pending.next] : null
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(o) => !o && setPending(null)}
      title={copy?.title ?? ''}
      description={
        pending ? (
          <>
            {copy?.description} <span className="font-medium text-ink">“{pending.report.reason}”</span> on a {REPORT_TARGET_LABEL[pending.report.target_type].toLowerCase()}.
          </>
        ) : undefined
      }
      confirmLabel={copy?.label === 'Review' ? 'Mark under review' : copy?.label}
      destructive={pending?.next === 'dismissed'}
      loading={update.isPending}
      reasonLabel="Admin note"
      reasonPlaceholder={pending?.next === 'resolved' ? 'What action did you take?' : pending?.next === 'dismissed' ? 'Why is no action needed?' : 'Optional context'}
      reasonRequired={copy?.noteRequired ?? false}
      onConfirm={(note) => {
        if (pending) update.mutate({ ...pending, note })
      }}
    />
  )

  return { columns, dialog }
}
