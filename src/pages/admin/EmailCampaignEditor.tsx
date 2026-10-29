import * as React from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, CalendarClock, Copy, Pause, Play, Repeat, Save, Send, Sparkles, Trash2, UserCheck, Users, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { formatNumber } from '@/lib/format'
import { istDateTime, istParts, istTimeLabel, istToIso } from '@/lib/india-time'
import {
  emailCampaignAction,
  emailCampaignReach,
  listEmailCampaigns,
  saveEmailCampaign,
  testEmailCampaign,
  type EmailAudience,
  type EmailCampaign,
  type EmailCampaignInput,
  type EmailSchedule,
} from '@/services/email-campaigns.service'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioCard, RadioGroup } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { ErrorState } from '@/components/shared/states'
import { SectionCard } from '@/components/brand/section-card'
import { adminKeys } from '@/components/admin/admin-keys'
import { useAdminMutation } from '@/components/admin/use-admin-mutation'
import {
  AUDIENCE_LABEL,
  EmailPreview,
  EmailStatusBadge,
  NoEmailProviderNotice,
  PeoplePicker,
  audienceLabel,
  scheduleLabel,
} from '@/components/admin/email-campaign-ui'

type Draft = {
  subject: string
  body: string
  audience: EmailAudience
  ids: string[]
  schedule: EmailSchedule
  /** 'once': India date and time. */
  date: string | null
  time: string
  /** 'daily': India time. */
  daily: string
}

const EMPTY: Draft = { subject: '', body: '', audience: 'creators', ids: [], schedule: 'now', date: null, time: '10:00', daily: '10:00' }

function fromCampaign(c: EmailCampaign): Draft {
  const at = c.send_at ? istParts(c.send_at) : null
  return {
    subject: c.subject,
    body: c.body,
    audience: c.audience,
    ids: c.recipient_ids,
    schedule: c.schedule,
    date: at?.date ?? null,
    time: at?.time ?? '10:00',
    daily: c.daily_time?.slice(0, 5) ?? '10:00',
  }
}

function toInput(d: Draft): EmailCampaignInput {
  return {
    subject: d.subject.trim(),
    body: d.body.trim(),
    audience: d.audience,
    recipient_ids: d.audience === 'specific' ? [...d.ids].sort() : [],
    schedule: d.schedule,
    send_at: d.schedule === 'once' && d.date && d.time ? istToIso(d.date, d.time) : null,
    daily_time: d.schedule === 'daily' ? d.daily : null,
  }
}

const same = (a: Draft, b: Draft) => JSON.stringify(toInput(a)) === JSON.stringify(toInput(b))

/** What's wrong with the draft, field by field (empty when it can be saved). */
function problems(d: Draft) {
  const p: Partial<Record<'subject' | 'body' | 'ids' | 'when', string>> = {}
  const subject = d.subject.trim().length
  const body = d.body.trim().length
  if (subject < 3 || subject > 200) p.subject = 'Write a subject of 3 to 200 characters.'
  if (body < 20 || body > 5000) p.body = 'Write a message of 20 to 5,000 characters.'
  if (d.audience === 'specific' && d.ids.length === 0) p.ids = 'Pick at least one person.'
  if (d.schedule === 'once' && (!d.date || !d.time)) p.when = 'Pick a date and time.'
  if (d.schedule === 'daily' && !d.daily) p.when = 'Pick a time.'
  return p
}

const LAUNCH_LABEL: Record<EmailSchedule, string> = { now: 'Send now', once: 'Schedule', daily: 'Start daily' }

