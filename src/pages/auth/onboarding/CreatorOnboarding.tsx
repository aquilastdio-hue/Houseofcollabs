import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, CircleCheck, Clock, Hourglass, LogOut, Rocket, Save } from 'lucide-react'
import { clamp } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { toAppError } from '@/lib/errors'
import { useAuth } from '@/contexts/auth-context'
import { useCompletion } from '@/hooks/use-creators'
import { usePublicSettings } from '@/hooks/use-catalog'
import { publishProfile, updateMyCreator, type CreatorProfile } from '@/services/creators.service'
import { completeOnboarding } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { FullPageLoader } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Logo } from '@/components/shared/logo'
import { Seo } from '@/components/shared/seo'
import { Stepper, type Step } from '@/components/shared/stepper'
import { BasicInfoForm } from '@/components/creator-studio/basic-info-form'
import { CreatorInfoForm } from '@/components/creator-studio/creator-info-form'
import { SocialAccountsEditor } from '@/components/creator-studio/social-accounts-editor'
import { IntroVideoForm } from '@/components/creator-studio/intro-video-form'
import { COMPLETION_STEP } from '@/components/creator-studio/completion-card'

const TOTAL_STEPS = 3

const STEPS: Step[] = [
  { key: 'about', label: 'About you' },
  { key: 'work', label: 'Your work' },
  { key: 'submit', label: 'Submit' },
]

const STEP_COPY: Record<number, { title: string; description: string }> = {
  1: { title: 'About you', description: 'Your photo, name and a short bio. This is what a brand sees first.' },
  2: { title: 'Your work', description: 'Where you post, a quick hello on video, and the kind of creator you are.' },
  3: { title: 'Submit for review', description: 'That’s everything we need. Send it over and we’ll get you approved.' },
}

function StepFooter({ onBack, note, children }: { onBack?: () => void; note?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        {note && <span className="text-center text-xs text-muted sm:text-right">{note}</span>}
        {children}
      </div>
    </div>
  )
}

