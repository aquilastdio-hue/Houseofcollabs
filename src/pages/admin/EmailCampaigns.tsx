import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Mail, Plus, Users } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { istDateTime } from '@/lib/india-time'
import { listEmailCampaigns, type EmailCampaign } from '@/services/email-campaigns.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { adminKeys } from '@/components/admin/admin-keys'
import { EmailStatusBadge, NoEmailProviderNotice, audienceLabel, scheduleLabel } from '@/components/admin/email-campaign-ui'

function Numbers({ c }: { c: EmailCampaign }) {
  if (c.total === 0) {
    return (
      <span>
        Reaches {formatNumber(c.recipients_now)} {c.recipients_now === 1 ? 'person' : 'people'} right now
      </span>
    )
  }
  return (
    <span className="tabular-nums">
      {formatNumber(c.total)} emailed · {formatNumber(c.delivered)} delivered
      {c.waiting > 0 && ` · ${formatNumber(c.waiting)} sending`}
      {c.skipped > 0 && <span className="text-warning-ink"> · {formatNumber(c.skipped)} not sent</span>}
      {c.failed > 0 && <span className="text-danger"> · {formatNumber(c.failed)} failed</span>}
    </span>
  )
}

function CampaignRow({ c }: { c: EmailCampaign }) {
  return (
    <Link to={`/admin/email-campaigns/${c.id}`} className="focus-ring block rounded-card">
      <Card className="flex flex-col gap-3 p-4 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-card sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <EmailStatusBadge status={c.status} />
            {c.email_type === 'creator_daily' && (
              <Badge size="sm" tone="outline">
                Daily creator email
              </Badge>
            )}
          </div>
          <p className="truncate font-medium">{c.subject}</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden /> {audienceLabel(c)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5" aria-hidden /> {scheduleLabel(c)}
            </span>
          </p>
        </div>
        <div className="shrink-0 text-sm text-muted sm:text-right">
          <Numbers c={c} />
          {(c.status === 'active' || c.status === 'scheduled') && c.next_run_at && (
            <p className="text-xs text-faint">Next: {istDateTime(c.next_run_at)} IST</p>
          )}
        </div>
      </Card>
    </Link>
  )
}

/** Admin → Email campaigns: write an email once, send it now, later, or every day. */
export default function EmailCampaigns() {
  const query = useQuery({
    queryKey: adminKeys.emailCampaigns,
    queryFn: listEmailCampaigns,
    // Keep the numbers moving while a batch is going out.
    refetchInterval: (q) => (q.state.data?.some((c) => c.waiting > 0) ? 10_000 : false),
  })

  const newButton = (
    <Button asChild>
      <Link to="/admin/email-campaigns/new">
        <Plus /> New campaign
      </Link>
    </Button>
  )

  return (
    <>
      <Seo title="Email campaigns" noindex />
      <PageHeader
        eyebrow="Platform"
        title="Email campaigns"
        description="Write an email once and send it to creators, brands or people you pick — straight away, at a set time, or every day. Times are India time."
        actions={query.data?.length ? newButton : undefined}
      />
      <NoEmailProviderNotice />
      {query.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={<Mail />}
          title="No email campaigns yet"
          description="Send an update to every creator, remind brands about something, or set up an email that goes out every morning."
          action={newButton}
        />
      ) : (
        <ul className="space-y-3">
          {query.data.map((c) => (
            <li key={c.id}>
              <CampaignRow c={c} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
