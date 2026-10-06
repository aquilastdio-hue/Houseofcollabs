import * as React from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Building2, Check, Copy, Inbox, MailWarning, Sparkles, UserPlus } from 'lucide-react'
import { RatingStars } from '@/components/admin/rating-stars'
import { ApplicationSubmission } from '@/components/admin/application-detail'
import { rateApplication, setApplicationDiscover } from '@/services/admin.service'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDate, formatDateTime, formatNumber, formatRelative, titleCase } from '@/lib/format'
import {
  getApplicationStats,
  listApplications,
  reviewApplication,
  approveApplication,
  type ApprovalResult,
  type ApplicationRole,
  type ApplicationRow,
  type ApplicationStatus,
  type StatusFilter,
} from '@/services/applications.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/shared/stats-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { FilterBar, FilterField, SearchInput } from '@/components/admin/filter-bar'
import { isOneOf } from '@/components/admin/admin-utils'
import { useUrlState } from '@/components/admin/use-url-state'
import { useAdminMutation } from '@/components/admin/use-admin-mutation'

const PAGE_SIZE = 25

export const applicationKeys = {
  all: [...qk.admin.all, 'applications'] as const,
  list: (params: unknown) => [...qk.admin.all, 'applications', params] as const,
  stats: [...qk.admin.all, 'application-stats'] as const,
}

const STATUS_META: Record<ApplicationStatus, { label: string; tone: BadgeTone }> = {
  new: { label: 'New', tone: 'warning' },
  reviewing: { label: 'Reviewing', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}
// Rejected lives on its own page, so it is not offered here — the queue is for
// applications still waiting on a decision.
const STATUS_OPTIONS = [
  ...(Object.keys(STATUS_META) as ApplicationStatus[])
    .filter((v) => v !== 'rejected')
    .map((v) => ({ value: v, label: STATUS_META[v].label })),
  { value: 'all', label: 'All statuses' },
]
const ROLE_OPTIONS = [
  { value: 'creator', label: 'Creators' },
  { value: 'brand', label: 'Brands' },
] as const

export const applicationColumns: Column<ApplicationRow>[] = [
  {
    key: 'created',
    header: 'Received',
    className: 'whitespace-nowrap text-muted',
    cell: (a) => (
      <span>
        {formatDate(a.created_at, 'd MMM yyyy')}
        <span className="block text-xs text-faint">{formatRelative(a.created_at)}</span>
      </span>
    ),
  },
  {
    key: 'who',
    header: 'Applicant',
    cell: (a) => (
      <span className="flex min-w-0 flex-col">
        <span className="max-w-48 truncate font-medium">{a.role === 'brand' ? (a.brand_name ?? a.full_name) : a.full_name}</span>
        <span className="max-w-48 truncate text-xs text-muted">{a.email}</span>
      </span>
    ),
  },
  {
    key: 'role',
    header: 'Applying as',
    cell: (a) => (
      <Badge tone={a.role === 'brand' ? 'sky' : 'lilac'} size="sm">
        {a.role === 'brand' ? <Building2 /> : <Sparkles />} {titleCase(a.role)}
      </Badge>
    ),
  },
  {
    key: 'detail',
    header: 'Details',
    cell: (a) =>
      a.role === 'creator' ? (
        <span className="flex min-w-0 flex-col text-sm">
          <span className="truncate">{a.social_handle ? `@${a.social_handle}` : '—'}</span>
          <span className="text-xs text-muted">
            {a.followers_count != null ? `${formatNumber(a.followers_count)} followers` : 'Followers not given'}
            {a.video_path ? ' · video' : ''}
          </span>
        </span>
      ) : (
        <span className="flex min-w-0 flex-col text-sm">
          <span className="max-w-44 truncate">{a.website ?? '—'}</span>
          <span className="text-xs text-muted">{a.budget_range ? titleCase(a.budget_range.replace(/_/g, ' ')) : 'Budget not given'}</span>
        </span>
      ),
  },
  { key: 'city', header: 'City', cell: (a) => a.city ?? <span className="text-faint">—</span> },
  {
    key: 'status',
    header: 'Status',
    cell: (a) => {
      const meta = STATUS_META[a.status as ApplicationStatus]
      return (
        <Badge tone={meta.tone} size="sm" dot>
          {meta.label}
        </Badge>
      )
    },
  },
  { key: 'open', header: '', className: 'w-px whitespace-nowrap', cell: () => <span className="text-xs font-medium text-brand-ink">Review</span> },
]

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  )
}

