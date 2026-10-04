import * as React from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCheck, Clock, Eye, Mail, MailX, MessageSquare, RefreshCw, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatDateTime, formatNumber, formatRelative, pluralize, titleCase } from '@/lib/format'
import {
  getEmailStats,
  listEmailDeliveries,
  retryQueuedEmails,
  sendTestEmail,
  previewEmail,
  type AdminEmailItem,
  type EmailDeliveryStatus,
  type EmailStats,
} from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorState } from '@/components/shared/states'
import { Tooltip } from '@/components/ui/tooltip'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { StatusBadge, metaOptions, type StatusMeta } from '@/components/admin/admin-status'
import { isOneOf } from '@/components/admin/admin-utils'
import { adminKeys } from '@/components/admin/admin-keys'
import { useAdminMutation } from '@/components/admin/use-admin-mutation'
import { useUrlState } from '@/components/admin/use-url-state'

const PAGE_SIZE = 25

/** Mirrors the `status` check constraint on public.email_deliveries. */
const EMAIL_STATUS_META: Record<EmailDeliveryStatus, StatusMeta> = {
  pending: { label: 'Queued', tone: 'warning' },
  processing: { label: 'Sending', tone: 'info' },
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'neutral' },
}
const STATUS_OPTIONS = metaOptions(EMAIL_STATUS_META)
const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value)

/** Mirrors `private.email_category()`. 'critical' ignores every opt-out. */
const CATEGORY_OPTIONS = [
  { value: 'critical', label: 'Critical (always sent)' },
  { value: 'orders', label: 'Order updates' },
  { value: 'payments', label: 'Earnings & payments' },
  { value: 'campaigns', label: 'Campaign updates' },
  { value: 'account', label: 'Account updates' },
  { value: 'marketing', label: 'Marketing' },
] as const
const CATEGORY_VALUES = CATEGORY_OPTIONS.map((o) => o.value)
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label.replace(' (always sent)', '')]))

/** `skipped` covers two very different outcomes; say which one. */
function skipReason(provider: string | null) {
  if (provider === 'console') return 'Logged only — no provider'
  if (provider === 'in-app') return 'In-app only'
  return 'Not sent'
}

