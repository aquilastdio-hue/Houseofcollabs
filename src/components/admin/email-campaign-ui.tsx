import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { MailX, Search, X } from 'lucide-react'
import { fetchAllPages } from '@/lib/fetch-all'
import { formatNumber } from '@/lib/format'
import { istDateTime, istTimeLabel } from '@/lib/india-time'
import { cn } from '@/lib/utils'
import { getEmailStats, listPeople } from '@/services/admin.service'
import type { EmailAudience, EmailCampaign, EmailCampaignStatus } from '@/services/email-campaigns.service'
import { Avatar } from '@/components/ui/avatar'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/states'
import { adminKeys } from './admin-keys'

export const EMAIL_STATUS_META: Record<EmailCampaignStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  active: { label: 'Running daily', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  sent: { label: 'Sent', tone: 'lilac' },
}

export function EmailStatusBadge({ status }: { status: EmailCampaignStatus }) {
  const meta = EMAIL_STATUS_META[status]
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  )
}

export const AUDIENCE_LABEL: Record<Exclude<EmailAudience, 'specific'>, string> = {
  creators: 'All creators',
  brands: 'All brands',
  everyone: 'Creators and brands',
}

export function audienceLabel(c: Pick<EmailCampaign, 'audience' | 'recipient_ids'>) {
  if (c.audience !== 'specific') return AUDIENCE_LABEL[c.audience]
  const n = c.recipient_ids.length
  return `${formatNumber(n)} ${n === 1 ? 'person' : 'people'}`
}

/**
 * Shown while send-notification has no email provider: campaigns still queue,
 * but every email is logged as skipped instead of sent (same rule as the Email log).
 */
export function NoEmailProviderNotice() {
  const stats = useQuery({ queryKey: adminKeys.emailStats, queryFn: getEmailStats })
  if (!stats.data || stats.data.provider !== null) return null
  return (
    <Card className="mb-6 flex items-start gap-3 border-warning/40 bg-warning-soft p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-warning-ink [&_svg]:size-4" aria-hidden>
        <MailX />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-ink">Emails aren’t going out yet</p>
        <p className="mt-0.5 text-ink-soft">
          No email service is connected, so campaigns are queued and logged as “Skipped” instead of sent. Connect Brevo in the Edge
          Function secrets to start sending.{' '}
          <Link to="/admin/emails" className="font-medium text-ink underline underline-offset-2">
            Open the email log
          </Link>
        </p>
      </div>
    </Card>
  )
}

/** Pages a campaign's button can open, each with words that suit it. */
export const BUTTON_PAGES = [
  { value: '/creator/profile', label: 'Creator · Edit profile', suggest: 'Update my profile' },
  { value: '/creator/portfolio', label: 'Creator · Portfolio', suggest: 'Add my best work' },
  { value: '/creator/services', label: 'Creator · Services & rates', suggest: 'Update my rates' },
  { value: '/creator/campaigns', label: 'Creator · Open campaigns', suggest: 'See open campaigns' },
  { value: '/creator/orders', label: 'Creator · Orders', suggest: 'View my orders' },
  { value: '/creator/earnings', label: 'Creator · Earnings', suggest: 'See my earnings' },
  { value: '/brand/creators', label: 'Brand · Browse creators', suggest: 'Find creators' },
  { value: '/brand/campaigns/new', label: 'Brand · Post a campaign', suggest: 'Post a campaign' },
  { value: '/brand/briefs/new', label: 'Brand · Write a brief', suggest: 'Write a brief' },
  { value: '/brand/orders', label: 'Brand · Orders', suggest: 'View my orders' },
  { value: '/', label: 'Home page', suggest: 'Open House of Collabs' },
] as const

/** "Every day at 10:00 am", "29 Oct, 6:30 pm", "Sent 28 Oct, 3:15 pm"… */
export function scheduleLabel(c: Pick<EmailCampaign, 'schedule' | 'send_at' | 'daily_time' | 'status' | 'last_run_at'>) {
  if (c.status === 'sent') return `Sent ${istDateTime(c.last_run_at)}`
  if (c.schedule === 'daily') return `Every day at ${istTimeLabel(c.daily_time)} IST`
  if (c.schedule === 'once') return `${istDateTime(c.send_at)} IST`
  return 'Sends when you press send'
}

// ---------------------------------------------------------------------------
// "Specific people": everyone with an active creator or brand account.
// ---------------------------------------------------------------------------

type Person = { id: string; name: string; detail: string; email: string; role: 'creator' | 'brand'; avatar: string | null }

