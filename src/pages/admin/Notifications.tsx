import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Megaphone, Send, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDateTime, formatNumber, formatRelative, pluralize } from '@/lib/format'
import { broadcastNotification, listAnnouncements } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader, SectionTitle } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { RadioCard, RadioGroup } from '@/components/ui/radio-group'
import { adminKeys } from '@/components/admin/admin-keys'
import { useAdminMutation } from '@/components/admin/use-admin-mutation'
import { useUrlState } from '@/components/admin/use-url-state'

const PAGE_SIZE = 20

const AUDIENCES = [
  { value: 'all', label: 'Everyone', description: 'Every active brand and creator account.' },
  { value: 'brands', label: 'Brands only', description: 'Accounts that hire creators.' },
  { value: 'creators', label: 'Creators only', description: 'Accounts that sell services.' },
] as const

/** Mirrors the checks in `public.admin_broadcast_notification`. */
const schema = z.object({
  audience: z.enum(['all', 'brands', 'creators']),
  title: z.string().trim().min(3, 'Add a title of at least 3 characters.').max(200, 'Keep the title under 200 characters.'),
  message: z.string().trim().max(1000, 'Keep the message under 1000 characters.').optional(),
  actionUrl: z
    .string()
    .trim()
    .max(500, 'That link is too long.')
    .refine((v) => !v || v.startsWith('/') || /^https?:\/\//.test(v), 'Use a path like /brand/orders or a full https:// link.')
    .optional(),
})
type FormValues = z.infer<typeof schema>

type Announcement = Awaited<ReturnType<typeof listAnnouncements>>['items'][number]

/** `audit_logs.metadata` for a broadcast, as written by the RPC. */
function announcementMeta(row: Announcement) {
  const meta = (row.metadata ?? {}) as { audience?: string; title?: string; recipients?: number }
  return {
    audience: meta.audience ?? 'all',
    title: meta.title ?? 'Announcement',
    recipients: typeof meta.recipients === 'number' ? meta.recipients : null,
  }
}

function BroadcastForm() {
  const [confirming, setConfirming] = React.useState<FormValues | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { audience: 'all', title: '', message: '', actionUrl: '' },
  })

  const send = useAdminMutation(
    (values: FormValues) => broadcastNotification(values.audience, values.title, values.message ?? '', values.actionUrl || undefined),
    {
      invalidate: [adminKeys.announcementsAll, qk.notifications.all],
      success: (count) => `Sent to ${formatNumber(count)} ${pluralize(count, 'person', 'people')}`,
      onSuccess: () => {
        form.reset({ audience: 'all', title: '', message: '', actionUrl: '' })
        setConfirming(null)
      },
    },
  )

  const audience = form.watch('audience')
  const audienceLabel = AUDIENCES.find((a) => a.value === audience)?.label ?? 'Everyone'

  return (
    <>
      <Card className="p-5 sm:p-6">
        <form onSubmit={form.handleSubmit((values) => setConfirming(values))} className="space-y-5" noValidate>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Audience</legend>
            <RadioGroup
              value={audience}
              onValueChange={(v) => form.setValue('audience', v as FormValues['audience'], { shouldDirty: true })}
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {AUDIENCES.map((a) => (
                <RadioCard key={a.value} value={a.value} title={a.label} description={a.description} />
              ))}
            </RadioGroup>
          </fieldset>

          <Field label="Title" htmlFor="broadcast-title" error={form.formState.errors.title?.message} hint="Shown in the notification bell and the email subject.">
            <Input id="broadcast-title" maxLength={200} placeholder="e.g. Scheduled maintenance this Sunday" aria-invalid={!!form.formState.errors.title} {...form.register('title')} />
          </Field>

          <Field label="Message" htmlFor="broadcast-message" error={form.formState.errors.message?.message} hint="Optional. Up to 1000 characters.">
            <Textarea
              id="broadcast-message"
              rows={4}
              maxLength={1000}
              placeholder="Add the detail people need — what is changing, when, and what they should do."
              aria-invalid={!!form.formState.errors.message}
              {...form.register('message')}
            />
          </Field>

          <Field
            label="Link"
            htmlFor="broadcast-link"
            error={form.formState.errors.actionUrl?.message}
            hint="Optional. Where the notification takes people — a path like /creator/payouts, or a full https:// URL."
          >
            <Input id="broadcast-link" placeholder="/creator/payouts" maxLength={500} aria-invalid={!!form.formState.errors.actionUrl} {...form.register('actionUrl')} />
          </Field>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button type="submit" loading={send.isPending}>
              <Send /> Review and send
            </Button>
            <p className="text-xs text-muted">Goes to every active {audienceLabel.toLowerCase()} account. This can’t be undone.</p>
          </div>
        </form>
      </Card>

      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="Send this announcement?"
        description={`Every active ${AUDIENCES.find((a) => a.value === confirming?.audience)?.label.toLowerCase() ?? ''} account gets an in-app notification. You can’t recall it.`}
        confirmLabel="Send announcement"
        loading={send.isPending}
        reasonRequired={false}
        onConfirm={() => {
          if (confirming) send.mutate(confirming)
        }}
      >
        {confirming && (
          <div className="rounded-control border border-line bg-subtle p-4">
            <p className="font-medium">{confirming.title}</p>
            {confirming.message && <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{confirming.message}</p>}
            {confirming.actionUrl && <p className="mt-2 font-mono text-xs text-sky">{confirming.actionUrl}</p>}
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}

function History() {
  const url = useUrlState()
  const query = useQuery({
    queryKey: adminKeys.announcements(url.page),
    queryFn: () => listAnnouncements(url.page, PAGE_SIZE),
  })

  if (query.isError) return <ErrorState error={query.error} title="Couldn’t load past announcements" onRetry={() => void query.refetch()} />
  if (query.isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
    )
  }
  if (query.data.items.length === 0) {
    return <EmptyState icon={<Megaphone />} title="Nothing sent yet" description="Announcements you broadcast will be listed here with their reach." />
  }

  return (
    <div className="space-y-3">
      {query.data.items.map((row) => {
        const meta = announcementMeta(row)
        return (
          <Card key={String(row.id)} className="flex flex-wrap items-start justify-between gap-3 p-5">
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{meta.title}</p>
              <p className="text-xs text-muted">
                {formatDateTime(row.created_at)} · {formatRelative(row.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone="outline" size="sm">
                <Users /> {AUDIENCES.find((a) => a.value === meta.audience)?.label ?? meta.audience}
              </Badge>
              {meta.recipients !== null && (
                <Badge tone="neutral" size="sm">
                  {formatNumber(meta.recipients)} {pluralize(meta.recipients, 'recipient')}
                </Badge>
              )}
            </div>
          </Card>
        )
      })}
      <Pagination page={url.page} pageSize={PAGE_SIZE} total={query.data.total} onPageChange={url.setPage} label="announcements" />
    </div>
  )
}

export default function Notifications() {
  return (
    <>
      <Seo title="Announcements" noindex />
      <PageHeader
        eyebrow="Communications"
        title="Announcements"
        description="Send an in-app notification to everyone, or just to brands or creators. Every broadcast is recorded in the audit log with its reach."
      />

      <div className={cn('max-w-3xl space-y-8')}>
        <section className="space-y-4">
          <SectionTitle title="New announcement" description="Keep it short and specific — people see the title in their notification bell." />
          <BroadcastForm />
        </section>

        <section className="space-y-4">
          <SectionTitle title="Sent before" description="Read from the audit log, so it reflects exactly what the database recorded." />
          <History />
        </section>
      </div>
    </>
  )
}