function SubmitStep({ creator, onBack, onFix }: { creator: CreatorProfile; onBack: () => void; onFix: (step: number) => void }) {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const completion = useCompletion()
  const settings = usePublicSettings()
  const needsReview = settings.data?.require_creator_approval !== false
  const submitted = creator.status === 'pending_review' || creator.status === 'published'
  const missing = completion.data?.items.filter((i) => i.required && !i.done) ?? []

  const publish = useMutation({
    mutationFn: async () => {
      const row = await publishProfile()
      await completeOnboarding()
      await Promise.all([
        refresh(),
        qc.invalidateQueries({ queryKey: qk.creators.completion }),
        qc.invalidateQueries({ queryKey: qk.dashboard.creator }),
      ])
      return row
    },
    onSuccess: (row) => {
      if (row.status === 'published') toast.success('Your profile is live', { description: 'Brands can now discover and hire you.' })
      else toast.success('Submitted for review', { description: 'We’ll notify you as soon as your profile is approved.' })
      navigate('/creator', { replace: true })
    },
  })

  const label = submitted
    ? 'Go to my dashboard'
    : creator.status === 'rejected'
      ? 'Resubmit for review'
      : needsReview
        ? 'Submit for review'
        : 'Publish my storefront'

  const nextSteps = needsReview
    ? [
        'We check your profile to keep the marketplace trustworthy — usually within a day.',
        'You’ll get an email and a notification the moment it’s approved.',
        'Then you set your prices, add portfolio pieces and start taking orders.',
      ]
    : [
        'Your storefront goes live straight away.',
        'Next you’ll set your prices so brands can order from you.',
        'Add portfolio pieces any time to win more work.',
      ]

  return (
    <Card className="p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden>
          {needsReview ? <Hourglass className="size-5" /> : <Rocket className="size-5" />}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight">{needsReview ? 'What happens next' : 'Go live'}</h2>
          <ol className="mt-3 space-y-2.5">
            {nextSteps.map((text, i) => (
              <li key={text} className="flex gap-3 text-sm text-ink-soft">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-ink">{i + 1}</span>
                <span className="pt-0.5">{text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {creator.status === 'rejected' && creator.rejection_reason && (
        <div className="mt-6 rounded-control bg-warning-soft px-4 py-3 text-sm text-warning">
          <p className="font-medium">Note from our team</p>
          <p className="mt-0.5 whitespace-pre-line">{creator.rejection_reason}</p>
        </div>
      )}

      <div className="mt-6">
        {completion.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : completion.isError ? (
          <ErrorState compact error={completion.error} title="Couldn’t check your profile" onRetry={() => void completion.refetch()} />
        ) : missing.length > 0 ? (
          <div className="rounded-card border border-warning/30 bg-warning-soft/60 p-4">
            <p className="text-sm font-medium text-warning">
              {submitted ? 'Already with our team — but these would strengthen your profile:' : 'Just these left:'}
            </p>
            <ul className="mt-2 divide-y divide-warning/15">
              {missing.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{item.label}</span>
                  <Button type="button" size="xs" variant="secondary" onClick={() => onFix(COMPLETION_STEP[item.key] ?? 1)} aria-label={`Fix: ${item.label}`}>
                    Fix
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-card bg-success-soft px-4 py-3 text-sm font-medium text-success">
            <CircleCheck className="size-4 shrink-0" aria-hidden /> You’re done — nothing else needed right now.
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-muted">
        By submitting you agree to follow our{' '}
        <Link to="/creator-guidelines" target="_blank" className="font-medium text-ink underline underline-offset-2">
          creator guidelines
        </Link>
        .
      </p>

      <StepFooter onBack={onBack}>
        <Button
          type="button"
          size="lg"
          loading={publish.isPending}
          disabled={!submitted && (completion.isPending || !completion.data?.can_publish)}
          onClick={() => publish.mutate()}
        >
          <Rocket /> {label}
        </Button>
      </StepFooter>
    </Card>
  )
}

function OnboardingFlow({ initialStep }: { initialStep: number }) {
  const { creator, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = React.useState(initialStep)
  const [furthest, setFurthest] = React.useState(initialStep)
  const completion = useCompletion(!!creator)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const mounted = React.useRef(false)
  const percent = creator ? (completion.data?.percent ?? 0) : 0

  // Move focus + scroll to the new step's heading (skipped on first render).
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    headingRef.current?.focus({ preventScroll: true })
  }, [step])

  const persistStep = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => updateMyCreator(id, { onboarding_step: value }),
    meta: { silent: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.creators.mine }),
  })

  /** Moves to `target`; going forward is validated and saved as progress. */
  const goTo = (target: number, creatorId = creator?.id) => {
    const next = clamp(target, 1, TOTAL_STEPS)
    if (next > step && next >= 2 && !creatorId) {
      toast.error('Save your details first.')
      return
    }
    setStep(next)
    if (next > furthest) {
      setFurthest(next)
      if (creatorId) persistStep.mutate({ id: creatorId, value: next })
    }
  }

  const saveExit = useMutation({
    mutationFn: async (id: string) => updateMyCreator(id, { onboarding_step: Math.max(furthest, step) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.creators.mine })
      if (profile?.onboarding_completed) navigate('/creator')
      else toast.success('Progress saved', { description: 'Come back any time — we’ll pick up right where you left off.' })
    },
  })

  const onSaveExit = () => {
    if (!creator) {
      toast.info('Save your details first — then we can keep your progress.')
      return
    }
    saveExit.mutate(creator.id)
  }

  const onLogout = async () => {
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(toAppError(e).message)
    }
  }

  const back = () => goTo(step - 1)
  const copy = STEP_COPY[step]!

  let content: React.ReactNode
  if (step === 1) {
    content = (
      <Card className="p-5 sm:p-8">
        <BasicInfoForm essentials submitLabel="Save & continue" onSaved={(row) => goTo(2, row.id)} />
      </Card>
    )
  } else if (!creator) {
    content = (
      <EmptyState
        title="Start with your details"
        description="Save the first step to create your profile, then continue from here."
        action={<Button onClick={() => setStep(1)}>Go to step 1</Button>}
      />
    )
  } else if (step === 2) {
    content = (
      <Card className="space-y-10 p-5 sm:p-8">
        <SocialAccountsEditor creator={creator} />
        <Separator />
        <IntroVideoForm creator={creator} />
        <Separator />
        <CreatorInfoForm
          creator={creator}
          essentials
          submitLabel="Save & continue"
          onSaved={() => goTo(3)}
          secondaryAction={
            <Button type="button" variant="ghost" onClick={back}>
              <ArrowLeft /> Back
            </Button>
          }
        />
      </Card>
    )
  } else {
    content = <SubmitStep creator={creator} onBack={back} onFix={setStep} />
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <Seo title="Create your creator profile" noindex />
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="container-page flex h-(--header-height) items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-4">
            {creator && (
              <div className="hidden w-44 sm:block" aria-live="polite">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Profile</span>
                  <span className="font-medium tabular-nums">{percent}% complete</span>
                </div>
                <Progress value={percent} tone={percent >= 100 ? 'success' : 'brand'} className="mt-1.5 h-1.5" aria-label={`Profile ${percent}% complete`} />
              </div>
            )}
            {creator && <span className="text-xs font-medium tabular-nums text-muted sm:hidden">{percent}%</span>}
            <Button type="button" variant="secondary" size="sm" onClick={onSaveExit} loading={saveExit.isPending}>
              <Save /> Save &amp; exit
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void onLogout()} aria-label="Log out">
              <LogOut /> <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="container-page py-6 sm:py-10">
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1 py-1">
          <Stepper
            steps={STEPS}
            current={step - 1}
            completed={Array.from({ length: Math.max(0, furthest - 1) }, (_, i) => i)}
            onStepClick={(index) => goTo(index + 1)}
            className="min-w-0"
          />
        </div>

        <div className="mx-auto mt-8 max-w-3xl sm:mt-10">
          <div className="mb-6">
            <p className="eyebrow hidden text-muted md:block">
              Step {step} of {TOTAL_STEPS}
            </p>
            <h1 ref={headingRef} tabIndex={-1} className="font-display text-display-md font-semibold focus:outline-none md:mt-2">
              {copy.title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-muted">{copy.description}</p>
          </div>

          {step === 1 && (
            <p className="mb-6 flex items-start gap-2.5 rounded-card border border-line bg-subtle/60 px-4 py-3 text-sm text-ink-soft">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              <span>
                <span className="font-medium text-ink">This takes about five minutes.</span> We only ask what we need to approve you. Prices, portfolio and
                payout details come later, from your dashboard.
              </span>
            </p>
          )}

          {content}
        </div>
      </main>
    </div>
  )
}

/**
 * Three-step creator signup: about you → your work → submit for review.
 * Deliberately short — it collects only what a reviewer needs to tell whether
 * this is a real creator. Pricing, portfolio, add-ons and payout details are
 * prompted afterwards from the dashboard checklist, as the creator moves
 * towards actual campaigns. Resumes at the saved `onboarding_step`.
 */
export default function CreatorOnboarding() {
  const { profileLoading, accountLoading, creator } = useAuth()
  if (profileLoading || accountLoading) return <FullPageLoader />
  const initialStep = creator ? clamp(creator.onboarding_step ?? 1, 1, TOTAL_STEPS) : 1
  return <OnboardingFlow initialStep={initialStep} />
}
