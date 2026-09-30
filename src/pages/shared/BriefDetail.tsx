import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Ban,
  BadgeCheck,
  CalendarClock,
  CircleCheck,
  Clapperboard,
  ExternalLink,
  FileQuestion,
  Globe,
  Handshake,
  IndianRupee,
  Link2,
  Paperclip,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatINR, formatRelative } from '@/lib/format'
import { CONTENT_TYPES, PLATFORMS, labelFor } from '@/lib/constants'
import { qk } from '@/lib/query-keys'
import { useAuth } from '@/contexts/auth-context'
import { deleteBrief, deleteBriefAttachment, getBrief, type BriefDetail as BriefRecord } from '@/services/briefs.service'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { SectionCard } from '@/components/brand/section-card'
import { displayUrl, isUuid, safeHref } from '@/components/brand/validators'
import { BriefAttachmentList } from '@/components/briefs/brief-attachments'
import { BriefBrandCard } from '@/components/briefs/brief-brand-card'
import { BriefResponsePanel } from '@/components/briefs/brief-response-panel'
import { BRIEF_STATUS_META, BriefStatusBadge, formatDeadline, isBriefOverdue } from '@/components/briefs/brief-status'
import { BriefTimeline } from '@/components/briefs/brief-timeline'
import { SendBriefDialog } from '@/components/briefs/send-brief-dialog'

type Perspective = 'brand' | 'creator'

export default function BriefDetail({ perspective }: { perspective: Perspective }) {
  const { id } = useParams()
  const validId = !!id && isUuid(id)
  const query = useQuery({ queryKey: qk.briefs.detail(id ?? ''), queryFn: () => getBrief(id!), enabled: validId })
  const listHref = `/${perspective}/briefs`

  if (!validId) return <BriefNotFound listHref={listHref} />
  if (query.isPending) return <BriefDetailSkeleton />
  if (query.isError && !query.data) {
    return (
      <>
        <Seo title="Brief" noindex />
        <Breadcrumb items={[{ label: 'Briefs', href: listHref }, { label: 'Brief' }]} />
        <h1 className="sr-only">Brief</h1>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    )
  }
  if (!query.data) return <BriefNotFound listHref={listHref} />
  return <BriefView brief={query.data} perspective={perspective} />
}

function BriefNotFound({ listHref }: { listHref: string }) {
  return (
    <>
      <Seo title="Brief not found" noindex />
      <h1 className="sr-only">Brief not found</h1>
      <EmptyState
        icon={<FileQuestion />}
        title="Brief not found"
        description="It may have been deleted, or you don’t have access to it."
        action={
          <Button asChild size="sm">
            <Link to={listHref}>Back to briefs</Link>
          </Button>
        }
      />
    </>
  )
}

function BriefDetailSkeleton() {
  return (
    <>
      <Seo title="Brief" noindex />
      <div aria-hidden>
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="mb-3 h-9 w-2/3 max-w-lg" />
        <Skeleton className="mb-8 h-5 w-64" />
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-card" />
            <Skeleton className="h-40 rounded-card" />
          </div>
          <Skeleton className="h-72 rounded-card" />
        </div>
      </div>
    </>
  )
}

