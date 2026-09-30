import * as React from 'react'
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfToday } from 'date-fns'
import { toast } from 'sonner'
import { FileQuestion, IndianRupee, Link2, Lock, Paperclip, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { CONTENT_TYPES, PLATFORMS } from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'
import { useCategories } from '@/hooks/use-catalog'
import { createBrief, getBrief, updateBrief, type BriefDetail } from '@/services/briefs.service'
import type { Brand } from '@/types'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { BrandMissing } from '@/components/brand/brand-missing'
import { CharCount } from '@/components/brand/char-count'
import { SectionCard } from '@/components/brand/section-card'
import { isHttpUrl, isUuid } from '@/components/brand/validators'
import { BriefAttachmentsManager } from '@/components/briefs/brief-attachments'
import { BriefChecklist } from '@/components/briefs/brief-checklist'
import {
  BRIEF_LIMITS,
  briefToFormValues,
  EMPTY_BRIEF_VALUES,
  formValuesToInput,
  listError,
  makeBriefSchema,
  USAGE_RIGHTS_PRESETS,
  type BriefFormValues,
} from '@/components/briefs/brief-form-schema'
import { BriefStatusBadge } from '@/components/briefs/brief-status'
import { ListInput } from '@/components/briefs/list-input'

const FORM_ID = 'brief-form'

export default function BriefEditor() {
  const { id } = useParams()
  const { brand, user } = useAuth()
  const editing = id !== undefined
  const validId = !!id && isUuid(id)
  const query = useQuery({ queryKey: qk.briefs.detail(id ?? ''), queryFn: () => getBrief(id!), enabled: validId })
  const title = editing ? 'Edit brief' : 'New brief'

  if (!brand || !user) {
    return (
      <EditorShell title={title}>
        <BrandMissing />
      </EditorShell>
    )
  }
  if (!editing) return <BriefForm brand={brand} userId={user.id} />
  if (!validId) {
    return (
      <EditorShell title={title}>
        <BriefNotFound />
      </EditorShell>
    )
  }
  if (query.isPending) return <EditorSkeleton />
  if (query.isError && !query.data) {
    return (
      <EditorShell title={title}>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </EditorShell>
    )
  }
  const brief = query.data
  if (!brief || brief.brand_id !== brand.id) {
    return (
      <EditorShell title={title}>
        <BriefNotFound />
      </EditorShell>
    )
  }
  if (brief.status === 'completed') {
    return (
      <EditorShell title={title} brief={brief}>
        <EmptyState
          icon={<Lock />}
          title="This brief is completed"
          description="Completed briefs are kept as a record of the collaboration and can’t be edited."
          action={
            <Button asChild size="sm">
              <Link to={`/brand/briefs/${brief.id}`}>View brief</Link>
            </Button>
          }
        />
      </EditorShell>
    )
  }
  return <BriefForm key={brief.id} brand={brand} brief={brief} userId={user.id} />
}

function EditorShell({ title, brief, children }: { title: string; brief?: BriefDetail; children: React.ReactNode }) {
  return (
    <>
      <Seo title={title} noindex />
      <Breadcrumb
        items={[
          { label: 'Briefs', href: '/brand/briefs' },
          ...(brief ? [{ label: brief.title, href: `/brand/briefs/${brief.id}` }] : []),
          { label: title },
        ]}
      />
      <PageHeader title={title} />
      {children}
    </>
  )
}

function BriefNotFound() {
  return (
    <EmptyState
      icon={<FileQuestion />}
      title="Brief not found"
      description="It may have been deleted, or the link is incorrect."
      action={
        <Button asChild size="sm">
          <Link to="/brand/briefs">Back to briefs</Link>
        </Button>
      }
    />
  )
}

function EditorSkeleton() {
  return (
    <>
      <Seo title="Edit brief" noindex />
      <div aria-hidden>
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="mb-8 h-9 w-56" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:gap-8">
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-4 rounded-card border border-line bg-surface p-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="hidden h-80 rounded-card lg:block" />
        </div>
      </div>
    </>
  )
}

function BriefForm({ brand, brief, userId }: { brand: Brand; brief?: BriefDetail; userId: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const categories = useCategories()
  const today = React.useMemo(() => startOfToday(), [])
  const next = React.useRef<'detail' | 'attachments'>('detail')
  const leaving = React.useRef(false)

  const schema = React.useMemo(() => makeBriefSchema({ keepDeadline: brief?.deadline ?? null }), [brief?.deadline])
  const form = useForm<BriefFormValues>({
    resolver: zodResolver(schema),
    defaultValues: brief ? briefToFormValues(brief) : EMPTY_BRIEF_VALUES,
    mode: 'onTouched',
  })
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = form
  const usageRights = useWatch({ control, name: 'usage_rights' })

  const save = useMutation({
    mutationFn: (values: BriefFormValues) => {
      const input = formValuesToInput(values)
      return brief ? updateBrief(brief.id, input) : createBrief(brand.id, input)
    },
    onSuccess: (saved, values) => {
      leaving.current = true
      form.reset(values)
      toast.success(brief ? 'Brief updated' : 'Draft saved')
      void qc.invalidateQueries({ queryKey: qk.briefs.all })
      void qc.invalidateQueries({ queryKey: qk.dashboard.brand })
      navigate(next.current === 'attachments' ? `/brand/briefs/${saved.id}/edit#attachments` : `/brand/briefs/${saved.id}`)
    },
  })

  const onSubmit = handleSubmit(
    (values) => save.mutate(values),
    () => toast.error('Some details need your attention — check the highlighted fields.'),
  )

  // Unsaved-changes guard (in-app navigation + tab close / reload).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => !leaving.current && isDirty && currentLocation.pathname !== nextLocation.pathname,
  )
  React.useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  React.useEffect(() => {
    if (location.hash === '#attachments') document.getElementById('attachments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  const categoryOptions = React.useMemo(() => {
    const options = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))
    const current = brief?.category
    if (current && !options.some((o) => o.value === current.id)) options.push({ value: current.id, label: current.name })
    return options
  }, [categories.data, brief?.category])

  const pageTitle = brief ? 'Edit brief' : 'New brief'
  const who = brief?.creator?.display_name
  const notice =
    brief?.status === 'sent'
      ? `Sent to ${who ?? 'a creator'}. They’ll see your changes as soon as you save.`
      : brief?.status === 'accepted'
        ? `${who ?? 'The creator'} accepted this brief. They’ll see your changes as soon as you save, so put anything important in the brief itself.`
        : brief?.status === 'rejected'
          ? `${who ?? 'The creator'} declined this brief. Update it, then send it to another creator.`
          : null

  const cancelHref = brief ? `/brand/briefs/${brief.id}` : '/brand/briefs'
  const savingDetail = save.isPending && next.current === 'detail'
  const saveButton = (
    <Button
      type="submit"
      form={FORM_ID}
      block
      loading={savingDetail}
      disabled={save.isPending}
      onClick={() => {
        next.current = 'detail'
      }}
    >
      {!savingDetail && <Save />}
      {brief ? 'Save changes' : 'Save draft'}
    </Button>
  )

  return (
    <>
      <Seo title={brief ? `Edit · ${brief.title}` : 'New brief'} noindex />
      <Breadcrumb
        items={[
          { label: 'Briefs', href: '/brand/briefs' },
          ...(brief ? [{ label: brief.title, href: `/brand/briefs/${brief.id}` }] : []),
          { label: brief ? 'Edit' : 'New brief' },
        ]}
      />
      <PageHeader
        title={pageTitle}
        description={
          brief
            ? 'Keep your brief up to date so creators always work from the latest details.'
            : 'Everything a creator needs to say yes. Save a draft now and finish it later.'
        }
      />
      {notice && <p className="mb-6 rounded-card border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">{notice}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:gap-8">
        <div className="min-w-0 space-y-6">
          <form id={FORM_ID} noValidate onSubmit={onSubmit} className="space-y-6">
            <SectionCard title="Campaign" description="What this collaboration should achieve.">
              <div className="flex items-center gap-3 rounded-control border border-line bg-subtle/60 px-3.5 py-2.5">
                <Avatar src={brand.brand_logo_url} name={brand.brand_name} size="sm" shape="rounded" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">Brand</p>
                  <p className="truncate text-sm font-medium">{brand.brand_name}</p>
                </div>
                <Link
                  to="/brand/settings/profile"
                  className="focus-ring shrink-0 rounded text-xs font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Edit brand profile
                </Link>
              </div>
              <Field
                label="Brief title"
                htmlFor="title"
                required
                hint="Creators see this first — make it specific."
                error={errors.title?.message}
                labelAction={<CharCount control={control} name="title" max={BRIEF_LIMITS.title} />}
              >
                <Input id="title" placeholder="e.g. Monsoon skincare launch — Instagram Reels" autoComplete="off" {...register('title')} />
              </Field>
              <Field
                label="Campaign objective"
                htmlFor="campaign_objective"
                optional
                error={errors.campaign_objective?.message}
                labelAction={<CharCount control={control} name="campaign_objective" max={BRIEF_LIMITS.campaign_objective} />}
              >
                <Textarea
                  id="campaign_objective"
                  rows={4}
                  placeholder="What should this content achieve? e.g. Drive first purchases of our new sunscreen among college students."
                  {...register('campaign_objective')}
                />
              </Field>
            </SectionCard>

            <SectionCard title="Product" description="What the creator will feature.">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  label="Product name"
                  htmlFor="product_name"
                  optional
                  error={errors.product_name?.message}
                  labelAction={<CharCount control={control} name="product_name" max={BRIEF_LIMITS.product_name} />}
                >
                  <Input id="product_name" placeholder="e.g. Daily Glow SPF 50 sunscreen" {...register('product_name')} />
                </Field>
                <Field label="Product link" htmlFor="product_url" optional error={errors.product_url?.message}>
                  <Input
                    id="product_url"
                    type="url"
                    inputMode="url"
                    placeholder="https://yourbrand.com/product"
                    leftIcon={<Link2 />}
                    {...register('product_url')}
                  />
                </Field>
              </div>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <Field
                    label="Category"
                    htmlFor="category_id"
                    optional
                    hint={categories.isError ? 'Categories couldn’t be loaded — you can add one later.' : undefined}
                    error={errors.category_id?.message}
                  >
                    <Select
                      id="category_id"
                      value={field.value}
                      onValueChange={field.onChange}
                      options={categoryOptions}
                      anyLabel="No category"
                      placeholder={categories.isPending ? 'Loading categories…' : 'Choose a category'}
                      disabled={categories.isPending}
                    />
                  </Field>
                )}
              />
              <Field
                label="Product description"
                htmlFor="product_description"
                optional
                error={errors.product_description?.message}
                labelAction={<CharCount control={control} name="product_description" max={BRIEF_LIMITS.product_description} />}
              >
                <Textarea
                  id="product_description"
                  rows={4}
                  placeholder="Key features, variants, price point and anything the creator should know."
                  {...register('product_description')}
                />
              </Field>
            </SectionCard>

            <SectionCard title="Content" description="What you need the creator to make.">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="content_type"
                  render={({ field }) => (
                    <Field label="Content type" htmlFor="content_type" optional error={errors.content_type?.message}>
                      <Select
                        id="content_type"
                        value={field.value}
                        onValueChange={field.onChange}
                        options={CONTENT_TYPES}
                        anyLabel="Not specified"
                        placeholder="Choose a format"
                      />
                    </Field>
                  )}
                />
                <Controller
                  control={control}
                  name="platform"
                  render={({ field }) => (
                    <Field label="Platform" htmlFor="platform" optional hint="Pick one or type your own." error={errors.platform?.message}>
                      <Combobox
                        id="platform"
                        value={field.value}
                        onChange={field.onChange}
                        options={PLATFORMS}
                        allowCustom
                        clearable
                        placeholder="Where it will be posted"
                        searchPlaceholder="Search or type a platform"
                      />
                    </Field>
                  )}
                />
              </div>
              <Field
                label="Deliverables"
                htmlFor="deliverables"
                optional
                error={errors.deliverables?.message}
                labelAction={<CharCount control={control} name="deliverables" max={BRIEF_LIMITS.deliverables} />}
              >
                <Textarea
                  id="deliverables"
                  rows={3}
                  placeholder="e.g. 1 × 30–45s Instagram Reel + 3 story frames with a link sticker"
                  {...register('deliverables')}
                />
              </Field>
              <Field
                label="Target audience"
                htmlFor="target_audience"
                optional
                error={errors.target_audience?.message}
                labelAction={<CharCount control={control} name="target_audience" max={BRIEF_LIMITS.target_audience} />}
              >
                <Textarea
                  id="target_audience"
                  rows={3}
                  placeholder="e.g. Women 20–30 in metro cities who are new to skincare"
                  {...register('target_audience')}
                />
              </Field>
              <Field
                label="Tone"
                htmlFor="tone"
                optional
                error={errors.tone?.message}
                labelAction={<CharCount control={control} name="tone" max={BRIEF_LIMITS.tone} />}
              >
                <Input id="tone" placeholder="e.g. Warm, honest and a little playful — no hard sell" {...register('tone')} />
              </Field>
              <Controller
                control={control}
                name="reference_links"
                render={({ field }) => (
                  <Field
                    label="Reference links"
                    htmlFor="reference_links"
                    optional
                    hint={`Examples of content you love — up to ${BRIEF_LIMITS.reference_links} links.`}
                    error={listError(errors.reference_links)}
                  >
                    <ListInput
                      id="reference_links"
                      layout="rows"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      max={BRIEF_LIMITS.reference_links}
                      maxLength={BRIEF_LIMITS.link}
                      placeholder="https://instagram.com/reel/…"
                      addLabel="Add link"
                      validate={(v) => (isHttpUrl(v) ? null : 'Links must start with http:// or https://')}
                    />
                  </Field>
                )}
              />
            </SectionCard>

            <SectionCard title="Guardrails" description="Messages that must land — and lines not to cross.">
              <Controller
                control={control}
                name="talking_points"
                render={({ field }) => (
                  <Field
                    label="Mandatory talking points"
                    htmlFor="talking_points"
                    optional
                    hint={`Key messages the creator must include — up to ${BRIEF_LIMITS.talking_points}, ${BRIEF_LIMITS.list_item} characters each.`}
                    error={listError(errors.talking_points)}
                  >
                    <ListInput
                      id="talking_points"
                      layout="rows"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      max={BRIEF_LIMITS.talking_points}
                      maxLength={BRIEF_LIMITS.list_item}
                      placeholder="e.g. Mention the 30-day money-back guarantee"
                      addLabel="Add point"
                    />
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="do_not_say"
                render={({ field }) => (
                  <Field
                    label="Do not say"
                    htmlFor="do_not_say"
                    optional
                    hint={`Claims, words or competitor names to avoid — up to ${BRIEF_LIMITS.do_not_say}.`}
                    error={listError(errors.do_not_say)}
                  >
                    <ListInput
                      id="do_not_say"
                      tone="danger"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      max={BRIEF_LIMITS.do_not_say}
                      maxLength={BRIEF_LIMITS.list_item}
                      placeholder="e.g. Don’t call it “medicated”"
                    />
                  </Field>
                )}
              />
            </SectionCard>

            <SectionCard title="Timeline & budget" description="When you need it, what you can spend and how you’ll use the content.">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="deadline"
                  render={({ field }) => (
                    <Field label="Deadline" htmlFor="deadline" optional hint="When you need the final content." error={errors.deadline?.message}>
                      <DatePicker
                        id="deadline"
                        value={field.value || null}
                        onChange={(v) => {
                          field.onChange(v ?? '')
                          field.onBlur()
                        }}
                        minDate={today}
                        placeholder="Pick a date"
                      />
                    </Field>
                  )}
                />
                <Field label="Budget" htmlFor="budget" optional hint="In rupees, for this brief." error={errors.budget?.message}>
                  <Input
                    id="budget"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="1"
                    placeholder="e.g. 15000"
                    leftIcon={<IndianRupee />}
                    {...register('budget')}
                  />
                </Field>
              </div>
              <div className="space-y-2.5">
                <Field
                  label="Usage rights"
                  htmlFor="usage_rights"
                  optional
                  hint="How and where you’ll use the content, and for how long."
                  error={errors.usage_rights?.message}
                  labelAction={<CharCount control={control} name="usage_rights" max={BRIEF_LIMITS.usage_rights} />}
                >
                  <Textarea
                    id="usage_rights"
                    rows={3}
                    placeholder="e.g. Organic social only, reshared on our brand channels."
                    {...register('usage_rights')}
                  />
                </Field>
                <div role="group" aria-label="Usage rights presets" className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">Quick presets:</span>
                  {USAGE_RIGHTS_PRESETS.map((preset) => {
                    const active = (usageRights ?? '').trim() === preset.text
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setValue('usage_rights', preset.text, { shouldDirty: true, shouldValidate: true })}
                        className={cn(
                          'focus-ring rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors',
                          active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                        )}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </SectionCard>
          </form>

          <SectionCard id="attachments" title="Attachments" description="Mood boards, product sheets, brand guidelines or sample videos.">
            {brief ? (
              <BriefAttachmentsManager brief={brief} userId={userId} />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-subtle/50 px-6 py-8 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card">
                  <Paperclip className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium">Save the draft to add attachments</p>
                  <p className="mt-0.5 text-xs text-muted">Files are stored privately and shared only with the creator you send the brief to.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={save.isPending && next.current === 'attachments'}
                  disabled={save.isPending}
                  onClick={() => {
                    next.current = 'attachments'
                    void onSubmit()
                  }}
                >
                  Save draft &amp; add files
                </Button>
              </div>
            )}
          </SectionCard>

          <div className="sticky bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-card border border-line bg-surface/95 p-2.5 shadow-float backdrop-blur-md md:bottom-4 lg:hidden">
            <Button asChild variant="ghost" className="shrink-0">
              <Link to={cancelHref}>Cancel</Link>
            </Button>
            <div className="min-w-0 flex-1">{saveButton}</div>
          </div>
        </div>

        <aside aria-label="Brief summary" className="lg:sticky lg:top-[calc(var(--header-height)_+_1.5rem)] lg:self-start">
          <div className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold tracking-tight">Brief status</h2>
              <BriefStatusBadge status={brief?.status ?? 'draft'} />
            </div>
            <BriefChecklist control={control} />
            <Separator />
            <div className="hidden space-y-2 lg:block">
              {saveButton}
              <Button asChild variant="ghost" block>
                <Link to={cancelHref}>Cancel</Link>
              </Button>
            </div>
            {!brief && <p className="text-xs text-muted">Drafts are private. You’ll choose a creator to send it to after saving.</p>}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset()
        }}
        title="Discard unsaved changes?"
        description="You’ve edited this brief. If you leave now, those changes will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </>
  )
}