const columns: Column<AdminEmailItem>[] = [
  {
    key: 'created',
    header: 'Created',
    className: 'whitespace-nowrap text-muted',
    cell: (e) => (
      <span>
        {formatDate(e.created_at, 'd MMM yyyy')}
        <span className="block text-xs text-faint">{formatDate(e.created_at, 'h:mm a')}</span>
      </span>
    ),
  },
  {
    key: 'recipient',
    header: 'Recipient',
    cell: (e) => (
      <span className="flex min-w-0 flex-col">
        <span className="max-w-44 truncate font-medium" title={e.recipient_email}>
          {e.recipient_email}
        </span>
        {e.user?.full_name && (
          <span className="max-w-44 truncate text-xs text-muted">
            {e.user.full_name}
            {e.user.role ? ` · ${titleCase(e.user.role)}` : ''}
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'type',
    header: 'Email type',
    cell: (e) => (
      <span className="flex min-w-0 flex-col items-start gap-1">
        <span className="font-mono text-xs">{e.email_type}</span>
        <Badge tone={e.category === 'critical' ? 'warning' : 'outline'} size="sm">
          {CATEGORY_LABEL[e.category] ?? titleCase(e.category)}
        </Badge>
      </span>
    ),
  },
  {
    key: 'subject',
    header: 'Subject',
    cell: (e) =>
      e.subject ? (
        <span className="block max-w-52 truncate" title={e.subject}>
          {e.subject}
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (e) => (
      <span className="flex flex-col items-start gap-1">
        <StatusBadge meta={EMAIL_STATUS_META} value={e.status} size="sm" />
        {e.status === 'skipped' && <span className="text-xs text-faint">{skipReason(e.provider)}</span>}
      </span>
    ),
  },
  {
    key: 'attempts',
    header: 'Attempts',
    mobileLabel: 'Retry attempts',
    className: 'tabular-nums whitespace-nowrap',
    cell: (e) => (
      <span className={cn(e.attempts >= e.max_attempts && e.status === 'failed' && 'font-medium text-danger')}>
        {e.attempts} / {e.max_attempts}
      </span>
    ),
  },
  {
    key: 'sent',
    header: 'Sent',
    className: 'whitespace-nowrap',
    cell: (e) => {
      if (e.sent_at) {
        return (
          <span className="text-muted">
            {formatDate(e.sent_at, 'd MMM, h:mm a')}
            {e.provider && <span className="block text-xs text-faint">via {e.provider}</span>}
          </span>
        )
      }
      if (e.status === 'failed' && e.attempts >= e.max_attempts) return <span className="text-xs text-danger">Gave up</span>
      if (e.status === 'skipped') return <span className="text-xs text-faint">Never sent</span>
      return <span className="text-xs text-muted">Retries {formatRelative(e.next_attempt_at)}</span>
    },
  },
  {
    key: 'preview',
    header: '',
    mobileLabel: 'Preview',
    className: 'w-px whitespace-nowrap',
    cell: () => (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink">
        <Eye className="size-3.5" /> Preview
      </span>
    ),
  },
  {
    key: 'reason',
    header: 'Reason',
    mobileLabel: 'Failure reason',
    cell: (e) =>
      e.last_error ? (
        <Tooltip content={e.last_error}>
          <span className="flex max-w-48 items-center gap-1 text-danger">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="truncate text-xs" title={e.last_error}>
              {e.last_error}
            </span>
          </span>
        </Tooltip>
      ) : e.provider_message_id ? (
        <span className="block max-w-40 truncate font-mono text-xs text-faint" title={e.provider_message_id}>
          {e.provider_message_id}
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
]

/**
 * Shows the email exactly as its recipient sees it. The HTML comes back from
 * the same render path the sender uses, and is displayed in a sandboxed iframe
 * so the email's own styles can't touch the admin page.
 */
function EmailPreviewDialog({ row, onClose }: { row: AdminEmailItem | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: adminKeys.emailPreview(row?.id ?? ''),
    queryFn: () => previewEmail(row!.id),
    enabled: !!row,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Modal
      open={!!row}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title="Email preview"
      description={row ? `Addressed to ${row.recipient_email}` : undefined}
    >
      {query.isPending && <Skeleton className="h-96 rounded-card" />}
      {query.isError && <ErrorState error={query.error} title="Couldn’t render this email" onRetry={() => void query.refetch()} />}
      {query.data &&
        (query.data.inAppOnly ? (
          <EmptyState
            icon={<MessageSquare />}
            title="This one is in-app only"
            description="In-app replies are never emailed — an email per reply would be spam. The recipient sees it in their notification bell."
          />
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 rounded-card border border-line bg-subtle p-4 text-sm sm:grid-cols-[6rem_minmax(0,1fr)]">
              <dt className="font-medium text-muted">To</dt>
              <dd className="min-w-0 break-words">{query.data.to}</dd>
              <dt className="font-medium text-muted">Subject</dt>
              <dd className="min-w-0 font-medium break-words">{query.data.subject}</dd>
            </dl>

            <Tabs defaultValue="html">
              <TabsList>
                <TabsTrigger value="html">Rendered</TabsTrigger>
                <TabsTrigger value="text">Plain text</TabsTrigger>
              </TabsList>
              <TabsContent value="html">
                <iframe
                  title={`Email preview: ${query.data.subject ?? ''}`}
                  srcDoc={query.data.html ?? ''}
                  sandbox=""
                  className="h-[28rem] w-full rounded-card border border-line bg-white"
                />
              </TabsContent>
              <TabsContent value="text">
                <pre className="h-[28rem] overflow-auto rounded-card border border-line bg-subtle p-4 text-xs whitespace-pre-wrap">{query.data.text}</pre>
              </TabsContent>
            </Tabs>
          </div>
        ))}
    </Modal>
  )
}

/**
 * Says plainly what is and isn't working. Two things have to be true before an
 * email reaches anyone: the database must be able to call the Edge Function
 * (pg_net + Vault), and the function must have a real provider. `console` only
 * writes a log line, so showing those as "Sent" would claim a delivery that
 * never happened.
 */
function ProviderBanner({ stats, loading }: { stats: EmailStats | undefined; loading: boolean }) {
  if (loading || !stats) return <Skeleton className="h-20 rounded-card" />

  const state = !stats.auto_dispatch
    ? {
        tone: 'danger' as const,
        title: 'Automatic sending is off',
        body: 'The database cannot reach the email function, so queued emails only go out when someone presses “Retry queued”. Enable the pg_net extension and set the project_url and notification_webhook_secret Vault secrets.',
      }
    : stats.provider === null
      ? {
          tone: 'warning' as const,
          title: 'No email provider configured',
          body: 'Events are queued and dispatched correctly, but the function is in console mode — it logs each email instead of sending it, and records it as “Skipped”. Set EMAIL_PROVIDER=resend and RESEND_API_KEY in the Edge Function secrets to start sending.',
        }
      : {
          tone: 'ok' as const,
          title: `Sending through ${stats.provider}`,
          body: 'The database dispatches each email as soon as the event happens, and a worker retries anything that fails every five minutes.',
        }

  return (
    <Card
      className={cn(
        'flex items-start gap-3 p-4',
        state.tone === 'danger' && 'border-danger/40 bg-danger-soft',
        state.tone === 'warning' && 'border-warning/40 bg-warning-soft',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4',
          state.tone === 'ok' ? 'bg-success-soft text-success-ink' : state.tone === 'warning' ? 'bg-white/70 text-warning-ink' : 'bg-white/70 text-danger',
        )}
      >
        {state.tone === 'ok' ? <CheckCheck /> : <MailX />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{state.title}</p>
        <p className="text-sm text-muted">{state.body}</p>
      </div>
    </Card>
  )
}

export default function Emails() {
  const url = useUrlState()
  const [preview, setPreview] = React.useState<AdminEmailItem | null>(null)
  const search = url.get('q')
  const rawStatus = url.get('status')
  const rawCategory = url.get('category')
  const status: EmailDeliveryStatus | '' = isOneOf(STATUS_VALUES, rawStatus) ? rawStatus : ''
  const category = isOneOf(CATEGORY_VALUES, rawCategory) ? rawCategory : ''

  const stats = useQuery({ queryKey: adminKeys.emailStats, queryFn: getEmailStats })

  const params = { status, category, search, page: url.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: adminKeys.emails(params),
    queryFn: () => listEmailDeliveries(params),
    placeholderData: keepPreviousData,
  })

  const refreshKeys = [adminKeys.emailsAll, adminKeys.emailStats]

  const retry = useAdminMutation(() => retryQueuedEmails(50), {
    invalidate: refreshKeys,
    success: (r) =>
      r.claimed === 0 ? 'Nothing was waiting to send' : `Retried ${formatNumber(r.claimed)} ${pluralize(r.claimed, 'email')} · ${formatNumber(r.sent)} sent`,
  })

  const test = useAdminMutation(sendTestEmail, {
    invalidate: refreshKeys,
    success: (r) => (r.provider === 'console' ? 'Logged only — no provider is configured yet' : `Test email sent via ${r.provider}`),
  })

  const s = stats.data
  const filtered = !!status || !!category || !!search
  const activeFilters = (status ? 1 : 0) + (category ? 1 : 0)

  return (
    <>
      <Seo title="Email log" noindex />
      <PageHeader
        eyebrow="Platform"
        title="Email log"
        description="Every transactional email the platform has queued, with its delivery status. Rows are written by the database when an event creates a notification — nothing here is sent by hand."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" loading={test.isPending} onClick={() => test.mutate()}>
              <Send /> Send test to me
            </Button>
            <Button size="sm" loading={retry.isPending} disabled={!s || s.retryable === 0} onClick={() => retry.mutate()}>
              <RefreshCw /> Retry queued{s && s.retryable > 0 ? ` (${formatNumber(s.retryable)})` : ''}
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <ProviderBanner stats={s} loading={stats.isPending} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Sent"
            value={formatNumber(s?.sent)}
            icon={<CheckCheck />}
            tone="brand"
            loading={stats.isPending}
            hint={s ? `${formatNumber(s.sent_24h)} in the last 24 hours` : undefined}
          />
          <StatsCard
            label="Queued"
            value={formatNumber(s?.pending)}
            icon={<Clock />}
            loading={stats.isPending}
            hint={s ? `${formatNumber(s.retryable)} due now · worker runs every 5 min` : undefined}
          />
          <StatsCard
            label="Failed"
            value={formatNumber(s?.failed)}
            icon={<AlertTriangle />}
            loading={stats.isPending}
            hint={s ? `${formatNumber(s.exhausted)} out of attempts · ${formatNumber(s.failed_24h)} in 24h` : undefined}
          />
          <StatsCard
            label="Total logged"
            value={formatNumber(s?.total)}
            icon={<Mail />}
            loading={stats.isPending}
            hint={s ? `${formatNumber(s.skipped)} skipped — in-app only or no provider` : undefined}
          />
        </div>

        <FilterBar
          activeCount={activeFilters}
          onReset={() => url.update({ status: null, category: null })}
          search={<SearchInput value={search} onCommit={(q) => url.update({ q })} placeholder="Search recipient, subject or type" label="Search emails" />}
        >
          <FilterField label="Status" htmlFor="email-status">
            <Select id="email-status" size="sm" value={status} onValueChange={(v) => url.update({ status: v })} options={STATUS_OPTIONS} anyLabel="All statuses" />
          </FilterField>
          <FilterField label="Category" htmlFor="email-category">
            <Select id="email-category" size="sm" value={category} onValueChange={(v) => url.update({ category: v })} options={CATEGORY_OPTIONS} anyLabel="All categories" />
          </FilterField>
        </FilterBar>

        <DataTable
          className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(e) => e.id}
          loading={query.isPending}
          error={query.isError ? query.error : undefined}
          onRetry={() => void query.refetch()}
          onRowClick={setPreview}
          mobilePrimary="recipient"
          empty={
            <EmptyState
              icon={<Mail />}
              title={filtered ? 'No emails match' : 'No emails yet'}
              description={
                filtered
                  ? 'Try a different status or clear the filters.'
                  : 'Emails are queued automatically when an order, payment or account event creates a notification.'
              }
              action={
                filtered ? (
                  <Button variant="secondary" size="sm" onClick={() => url.update({ status: null, category: null, q: null })}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
          pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'emails' } : undefined}
        />

        <p className="text-xs text-muted">
          Select any row to see the email exactly as its recipient receives it.
          {s?.last_sent_at ? ` Last delivery ${formatDateTime(s.last_sent_at)}.` : ''}
        </p>
      </div>

      <EmailPreviewDialog row={preview} onClose={() => setPreview(null)} />
    </>
  )
}