function BriefView({ brief, perspective }: { brief: BriefRecord; perspective: Perspective }) {
  const { brand, creator } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [sendOpen, setSendOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const status = brief.status
  const isOwner = perspective === 'brand' && !!brand && brief.brand_id === brand.id
  const isAssigned = perspective === 'creator' && !!creator && brief.creator_id === creator.id
  const canEdit = isOwner && status !== 'completed'
  const canDelete = isOwner && status === 'draft'
  const canSend = isOwner && (status === 'draft' || status === 'rejected' || status === 'sent')
  const canHire = isOwner && status === 'accepted' && !!brief.creator_id
  const canRespond = isAssigned && status === 'sent'
  const listHref = `/${perspective}/briefs`
  const creatorName = brief.creator?.display_name ?? 'creator'
  const overdue = isBriefOverdue(brief.deadline, status)

  const remove = useMutation({
    mutationFn: async () => {
      // Remove stored files first — storage policies need the brief to still exist.
      await Promise.allSettled(brief.brief_attachments.map((a) => deleteBriefAttachment(a)))
      await deleteBrief(brief.id)
    },
    onSuccess: () => {
      toast.success('Draft deleted')
      setDeleteOpen(false)
      navigate('/brand/briefs', { replace: true })
      qc.removeQueries({ queryKey: qk.briefs.detail(brief.id) })
      void qc.invalidateQueries({ queryKey: qk.briefs.all })
      void qc.invalidateQueries({ queryKey: qk.dashboard.brand })
    },
  })

  const hasActions = canHire || canSend || canEdit || canDelete
  const sendLabel = status === 'rejected' ? 'Send to another creator' : status === 'sent' ? 'Send to someone else' : 'Send to creator'

  const actions =
    perspective === 'brand' ? (
      <>
        {canHire && (
          <Button asChild variant="accent" className="max-w-full">
            <Link to={`/brand/creators/${brief.creator_id}#services`}>
              <Handshake /> <span className="truncate">Hire {creatorName}</span>
            </Link>
          </Button>
        )}
        {canSend && (
          <Button variant={status === 'sent' ? 'secondary' : 'primary'} onClick={() => setSendOpen(true)}>
            <Send /> {sendLabel}
          </Button>
        )}
        {canEdit && (
          <Button asChild variant="secondary">
            <Link to={`/brand/briefs/${brief.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
        )}
        {canDelete && (
          <Button variant="danger-ghost" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Delete
          </Button>
        )}
      </>
    ) : null

  const facts = [
    {
      label: 'Deadline',
      icon: CalendarClock,
      value: brief.deadline ? formatDeadline(brief.deadline) : 'Not set',
      note: overdue ? 'Deadline has passed' : undefined,
      muted: !brief.deadline,
    },
    { label: 'Budget', icon: IndianRupee, value: brief.budget != null ? formatINR(brief.budget) : 'Not set', muted: brief.budget == null },
    {
      label: 'Content type',
      icon: Clapperboard,
      value: brief.content_type ? labelFor(CONTENT_TYPES, brief.content_type) : 'Not set',
      muted: !brief.content_type,
    },
    { label: 'Platform', icon: Globe, value: brief.platform ? labelFor(PLATFORMS, brief.platform) : 'Not set', muted: !brief.platform },
  ]

  const productHref = safeHref(brief.product_url)
  const hasCampaign = !!(brief.campaign_objective || brief.target_audience || brief.tone)
  const hasProduct = !!(brief.product_name || brief.product_description || productHref || brief.category)
  const hasDeliverables = !!(brief.deliverables || brief.usage_rights)
  const isEmpty =
    !hasCampaign &&
    !hasProduct &&
    !hasDeliverables &&
    brief.talking_points.length === 0 &&
    brief.do_not_say.length === 0 &&
    brief.reference_links.length === 0 &&
    brief.brief_attachments.length === 0

  return (
    <>
      <Seo title={brief.title} noindex />
      <Breadcrumb items={[{ label: 'Briefs', href: listHref }, { label: brief.title }]} />
      <PageHeader title={brief.title} description={BRIEF_STATUS_META[status][perspective]}>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
          <BriefStatusBadge status={status} />
          {perspective === 'creator' && brief.brand && <span>From {brief.brand.brand_name}</span>}
          <span>Created {formatDate(brief.created_at)}</span>
          <span aria-hidden>·</span>
          <span>Updated {formatRelative(brief.updated_at)}</span>
        </div>
        {hasActions && <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div>}
      </PageHeader>

      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <f.icon className="size-3.5" aria-hidden /> {f.label}
            </dt>
            <dd className={cn('mt-1 truncate font-display text-lg font-semibold', f.muted && 'font-sans text-base font-normal text-faint')}>{f.value}</dd>
            {f.note && <dd className="text-xs font-medium text-danger">{f.note}</dd>}
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
        <div className="min-w-0 space-y-6">
          {canRespond && <BriefResponsePanel brief={brief} />}

          {isEmpty && (
            <EmptyState
              icon={<FileQuestion />}
              title={isOwner ? 'This brief is still empty' : 'No details yet'}
              description={
                isOwner
                  ? 'Add the objective, product, deliverables and talking points so creators know exactly what you need.'
                  : 'The brand hasn’t added campaign details yet. Send them a message if you have questions.'
              }
              action={
                canEdit ? (
                  <Button asChild size="sm">
                    <Link to={`/brand/briefs/${brief.id}/edit`}>
                      <Pencil /> Add details
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )}

          {hasCampaign && (
            <SectionCard title="Campaign">
              <TextBlock label="Objective" value={brief.campaign_objective} />
              <TextBlock label="Target audience" value={brief.target_audience} />
              <TextBlock label="Tone" value={brief.tone} />
            </SectionCard>
          )}

          {hasProduct && (
            <SectionCard title="Product">
              {(brief.product_name || productHref || brief.category) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {brief.product_name && <p className="font-medium">{brief.product_name}</p>}
                  {brief.category && (
                    <span className="rounded-pill bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-ink">{brief.category.name}</span>
                  )}
                  {productHref && (
                    <a
                      href={productHref}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="focus-ring inline-flex max-w-full items-center gap-1.5 rounded text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                    >
                      <Link2 className="size-4 shrink-0 text-muted" aria-hidden />
                      <span className="truncate">{displayUrl(productHref)}</span>
                      <ExternalLink className="size-3.5 shrink-0 text-faint" aria-hidden />
                    </a>
                  )}
                </div>
              )}
              <TextBlock label="Description" value={brief.product_description} />
            </SectionCard>
          )}

          {hasDeliverables && (
            <SectionCard title="Deliverables & usage">
              <TextBlock label="Deliverables" value={brief.deliverables} />
              <TextBlock label="Usage rights" value={brief.usage_rights} />
            </SectionCard>
          )}

          {brief.talking_points.length > 0 && (
            <SectionCard title="Mandatory talking points" description="Every one of these should come through in the content.">
              <ul className="space-y-2.5">
                {brief.talking_points.map((point, i) => (
                  <li key={`${point}-${i}`} className="flex items-start gap-2.5 text-sm">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span className="min-w-0 break-words text-ink-soft">{point}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {brief.do_not_say.length > 0 && (
            <SectionCard title="Do not say" description="Claims, words and names to keep out of the content.">
              <ul className="flex flex-wrap gap-2">
                {brief.do_not_say.map((item, i) => (
                  <li
                    key={`${item}-${i}`}
                    className="inline-flex max-w-full items-start gap-1.5 rounded-control bg-danger-soft px-3 py-1.5 text-sm font-medium text-danger"
                  >
                    <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{item}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {brief.reference_links.length > 0 && (
            <SectionCard title="Reference links">
              <ul className="space-y-2">
                {brief.reference_links.map((link, i) => {
                  const href = safeHref(link)
                  return (
                    <li key={`${link}-${i}`} className="flex min-w-0 items-center gap-2 text-sm">
                      <Link2 className="size-4 shrink-0 text-muted" aria-hidden />
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="focus-ring inline-flex min-w-0 items-center gap-1.5 rounded text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                        >
                          <span className="truncate">{displayUrl(href)}</span>
                          <ExternalLink className="size-3.5 shrink-0 text-faint" aria-hidden />
                        </a>
                      ) : (
                        <span className="truncate text-muted">{link}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </SectionCard>
          )}

          {brief.brief_attachments.length > 0 ? (
            <SectionCard title="Attachments" description="Files open in a new tab; download keeps the original file name.">
              <BriefAttachmentList attachments={[...brief.brief_attachments].sort((a, b) => a.created_at.localeCompare(b.created_at))} />
            </SectionCard>
          ) : (
            canEdit &&
            !isEmpty && (
              <SectionCard title="Attachments">
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Paperclip className="size-4 shrink-0" aria-hidden />
                  No files yet.
                  <Link to={`/brand/briefs/${brief.id}/edit#attachments`} className="focus-ring rounded font-medium text-ink underline-offset-4 hover:underline">
                    Add attachments
                  </Link>
                </p>
              </SectionCard>
            )
          )}
        </div>

        <aside aria-label="Brief status and people" className="min-w-0 space-y-6">
          <SectionCard title="Status" action={<BriefStatusBadge status={status} />}>
            <BriefTimeline brief={brief} perspective={perspective} />
          </SectionCard>

          {perspective === 'brand' && (
            <SectionCard title="Creator">
              {brief.creator ? (
                <div className="flex items-center gap-3">
                  <Avatar src={brief.creator.profile_image_url} name={brief.creator.display_name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 font-medium">
                      <span className="truncate">{brief.creator.display_name}</span>
                      {brief.creator.verified && <BadgeCheck className="size-4 shrink-0 fill-brand text-ink" aria-label="Verified" />}
                    </p>
                    <Link
                      to={`/brand/creators/${brief.creator.id}`}
                      className="focus-ring rounded text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
                    >
                      View profile
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Not sent yet. Share this brief with a creator to get their response.</p>
              )}
            </SectionCard>
          )}

          {brief.brand && <BriefBrandCard brand={brief.brand} title={perspective === 'brand' ? 'Your brand' : 'Brand'} />}
        </aside>
      </div>

      {canSend && <SendBriefDialog brief={brief} open={sendOpen} onOpenChange={setSendOpen} />}
      {canDelete && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete this draft?"
          description={`“${brief.title}” and its attachments will be permanently deleted.`}
          confirmLabel="Delete draft"
          destructive
          loading={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      )}
    </>
  )
}

function TextBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null
  return (
    <div>
      <h3 className="eyebrow text-faint">{label}</h3>
      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-ink-soft">{value}</p>
    </div>
  )
}
