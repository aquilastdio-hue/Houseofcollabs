import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfToday } from 'date-fns'
import { toast } from 'sonner'
import { z } from 'zod'
import { Gift, IndianRupee, Save, Send, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { PLATFORMS } from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'
import { useCategories } from '@/hooks/use-catalog'
import { getCampaign, saveCampaign, submitCampaign, type CampaignInput, type InvitedCreator, type ManagedCampaign } from '@/services/campaigns.service'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioCard, RadioGroup } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { BrandMissing } from '@/components/brand/brand-missing'
import { SectionCard } from '@/components/brand/section-card'
import { ListInput } from '@/components/briefs/list-input'
import { CreatorInvitePicker } from '@/components/campaigns/creator-invite-picker'

const whole = z
  .string()
  .transform((v) => v.replace(/[,\s₹]/g, ''))
  .refine((v) => v === '' || /^\d+$/.test(v), 'Enter a whole number')

const schema = z
  .object({
    title: z.string().trim().min(3, 'Give the campaign a name').max(140, 'Use 140 characters or fewer'),
    brief: z.string().trim().min(20, 'Describe the campaign in a few sentences').max(5000, 'Use 5,000 characters or fewer'),
    deliverables: z.string().trim().min(3, 'Say what each creator should make').max(2000, 'Use 2,000 characters or fewer'),
    platforms: z.array(z.string()).max(5),
    reference_links: z.array(z.string()).max(10, 'Up to 10 links'),
    compensation: z.enum(['paid', 'barter', 'both']),
    fee_per_creator: whole,
    barter_details: z.string().trim().max(1000, 'Use 1,000 characters or fewer'),
    creators_needed: whole,
    category_ids: z.array(z.string()).max(20),
    min_followers: whole,
    max_followers: whole,
    cities: z.array(z.string()).max(20, 'Up to 20 cities'),
    apply_by: z.string(),
    invites: z.array(z.custom<InvitedCreator>()).max(50),
  })
  .superRefine((v, ctx) => {
    const need = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.compensation !== 'barter' && !v.fee_per_creator) need('fee_per_creator', 'Enter the fee per creator')
    if (v.compensation !== 'paid' && !v.barter_details) need('barter_details', 'Say what product creators get')
    const n = Number(v.creators_needed)
    if (!v.creators_needed || n < 1 || n > 500) need('creators_needed', 'Between 1 and 500')
    if (v.min_followers && v.max_followers && Number(v.max_followers) < Number(v.min_followers)) {
      need('max_followers', 'Must be at least the minimum')
    }
    if (v.apply_by && v.apply_by < new Date().toISOString().slice(0, 10)) need('apply_by', 'Pick today or a later date')
  })

type Values = z.input<typeof schema>

const EMPTY: Values = {
  title: '',
  brief: '',
  deliverables: '',
  platforms: ['instagram'],
  reference_links: [],
  compensation: 'paid',
  fee_per_creator: '',
  barter_details: '',
  creators_needed: '1',
  category_ids: [],
  min_followers: '',
  max_followers: '',
  cities: [],
  apply_by: '',
  invites: [],
}

function toValues(c: ManagedCampaign): Values {
  const s = (n: number | null) => (n == null ? '' : String(n))
  return {
    title: c.title,
    brief: c.brief,
    deliverables: c.deliverables,
    platforms: c.platforms,
    reference_links: c.reference_links,
    compensation: c.compensation,
    fee_per_creator: s(c.fee_per_creator),
    barter_details: c.barter_details ?? '',
    creators_needed: String(c.creators_needed),
    category_ids: c.category_ids,
    min_followers: s(c.min_followers),
    max_followers: s(c.max_followers),
    cities: c.cities,
    apply_by: c.apply_by ?? '',
    invites: c.invites,
  }
}

function toInput(v: Values): CampaignInput {
  const n = (x: string) => (x.replace(/[,\s₹]/g, '') === '' ? null : Number(x.replace(/[,\s₹]/g, '')))
  return {
    title: v.title.trim(),
    brief: v.brief.trim(),
    deliverables: v.deliverables.trim(),
    platforms: v.platforms,
    reference_links: v.reference_links,
    compensation: v.compensation,
    fee_per_creator: v.compensation === 'barter' ? null : n(v.fee_per_creator),
    barter_details: v.compensation === 'paid' ? null : v.barter_details.trim() || null,
    creators_needed: n(v.creators_needed) ?? 1,
    category_ids: v.category_ids,
    min_followers: n(v.min_followers),
    max_followers: n(v.max_followers),
    cities: v.cities,
    apply_by: v.apply_by || null,
    invite_creator_ids: v.invites.map((c) => c.id),
  }
}

