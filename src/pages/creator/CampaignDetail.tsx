import { Link, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { IndianRupee, Link2, Send } from 'lucide-react'
import { formatDate, formatINR } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { useAuth } from '@/contexts/auth-context'
import { applyToCampaign, getCampaign, withdrawApplication, type CreatorCampaign } from '@/services/campaigns.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { ErrorState } from '@/components/shared/states'
import { SectionCard } from '@/components/brand/section-card'
import { ApplicationStatusBadge, CampaignBrandLine, CampaignOverview, MatchList, isApplyClosed } from '@/components/campaigns/campaign-ui'

const applySchema = z.object({
  pitch: z.string().trim().min(20, 'Write at least a couple of sentences (20+ characters)').max(2000, 'Keep it under 2,000 characters'),
  proposed_fee: z
    .string()
    .transform((v) => v.replace(/[,\s₹]/g, ''))
    .refine((v) => v === '' || /^\d+$/.test(v), 'Enter a whole number'),
  sample_url: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Use a full link starting with https://'),
})
type ApplyValues = z.input<typeof applySchema>

/** Creator → one campaign: the brief, how you fit, and apply / your application. */
export default function CampaignDetail() {
  const { id = '' } = useParams()
  const query = useQuery({ queryKey: qk.campaigns.detail(id), queryFn: () => getCampaign(id), enabled: !!id })
  const c = query.data as CreatorCampaign | undefined

  return (
    <>
      <Seo title={c?.title ?? 'Campaign'} noindex />
      <Breadcrumb items={[{ label: 'Campaigns', href: '/creator/campaigns' }, { label: c?.title ?? 'Campaign' }]} />
      {query.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError || !c ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <PageHeader
            title={c.title}
            description={<CampaignBrandLine campaign={c} />}
            actions={
              <div className="flex flex-wrap gap-2">
                {c.invited && <Badge tone="brand">Invited</Badge>}
                {c.my_application && <ApplicationStatusBadge status={c.my_application.status} />}
              </div>
            }
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <CampaignOverview campaign={c} />
            <aside className="space-y-6 lg:sticky lg:top-6">
              <SectionCard title="How you fit" description="Anyone can apply — this just shows what the brand asked for.">
                <MatchList campaign={c} match={c.match} />
              </SectionCard>
              {c.my_application && c.my_application.status !== 'withdrawn' ? <MyApplicationCard campaign={c} /> : <ApplyCard campaign={c} />}
            </aside>
          </div>
        </>
      )}
    </>
  )
}

function ApplyCard({ campaign: c }: { campaign: CreatorCampaign }) {
  const { creator } = useAuth()
  const qc = useQueryClient()
  const live = creator?.status === 'published' && !creator.deleted_at
  const closed = isApplyClosed(c)
  const offersFee = c.compensation !== 'barter'
  const form = useForm<ApplyValues>({ resolver: zodResolver(applySchema), defaultValues: { pitch: '', proposed_fee: '', sample_url: '' } })
  const apply = useMutation({
    mutationFn: (v: z.output<typeof applySchema>) =>
      applyToCampaign(c.id, { pitch: v.pitch, proposed_fee: v.proposed_fee ? Number(v.proposed_fee) : null, sample_url: v.sample_url || null }),
    meta: { successMessage: 'Application sent' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.campaigns.all }),
  })
  const { register, formState: { errors } } = form

  if (closed) {
    return (
      <SectionCard title="Applications closed">
        <p className="text-sm text-muted">This campaign isn’t taking applications anymore.</p>
      </SectionCard>
    )
  }
  if (!live) {
    return (
      <SectionCard title="Apply">
        <p className="text-sm text-muted">Your profile needs to be live before you can apply to campaigns.</p>
        <Button asChild variant="secondary" size="sm" className="mt-3">
          <Link to="/creator/profile">Finish your profile</Link>
        </Button>
      </SectionCard>
    )
  }
  return (
    <SectionCard title="Apply" description={c.apply_by ? `Applications close ${formatDate(c.apply_by)}.` : undefined}>
      <form noValidate onSubmit={form.handleSubmit((v) => apply.mutate(v as unknown as z.output<typeof applySchema>))} className="space-y-4">
        <Field label="Why you’re a good fit" htmlFor="pitch" required error={errors.pitch?.message} hint="Your audience, your idea for the content, and anything the brand should know.">
          <Textarea id="pitch" rows={6} placeholder="e.g. My audience is mostly women 22–30 in Delhi who follow my weekly skincare routines…" {...register('pitch')} />
        </Field>
        {offersFee && (
          <Field
            label="Your fee"
            htmlFor="proposed_fee"
            optional
            error={errors.proposed_fee?.message}
            hint={c.fee_per_creator != null ? `The brand is offering ${formatINR(c.fee_per_creator)}. Leave blank to accept that.` : undefined}
          >
            <Input id="proposed_fee" inputMode="numeric" placeholder="e.g. 8000" leftIcon={<IndianRupee />} {...register('proposed_fee')} />
          </Field>
        )}
        <Field label="Best example of your work" htmlFor="sample_url" optional error={errors.sample_url?.message}>
          <Input id="sample_url" inputMode="url" placeholder="https://instagram.com/reel/…" leftIcon={<Link2 />} {...register('sample_url')} />
        </Field>
        <Button type="submit" block loading={apply.isPending}>
          <Send /> Send application
        </Button>
      </form>
    </SectionCard>
  )
}

function MyApplicationCard({ campaign: c }: { campaign: CreatorCampaign }) {
  const qc = useQueryClient()
  const a = c.my_application!
  const withdraw = useMutation({
    mutationFn: () => withdrawApplication(c.id),
    meta: { successMessage: 'Application withdrawn' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.campaigns.all }),
  })
  const copy = {
    pending: 'The brand is reviewing applications. You’ll get a notification when they decide.',
    accepted: 'The brand accepted you for this campaign. They’ll be in touch about next steps.',
    rejected: 'The brand went with other creators this time.',
    withdrawn: '',
  }[a.status]
  return (
    <SectionCard title="Your application" action={<ApplicationStatusBadge status={a.status} size="sm" />}>
      <p className="text-sm text-muted">{copy}</p>
      {a.brand_note && (
        <div className="mt-3 rounded-control bg-subtle px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-muted">Note from the brand</p>
          <p className="mt-0.5 whitespace-pre-line">{a.brand_note}</p>
        </div>
      )}
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Your pitch</dt>
          <dd className="mt-0.5 whitespace-pre-line">{a.pitch}</dd>
        </div>
        {a.proposed_fee != null && (
          <div>
            <dt className="text-xs text-muted">Your fee</dt>
            <dd className="mt-0.5">{formatINR(a.proposed_fee)}</dd>
          </div>
        )}
        {a.sample_url && (
          <div>
            <dt className="text-xs text-muted">Example</dt>
            <dd className="mt-0.5 truncate">
              <a href={a.sample_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {a.sample_url.replace(/^https?:\/\//, '')}
              </a>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted">Sent</dt>
          <dd className="mt-0.5">{formatDate(a.created_at)}</dd>
        </div>
      </dl>
      {a.status === 'pending' && (
        <Button variant="ghost" size="sm" className="mt-4" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>
          Withdraw application
        </Button>
      )}
    </SectionCard>
  )
}