/** Admin → Email campaigns → new / one campaign. */
export default function EmailCampaignEditor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()

  const list = useQuery({ queryKey: adminKeys.emailCampaigns, queryFn: listEmailCampaigns, enabled: !isNew })
  const campaign = isNew ? undefined : list.data?.find((c) => c.id === id)

  // "Duplicate" opens a new campaign prefilled with another one's words and audience.
  const copy = (location.state as { copy?: Draft } | null)?.copy
  const [draft, setDraft] = React.useState<Draft | null>(isNew ? (copy ?? EMPTY) : null)
  React.useEffect(() => {
    if (campaign && !draft) setDraft(fromCampaign(campaign))
  }, [campaign, draft])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))
  const [touched, setTouched] = React.useState(false)
  const [confirm, setConfirm] = React.useState<'launch' | 'pause' | 'delete' | null>(null)

  const ids = draft?.audience === 'specific' ? [...draft.ids].sort() : []
  const reach = useQuery({
    queryKey: adminKeys.emailCampaignReach(draft?.audience ?? 'creators', ids),
    queryFn: () => emailCampaignReach(draft!.audience, ids),
    enabled: !!draft && (draft.audience !== 'specific' || ids.length > 0),
    placeholderData: (prev) => prev,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: adminKeys.emailCampaigns })

  /** Saves the draft (creating the campaign if it's new) and returns its id. */
  async function persist(d: Draft) {
    const savedId = await saveEmailCampaign(id ?? null, toInput(d))
    await refresh()
    if (isNew) navigate(`/admin/email-campaigns/${savedId}`, { replace: true })
    return savedId
  }

  const save = useAdminMutation((d: Draft) => persist(d), {
    success: () =>
      campaign?.status === 'active' || campaign?.status === 'scheduled' ? 'Changes saved' : !campaign || campaign.status === 'draft' ? 'Saved as a draft' : 'Saved',
    onSuccess: () => {
      // Changing a running campaign to a different kind of schedule pauses it.
      if (campaign && draft && (campaign.status === 'active' || campaign.status === 'scheduled')) {
        const runs = campaign.status === 'active' ? 'daily' : 'once'
        if (draft.schedule !== runs) toast.info('The schedule changed, so the campaign is paused. Start it again when you’re ready.')
      }
    },
  })

  const test = useAdminMutation(
    async (d: Draft) => {
      const savedId = !campaign || !same(d, fromCampaign(campaign)) ? await persist(d) : campaign.id
      return testEmailCampaign(savedId)
    },
    { success: (to) => `Test sent to ${to}. It arrives within a minute or two.` },
  )

  const launch = useAdminMutation(
    async (d: Draft) => {
      const savedId = !campaign || !same(d, fromCampaign(campaign)) ? await persist(d) : campaign.id
      return emailCampaignAction(savedId, campaign?.status === 'paused' ? 'resume' : 'launch')
    },
    {
      invalidate: [adminKeys.emailCampaigns],
      success: (r, d) =>
        d.schedule === 'now'
          ? `Sending to ${formatNumber(r.queued)} ${r.queued === 1 ? 'person' : 'people'}`
          : d.schedule === 'once'
            ? `Scheduled for ${istDateTime(toInput(d).send_at)} IST`
            : `Running every day at ${istTimeLabel(d.daily)} IST`,
      onSuccess: () => {
        setConfirm(null)
        navigate('/admin/email-campaigns')
      },
    },
  )

  const act = useAdminMutation((action: 'pause' | 'delete') => emailCampaignAction(id!, action), {
    invalidate: [adminKeys.emailCampaigns],
    success: (_, action) => (action === 'pause' ? 'Paused — nothing more goes out until you start it again' : 'Campaign deleted'),
    onSuccess: (_, action) => {
      setConfirm(null)
      if (action === 'delete') navigate('/admin/email-campaigns')
    },
  })

  const title = isNew ? 'New email campaign' : (campaign?.subject ?? 'Email campaign')
  const crumbs = (
    <>
      <Seo title={title} noindex />
      <Breadcrumb items={[{ label: 'Email campaigns', href: '/admin/email-campaigns' }, { label: isNew ? 'New' : (campaign?.subject ?? 'Campaign') }]} />
    </>
  )

  if (!isNew && list.isPending) {
    return (
      <>
        {crumbs}
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    )
  }
  if (!isNew && (list.isError || !campaign)) {
    return (
      <>
        {crumbs}
        <ErrorState
          error={list.error}
          title={list.isError ? undefined : 'This campaign doesn’t exist any more'}
          onRetry={() => void list.refetch()}
        />
      </>
    )
  }
  if (!draft) return crumbs

  const status = campaign?.status ?? 'draft'
  const sent = status === 'sent'
  const running = status === 'active' || status === 'scheduled'
  const dirty = !campaign || !same(draft, fromCampaign(campaign))
  const issues = problems(draft)
  const valid = Object.keys(issues).length === 0
  const show = (key: keyof typeof issues) => (touched ? issues[key] : undefined)
  const pastTime = draft.schedule === 'once' && !!draft.date && !!draft.time && new Date(istToIso(draft.date, draft.time)) <= new Date()
  const busy = save.isPending || test.isPending || launch.isPending || act.isPending
  const people = reach.data ?? 0
  const peopleText = `${formatNumber(people)} ${people === 1 ? 'person' : 'people'}`
  // "all creators (233 today)"; picked people are just counted.
  const whoText = draft.audience === 'specific' ? peopleText : `${AUDIENCE_LABEL[draft.audience].toLowerCase()} (${peopleText} today)`
  const button = campaign?.email_type === 'creator_daily' ? 'Update my profile' : null
  // A sent campaign can go out again, to a new audience or on a new schedule.
  const launchLabel =
    status === 'paused' && draft.schedule === 'daily' ? 'Start again' : sent && draft.schedule === 'now' ? 'Send again' : LAUNCH_LABEL[draft.schedule]

  function attempt(fn: () => void) {
    setTouched(true)
    if (valid) fn()
  }

  return (
    <>
      {crumbs}
      <PageHeader
        title={title}
        description={campaign ? `${audienceLabel(campaign)} · ${scheduleLabel(campaign)}` : 'Write it once. Send it now, at a set time, or every day.'}
        actions={campaign ? <EmailStatusBadge status={campaign.status} /> : undefined}
      />
      <NoEmailProviderNotice />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0 space-y-6">
          <Card className="@container space-y-5 p-5 sm:p-6">
            <Field label="Subject" htmlFor="ec-subject" hint="Also the heading inside the email." error={show('subject')} required>
              <Input
                id="ec-subject"
                maxLength={200}
                value={draft.subject}
                onChange={(e) => set('subject', e.target.value)}
                placeholder="e.g. New brand campaigns are live this week"
              />
            </Field>
            <Field
              label="Message"
              htmlFor="ec-body"
              required
              error={show('body')}
              hint={`Blank lines start a new paragraph. Every email opens with “Hi {first name},”. ${formatNumber(draft.body.length)}/5,000`}
            >
              <Textarea id="ec-body" rows={14} maxLength={5000} value={draft.body} onChange={(e) => set('body', e.target.value)} />
            </Field>
          </Card>

          <Card className="@container space-y-5 p-5 sm:p-6">
            <Field label="Who gets it">
              <RadioGroup
                value={draft.audience}
                onValueChange={(v) => set('audience', v as EmailAudience)}
                className="grid gap-3 @lg:grid-cols-2"
              >
                <RadioCard value="creators" icon={<Sparkles />} title={AUDIENCE_LABEL.creators} description="Active creators with a storefront" />
                <RadioCard value="brands" icon={<Building2 />} title={AUDIENCE_LABEL.brands} description="Active brand accounts" />
                <RadioCard value="everyone" icon={<Users />} title={AUDIENCE_LABEL.everyone} description="Everyone above, in one go" />
                <RadioCard value="specific" icon={<UserCheck />} title="Specific people" description="Search and pick exactly who" />
              </RadioGroup>
            </Field>
            {draft.audience === 'specific' && (
              <div className="space-y-1.5">
                <PeoplePicker selected={draft.ids} onChange={(v) => set('ids', v)} />
                {show('ids') && <p className="text-xs font-medium text-danger">{show('ids')}</p>}
              </div>
            )}
            <p className="text-sm text-muted">
              {draft.audience === 'specific' && draft.ids.length === 0 ? (
                'Pick people to see how many it reaches.'
              ) : reach.isPending ? (
                'Counting…'
              ) : (
                <>
                  Reaches <span className="font-medium text-ink tabular-nums">{peopleText}</span> right now. Suspended accounts, removed
                  storefronts and anyone who turned off account emails are skipped.
                </>
              )}
            </p>
          </Card>

          <Card className="@container space-y-5 p-5 sm:p-6">
            <Field label="When">
              <RadioGroup
                value={draft.schedule}
                onValueChange={(v) => set('schedule', v as EmailSchedule)}
                className="grid gap-3 @3xl:grid-cols-3"
              >
                <RadioCard value="now" icon={<Zap />} title="Right away" description="Goes out when you press send" />
                <RadioCard value="once" icon={<CalendarClock />} title="Once, later" description="On a date and time you pick" />
                <RadioCard value="daily" icon={<Repeat />} title="Every day" description="At the same time until paused" />
              </RadioGroup>
            </Field>
            {draft.schedule === 'once' && (
              <div className="grid gap-4 @md:grid-cols-2">
                <Field label="Date" htmlFor="ec-date" error={show('when')}>
                  <DatePicker id="ec-date" value={draft.date} onChange={(v) => set('date', v)} minDate={new Date()} clearable={false} />
                </Field>
                <Field
                  label="Time (IST)"
                  htmlFor="ec-time"
                  error={pastTime ? 'That time has passed.' : undefined}
                  hint={draft.date ? `${format(new Date(`${draft.date}T00:00:00`), 'EEEE d MMMM')} at ${istTimeLabel(draft.time)}` : undefined}
                >
                  <Input id="ec-time" type="time" step={300} value={draft.time} onChange={(e) => set('time', e.target.value)} />
                </Field>
              </div>
            )}
            {draft.schedule === 'daily' && (
              <Field label="Time every day (IST)" htmlFor="ec-daily" error={show('when')} className="@md:max-w-xs">
                <Input id="ec-daily" type="time" step={300} value={draft.daily} onChange={(e) => set('daily', e.target.value)} />
              </Field>
            )}
            <p className="text-xs text-muted">
              Scheduled emails go out within 5 minutes of their time. Each run goes to whoever the audience includes at that moment.
            </p>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            {running ? (
              <>
                <Button disabled={!dirty || busy} loading={save.isPending} onClick={() => attempt(() => save.mutate(draft))}>
                  <Save /> Save changes
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setConfirm('pause')}>
                  <Pause /> Pause
                </Button>
              </>
            ) : (
              <>
                <Button disabled={busy || pastTime} onClick={() => attempt(() => setConfirm('launch'))}>
                  {status === 'paused' && draft.schedule !== 'now' ? <Play /> : <Send />}
                  {launchLabel}
                </Button>
                <Button variant="secondary" disabled={!dirty || busy} loading={save.isPending} onClick={() => attempt(() => save.mutate(draft))}>
                  <Save /> {status === 'draft' ? 'Save draft' : 'Save'}
                </Button>
              </>
            )}
            <Button variant="ghost" disabled={busy} loading={test.isPending} onClick={() => attempt(() => test.mutate(draft))}>
              <Send /> Send me a test
            </Button>
          </div>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6">
          {campaign && (
            <SectionCard title="Status">
              <dl className="space-y-2.5 text-sm">
                <Row label="Status">
                  <EmailStatusBadge status={campaign.status} />
                </Row>
                {running && campaign.next_run_at && <Row label="Next send">{istDateTime(campaign.next_run_at)} IST</Row>}
                {campaign.last_run_at && (
                  <Row label="Last send">
                    {istDateTime(campaign.last_run_at)} · {formatNumber(campaign.last_run_count)}
                  </Row>
                )}
                <Row label="Emailed so far">{formatNumber(campaign.total)}</Row>
                <Row label="Delivered">{formatNumber(campaign.delivered)}</Row>
                {campaign.waiting > 0 && <Row label="Still sending">{formatNumber(campaign.waiting)}</Row>}
                {campaign.skipped > 0 && (
                  <Row label="Not sent (no email service)">
                    <span className="text-warning-ink">{formatNumber(campaign.skipped)}</span>
                  </Row>
                )}
                {campaign.failed > 0 && (
                  <Row label="Failed">
                    <span className="text-danger">{formatNumber(campaign.failed)}</span>
                  </Row>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('/admin/email-campaigns/new', { state: { copy: { ...fromCampaign(campaign), schedule: 'now', date: null } } })}
                >
                  <Copy /> Duplicate
                </Button>
                {!running && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm('delete')}>
                    <Trash2 /> Delete
                  </Button>
                )}
              </div>
            </SectionCard>
          )}
          <SectionCard title="Preview" description={button ? 'This one ends with a button that opens the creator’s profile editor.' : undefined}>
            <EmailPreview subject={draft.subject} body={draft.body} button={button} />
          </SectionCard>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === 'pause'
            ? 'Pause this campaign?'
            : confirm === 'delete'
              ? 'Delete this campaign?'
              : draft.schedule === 'now'
                ? `Send this email to ${peopleText}?`
                : draft.schedule === 'once'
                  ? 'Schedule this email?'
                  : 'Send this email every day?'
        }
        description={
          confirm === 'pause'
            ? 'Nothing more goes out until you start it again. You can still edit it.'
            : confirm === 'delete'
              ? 'It’s removed from this list. Emails that already went out stay sent.'
              : draft.schedule === 'now'
                ? sent && campaign?.last_run_at
                  ? `It already went out ${istDateTime(campaign.last_run_at)} IST. It goes out again straight away to everyone in this audience, including anyone who got it before.`
                  : 'It goes out straight away and can’t be called back. Send yourself a test first if you haven’t.'
                : draft.schedule === 'once'
                  ? `It goes out ${istDateTime(toInput(draft).send_at)} IST to ${whoText}. You can pause it before then.`
                  : `Every day at ${istTimeLabel(draft.daily)} IST to ${whoText}, until you pause it.`
        }
        confirmLabel={confirm === 'pause' ? 'Pause' : confirm === 'delete' ? 'Delete' : launchLabel}
        destructive={confirm === 'delete'}
        loading={launch.isPending || act.isPending}
        onConfirm={() => {
          if (confirm === 'launch') launch.mutate(draft)
          else if (confirm) act.mutate(confirm)
        }}
      />
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  )
}