/** Brand → new campaign, or edit a draft / one sent back for changes. */
export default function CampaignEditor() {
  const { id } = useParams()
  const { brand } = useAuth()
  const query = useQuery({ queryKey: qk.campaigns.detail(id ?? ''), queryFn: () => getCampaign(id!), enabled: !!id })
  const title = id ? 'Edit campaign' : 'New campaign'
  const crumbs = <Breadcrumb items={[{ label: 'Campaigns', href: '/brand/campaigns' }, { label: title }]} />

  if (!brand) {
    return (
      <>
        {crumbs}
        <BrandMissing />
      </>
    )
  }
  if (!id) return <CampaignForm crumbs={crumbs} />
  if (query.isPending) return <Skeleton className="h-96 w-full" />
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const c = query.data as ManagedCampaign
  if (c.status !== 'draft' && c.status !== 'rejected') {
    return (
      <>
        {crumbs}
        <EmptyState title="This campaign can’t be edited" description="Only drafts and campaigns sent back for changes can be edited." />
      </>
    )
  }
  return <CampaignForm crumbs={crumbs} campaign={c} />
}

function CampaignForm({ campaign, crumbs }: { campaign?: ManagedCampaign; crumbs: React.ReactNode }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const categories = useCategories()
  const today = React.useMemo(() => startOfToday(), [])
  const form = useForm<Values>({ resolver: zodResolver(schema) as never, defaultValues: campaign ? toValues(campaign) : EMPTY })
  const { control, register, handleSubmit, formState: { errors } } = form
  const compensation = useWatch({ control, name: 'compensation' })
  const submitAfterSave = React.useRef(false)

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const savedId = await saveCampaign(campaign?.id ?? null, toInput(v))
      if (submitAfterSave.current) await submitCampaign(savedId)
      return savedId
    },
    onSuccess: async (savedId) => {
      toast.success(submitAfterSave.current ? 'Sent for review' : 'Draft saved')
      await qc.invalidateQueries({ queryKey: qk.campaigns.all })
      navigate(`/brand/campaigns/${savedId}`)
    },
  })
  const run = (submit: boolean) => {
    submitAfterSave.current = submit
    void handleSubmit((v) => save.mutate(v))()
  }

  return (
    <>
      <Seo title={campaign ? 'Edit campaign' : 'New campaign'} noindex />
      {crumbs}
      <PageHeader
        title={campaign ? 'Edit campaign' : 'New campaign'}
        description="Every campaign is checked by the House of Collabs team before creators can see it."
      />
      {campaign?.status === 'rejected' && campaign.review_note && (
        <div className="mb-6 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <p className="font-medium">What to change</p>
          <p className="mt-0.5 whitespace-pre-line">{campaign.review_note}</p>
        </div>
      )}
      <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-6 pb-24">
        <SectionCard title="Campaign" description="What it’s about, in your words.">
          <div className="space-y-5">
            <Field label="Campaign name" htmlFor="title" required error={errors.title?.message}>
              <Input id="title" placeholder="e.g. Diwali glow launch" {...register('title')} />
            </Field>
            <Field label="Brief" htmlFor="brief" required error={errors.brief?.message} hint="The product, the idea, the tone, and anything creators must or mustn’t say.">
              <Textarea id="brief" rows={7} {...register('brief')} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Content" description="What each creator makes.">
          <div className="space-y-5">
            <Field label="Deliverables" htmlFor="deliverables" required error={errors.deliverables?.message} hint="e.g. 1 Reel + 2 stories, posted between 1–5 Nov.">
              <Textarea id="deliverables" rows={3} {...register('deliverables')} />
            </Field>
            <Controller
              control={control}
              name="platforms"
              render={({ field }) => (
                <Field label="Platforms" optional>
                  <ChipToggle
                    options={PLATFORMS.filter((p) => ['instagram', 'youtube', 'facebook', 'x', 'threads'].includes(p.value)).map((p) => ({ value: p.value, label: p.label }))}
                    value={field.value}
                    onChange={field.onChange}
                    max={5}
                  />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="reference_links"
              render={({ field }) => (
                <Field label="Reference links" htmlFor="reference_links" optional error={errors.reference_links?.message} hint="Posts you like, your product page, a mood board.">
                  <ListInput
                    id="reference_links"
                    value={field.value}
                    onChange={field.onChange}
                    max={10}
                    layout="rows"
                    placeholder="https://"
                    validate={(v) => (/^https?:\/\/\S+$/i.test(v) ? null : 'Use a full link starting with https://')}
                  />
                </Field>
              )}
            />
          </div>
        </SectionCard>

        <SectionCard title="Payment" description="What creators get for taking part.">
          <div className="space-y-5">
            <Controller
              control={control}
              name="compensation"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-3" aria-label="Payment type">
                  <RadioCard value="paid" icon={<Wallet />} title="Paid" description="A fixed fee per creator" />
                  <RadioCard value="barter" icon={<Gift />} title="Barter" description="Your product, no fee" />
                  <RadioCard value="both" icon={<IndianRupee />} title="Both" description="Fee plus product" />
                </RadioGroup>
              )}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              {compensation !== 'barter' && (
                <Field label="Fee per creator" htmlFor="fee_per_creator" required error={errors.fee_per_creator?.message} hint="Creators can suggest a different fee when they apply.">
                  <Input id="fee_per_creator" inputMode="numeric" placeholder="e.g. 8000" leftIcon={<IndianRupee />} {...register('fee_per_creator')} />
                </Field>
              )}
              {compensation !== 'paid' && (
                <Field label="What creators get" htmlFor="barter_details" required error={errors.barter_details?.message} className={cn(compensation === 'barter' && 'sm:col-span-2')}>
                  <Input id="barter_details" placeholder="e.g. Full serum kit worth ₹3,500" {...register('barter_details')} />
                </Field>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Creators" description="Who you’re looking for. Leave a requirement empty to keep it open — any live creator can apply either way.">
          <div className="space-y-5">
            <Field label="How many creators" htmlFor="creators_needed" required error={errors.creators_needed?.message}>
              <Input id="creators_needed" inputMode="numeric" className="max-w-40" {...register('creators_needed')} />
            </Field>
            <Controller
              control={control}
              name="category_ids"
              render={({ field }) => (
                <Field label="Categories" optional>
                  <ChipToggle options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} value={field.value} onChange={field.onChange} max={20} />
                </Field>
              )}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Minimum followers" htmlFor="min_followers" optional error={errors.min_followers?.message}>
                <Input id="min_followers" inputMode="numeric" placeholder="e.g. 5000" {...register('min_followers')} />
              </Field>
              <Field label="Maximum followers" htmlFor="max_followers" optional error={errors.max_followers?.message}>
                <Input id="max_followers" inputMode="numeric" placeholder="e.g. 100000" {...register('max_followers')} />
              </Field>
            </div>
            <Controller
              control={control}
              name="cities"
              render={({ field }) => (
                <Field label="Cities" htmlFor="cities" optional error={errors.cities?.message}>
                  <ListInput id="cities" value={field.value} onChange={field.onChange} max={20} placeholder="e.g. Delhi" />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="invites"
              render={({ field }) => (
                <Field label="Invite specific creators" optional hint="Invited creators get a notification and an “Invited” tag on the campaign.">
                  <CreatorInvitePicker value={field.value} onChange={field.onChange} />
                </Field>
              )}
            />
          </div>
        </SectionCard>

        <SectionCard title="Timing">
          <Controller
            control={control}
            name="apply_by"
            render={({ field }) => (
              <Field label="Apply by" htmlFor="apply_by" optional hint="Applications close after this date." error={errors.apply_by?.message}>
                <DatePicker id="apply_by" value={field.value || null} onChange={(v) => field.onChange(v ?? '')} minDate={today} placeholder="No deadline" />
              </Field>
            )}
          />
        </SectionCard>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
            <p className="mr-auto hidden text-xs text-muted sm:block">Submitted campaigns are reviewed before they go live.</p>
            <Button type="button" variant="secondary" loading={save.isPending && !submitAfterSave.current} disabled={save.isPending} onClick={() => run(false)}>
              <Save /> Save draft
            </Button>
            <Button type="button" loading={save.isPending && submitAfterSave.current} disabled={save.isPending} onClick={() => run(true)}>
              <Send /> Submit for review
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}

/** Toggle chips for picking several options. */
function ChipToggle({ options, value, onChange, max }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; max: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={!on && value.length >= max}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              'focus-ring rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40',
              on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