/**
 * Shown once an account exists. A link to pass on by hand only appears when the
 * email didn't go out — no point handing an admin a one-time link nobody needs.
 */
function ApprovalPanel({ result }: { result: ApprovalResult }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className="space-y-3 rounded-card border border-success/30 bg-success-soft p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-success">
        <Check className="size-4 shrink-0" aria-hidden />
        {result.created ? 'Account created' : 'They already had an account'} — they can sign in as a {result.role}.
      </p>

      {result.emailed ? (
        <p className="text-sm text-ink-soft">
          {result.invited
            ? 'We’ve emailed them an invitation to set their password.'
            : 'They already had an account, so we’ve emailed them a password-reset link instead of a new invitation.'}
        </p>
      ) : (
        <p className="flex items-start gap-2 text-sm text-warning">
          <MailWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
          {result.emailError ?? 'We couldn’t email them.'} Send them this link yourself — it expires, so generate a fresh one by
          approving again if it lapses.
        </p>
      )}

      {result.inviteLink && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={result.inviteLink}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 font-mono text-xs"
            aria-label="Password set-up link"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(result.inviteLink!)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      )}
    </div>
  )
}

export function ReviewDialog({ row, onClose }: { row: ApplicationRow | null; onClose: () => void }) {
  const [decision, setDecision] = React.useState<ApplicationStatus | null>(null)
  const [approval, setApproval] = React.useState<ApprovalResult | null>(null)

  // Approving is more than a status change: it creates the account behind the
  // application, so it goes through the Edge Function rather than the RPC the
  // other two decisions use.
  // The rating decides where this creator lands on the public creators page
  // once approved. It is never shown to them — `creator_rankings` has no grants
  // outside the admin RPCs.
  const rate = useAdminMutation((rating: number | null) => rateApplication(row!.id, rating), {
    invalidate: [applicationKeys.all],
    success: (_d, rating) => (rating ? `Rated ${rating}/5` : 'Rating cleared'),
  })

  const discover = useAdminMutation((pick: boolean) => setApplicationDiscover(row!.id, pick), {
    invalidate: [applicationKeys.all],
    success: (_d, pick) => (pick ? 'Added to Discover' : 'Removed from Discover'),
  })

  const approve = useAdminMutation(() => approveApplication(row!.id), {
    invalidate: [applicationKeys.all, applicationKeys.stats],
    success: (r) => (r.emailed ? 'Approved and invited' : 'Approved — send them the link'),
    onSuccess: (r) => setApproval(r),
  })

  const review = useAdminMutation(
    (vars: { status: ApplicationStatus; reason?: string }) => reviewApplication(row!.id, vars.status, vars.reason),
    {
      invalidate: [applicationKeys.all, applicationKeys.stats],
      success: (_d, v) => `Marked as ${STATUS_META[v.status].label.toLowerCase()}`,
      onSuccess: () => {
        setDecision(null)
        onClose()
      },
    },
  )

  if (!row) return null
  const isCreator = row.role === 'creator'

  return (
    <>
      <Modal open={!!row} onOpenChange={(o) => !o && onClose()} size="lg" title={isCreator ? row.full_name : (row.brand_name ?? row.full_name)}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={row.role === 'brand' ? 'sky' : 'lilac'} size="sm">
              {titleCase(row.role)}
            </Badge>
            <Badge tone={STATUS_META[row.status as ApplicationStatus].tone} size="sm" dot>
              {STATUS_META[row.status as ApplicationStatus].label}
            </Badge>
            <span className="text-xs text-muted">Received {formatDateTime(row.created_at)}</span>
          </div>

          <dl className="divide-y divide-line">
            <Line label="Contact">
              {row.full_name} · <a href={`mailto:${row.email}`} className="underline underline-offset-2">{row.email}</a>
              {row.phone ? ` · ${row.phone}` : ''}
            </Line>
            {row.city && <Line label="City">{row.city}</Line>}

            {isCreator ? (
              <>
                <Line label="Platform">
                  {row.social_platform ? titleCase(row.social_platform) : '—'}
                  {row.social_handle ? ` · @${row.social_handle}` : ''}
                </Line>
                <Line label="Followers">{row.followers_count != null ? formatNumber(row.followers_count) : '—'}</Line>
                {row.categories?.length ? <Line label="Creates">{row.categories.join(', ')}</Line> : null}
                {row.bio && <Line label="About">{row.bio}</Line>}
                {row.portfolio_url && (
                  <Line label="Portfolio">
                    <a href={row.portfolio_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {row.portfolio_url}
                    </a>
                  </Line>
                )}
              </>
            ) : (
              <>
                {row.website && (
                  <Line label="Website">
                    <a href={row.website} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {row.website}
                    </a>
                  </Line>
                )}
                {row.budget_range && <Line label="Budget">{titleCase(row.budget_range.replace(/_/g, ' '))}</Line>}
                {row.looking_for && <Line label="Looking for">{row.looking_for}</Line>}
              </>
            )}

            {row.message && <Line label="Note">{row.message}</Line>}
            {row.review_note && <Line label="Our note">{row.review_note}</Line>}
          </dl>

          {/* Everything else the form collected. Most of it lives in the
              `profile` jsonb rather than in columns, so it has to be rendered
              from there — otherwise the reviewer sees a fraction of what was
              actually submitted. */}
          <ApplicationSubmission row={row} />

          {row.role === 'creator' && (
            <div className="rounded-card border border-line bg-subtle p-4">
              <p className="text-sm font-medium text-ink">Your rating</p>
              <p className="mt-0.5 text-sm text-muted">
                Sets where they rank on the creators page once approved. Only visible here — never to the creator.
              </p>
              <div className="mt-3">
                <RatingStars value={row.admin_rating} onChange={(r) => rate.mutate(r)} disabled={rate.isPending} />
              </div>
            </div>
          )}

          {/* Approving waits on Supabase creating the account and the mail
              server accepting the invitation — a few seconds on a good day. A
              bare spinner on the button reads as a hang, so say what is
              happening while it runs. */}
          {approve.isPending && (
            <p className="flex items-start gap-2 rounded-card border border-line bg-subtle p-4 text-sm text-ink-soft">
              <Spinner className="mt-0.5 size-4 shrink-0" />
              Creating their account and sending the invitation — this takes a few seconds.
            </p>
          )}

          {approval && <ApprovalPanel result={approval} />}

          {!approval && row.profile_id && (
            <p className="rounded-card border border-line bg-subtle p-3 text-sm text-muted">
              This applicant already has an account. Approving again generates a fresh password link.
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button type="button" size="sm" loading={approve.isPending} onClick={() => approve.mutate()}>
              <UserPlus /> {row.profile_id ? 'Re-send set-up link' : 'Approve & create account'}
            </Button>

            {/* A toggle, not an action: it records the decision on the
                application and is applied when they are approved. Marking it
                before approving is the point — by the time a creator exists,
                the reviewer has already moved on. */}
            <Button
              type="button"
              size="sm"
              variant={row.discover ? 'accent' : 'secondary'}
              loading={discover.isPending}
              aria-pressed={!!row.discover}
              onClick={() => discover.mutate(!row.discover)}
            >
              <Sparkles /> {row.discover ? 'In Discover' : 'Discover'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={review.isPending && review.variables?.status === 'reviewing'}
              onClick={() => review.mutate({ status: 'reviewing' })}
            >
              Mark reviewing
            </Button>
            <Button type="button" size="sm" variant="danger-ghost" onClick={() => setDecision('rejected')}>
              Reject
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={decision === 'rejected'}
        onOpenChange={(o) => !o && setDecision(null)}
        title="Reject this application?"
        description="Add a short note for your own records. The applicant isn’t emailed automatically."
        confirmLabel="Reject"
        destructive
        reasonLabel="Reason"
        reasonRequired={false}
        loading={review.isPending}
        onConfirm={(reason) => review.mutate({ status: 'rejected', reason })}
      />
    </>
  )
}

export default function Applications() {
  const url = useUrlState()
  const [openRowSnapshot, setOpenRow] = React.useState<ApplicationRow | null>(null)
  const search = url.get('q')
  const rawStatus = url.get('status')
  const rawRole = url.get('role')
  const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value)
  const ROLE_VALUES = ROLE_OPTIONS.map((o) => o.value)
  const status: StatusFilter = isOneOf(STATUS_VALUES, rawStatus) ? (rawStatus as StatusFilter) : ''
  const role: ApplicationRole | '' = isOneOf(ROLE_VALUES, rawRole) ? rawRole : ''

  const stats = useQuery({ queryKey: applicationKeys.stats, queryFn: getApplicationStats })
  const params = { status, role, search, page: url.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: applicationKeys.list(params),
    queryFn: () => listApplications(params),
    placeholderData: keepPreviousData,
  })

  const s = stats.data
  const filtered = !!status || !!role || !!search

  // The dialog has to follow the *fresh* row, not the snapshot taken when it
  // was opened — otherwise a rating written from inside it never appears,
  // because the snapshot still holds the pre-rating copy.
  //
  // Falls back to the snapshot once the row leaves the list, which is exactly
  // what approving does: it becomes `approved` and drops out of the queue,
  // and the dialog has to stay open to show the invite result.
  const openRow = openRowSnapshot
    ? (query.data?.items.find((a) => a.id === openRowSnapshot.id) ?? openRowSnapshot)
    : null

  return (
    <>
      <Seo title="Applications" noindex />
      <PageHeader
        eyebrow="Accounts"
        title="Applications"
        description="People who applied through Create your profile. Deciding takes someone off this list — approved accounts appear under People, and rejected ones have their own page."
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Waiting" value={formatNumber(s?.new)} icon={<Inbox />} tone="brand" loading={stats.isPending} hint={s ? `${formatNumber(s.new_7d)} in the last 7 days` : undefined} />
          <StatsCard label="Reviewing" value={formatNumber(s?.reviewing)} loading={stats.isPending} hint="Picked up but not decided" />
          <StatsCard label="Approved" value={formatNumber(s?.approved)} icon={<UserPlus />} loading={stats.isPending} hint={s ? `${formatNumber(s.rejected)} rejected` : undefined} />
          {/* Accounts, not applications. This used to count applications by
              role, so it included rejected ones and people who applied but were
              never provisioned — it read "3 brands" while there were none. */}
          <StatsCard
            label="On the platform"
            value={formatNumber((s?.live_creators ?? 0) + (s?.live_brands ?? 0))}
            loading={stats.isPending}
            hint={s ? `${formatNumber(s.live_creators)} creators · ${formatNumber(s.live_brands)} brands` : undefined}
          />
        </div>

        <FilterBar
          activeCount={(status ? 1 : 0) + (role ? 1 : 0)}
          onReset={() => url.update({ status: null, role: null })}
          search={<SearchInput value={search} onCommit={(q) => url.update({ q })} placeholder="Search name, email, brand, handle or referral code" label="Search applications" />}
        >
          <FilterField label="Status" htmlFor="app-status">
            {/* The empty value is the queue, not "everything" — decided
                applications are one pick away, never gone. */}
            <Select id="app-status" size="sm" value={status} onValueChange={(v) => url.update({ status: v })} options={STATUS_OPTIONS} anyLabel="Not yet approved" />
          </FilterField>
          <FilterField label="Applying as" htmlFor="app-role">
            <Select id="app-role" size="sm" value={role} onValueChange={(v) => url.update({ role: v })} options={ROLE_OPTIONS} anyLabel="Everyone" />
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
              icon={<Inbox />}
              title={filtered ? 'No applications match' : 'Nothing to review'}
              description={filtered ? 'Try a different filter.' : 'You’re all caught up. New applications show up here, and approved ones move out of the way — find them under Status.'}
              action={
                filtered ? (
                  <Button variant="secondary" size="sm" onClick={() => url.update({ status: null, role: null, q: null })}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
          pagination={query.data ? { page: url.page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: url.setPage, label: 'applications' } : undefined}
        />
      </div>

      <ReviewDialog row={openRow} onClose={() => setOpenRow(null)} />
    </>
  )
}