async function loadPeople(): Promise<Person[]> {
  const { items } = await fetchAllPages((page, pageSize) => listPeople({ status: 'active', sort: 'name', page, pageSize }))
  return items
    .filter((p) => p.role === 'creator' || p.role === 'brand')
    .map((p) => ({
      id: p.id,
      // Storefront or brand name first; the person's own name underneath when it differs.
      name: p.display_name || p.full_name || p.email,
      detail: [p.full_name && p.full_name !== p.display_name ? p.full_name : null, p.email].filter(Boolean).join(' · '),
      email: p.email,
      role: p.role as Person['role'],
      avatar: p.avatar_url || null,
    }))
}

export const MAX_PICKED = 500

export function PeoplePicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const query = useQuery({ queryKey: adminKeys.campaignPeople, queryFn: loadPeople, staleTime: 5 * 60_000 })
  const [search, setSearch] = React.useState('')
  const [onlyPicked, setOnlyPicked] = React.useState(false)
  const picked = new Set(selected)
  const full = picked.size >= MAX_PICKED

  if (query.isPending) return <Skeleton className="h-72 rounded-card" />
  if (query.isError) return <ErrorState title="Couldn’t load people" onRetry={() => void query.refetch()} />

  const q = search.trim().toLowerCase()
  const people = query.data
  const shown = people.filter(
    (p) => (!onlyPicked || picked.has(p.id)) && (!q || p.name.toLowerCase().includes(q) || p.detail.toLowerCase().includes(q)),
  )
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((x) => x !== id))

  return (
    <div className="overflow-hidden rounded-card border border-line">
      <div className="space-y-2 border-b border-line bg-subtle/40 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search people"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {formatNumber(picked.size)} selected{full ? ` (the most one email can go to)` : ''} · {formatNumber(shown.length)} shown
          </span>
          <span className="flex items-center gap-3">
            {picked.size > 0 && (
              <button
                type="button"
                onClick={() => setOnlyPicked((v) => !v)}
                className="focus-ring rounded-sm font-medium text-ink hover:underline"
              >
                {onlyPicked ? 'Show everyone' : 'Show selected'}
              </button>
            )}
            {picked.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  onChange([])
                  setOnlyPicked(false)
                }}
                className="focus-ring inline-flex items-center gap-1 rounded-sm font-medium text-ink hover:underline"
              >
                <X className="size-3.5" /> Clear
              </button>
            )}
          </span>
        </div>
      </div>
      <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
        {shown.map((p) => {
          const on = picked.has(p.id)
          const off = !on && full
          const id = `pick-${p.id}`
          return (
            <li key={p.id}>
              <label
                htmlFor={id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5',
                  off ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-subtle/60',
                  off && 'opacity-55',
                  on && 'bg-brand-soft/40',
                )}
              >
                <Checkbox id={id} checked={on} disabled={off} onCheckedChange={(v) => toggle(p.id, v === true)} />
                <Avatar src={p.avatar} name={p.name} size="sm" shape={p.role === 'brand' ? 'rounded' : 'circle'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted">{p.detail}</span>
                </span>
                <Badge size="sm" tone={p.role === 'brand' ? 'info' : 'brand-soft'}>
                  {p.role === 'brand' ? 'Brand' : 'Creator'}
                </Badge>
              </label>
            </li>
          )
        })}
        {shown.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-muted">{q ? `No one matches “${search.trim()}”.` : 'No one selected yet.'}</li>
        )}
      </ul>
    </div>
  )
}

/** Roughly how the email will look in an inbox. */
export function EmailPreview({ subject, body, button }: { subject: string; body: string; button?: string | null }) {
  const paragraphs = body.trim() ? body.trim().split(/\n\s*\n/) : []
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line bg-subtle/50 px-4 py-2.5 text-xs text-muted">
        <span className="font-medium text-ink">House of Collabs</span> · {subject.trim() || 'Your subject'}
      </div>
      <div className="space-y-3 px-5 py-5">
        <p className="text-sm text-muted">Hi Riya,</p>
        <p className="font-display text-lg leading-snug font-semibold">{subject.trim() || 'Your subject'}</p>
        {paragraphs.length ? (
          paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed whitespace-pre-line text-ink-soft">
              {p.trim()}
            </p>
          ))
        ) : (
          <p className="text-sm text-faint">Your message shows here.</p>
        )}
        {button && <span className="mt-2 inline-flex rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white">{button}</span>}
      </div>
    </div>
  )
}
