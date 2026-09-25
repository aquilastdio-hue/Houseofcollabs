import * as React from 'react'
import { Link } from 'react-router'
import { Controller, useForm, type Control, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { site } from '@/config/site'
import { toAppError } from '@/lib/errors'
import { POPULAR_CITIES } from '@/lib/constants'
import { submitApplication } from '@/services/applications.service'
import {
  BARTER_STANCES, COLLABORATIONS, CONFIRMATION, CREATOR_APPLICATION_DEFAULTS, CREATOR_CATEGORIES,
  MAX_CATEGORIES, MAX_PHOTOS, MAX_VIDEOS, OPEN_TO, STEP_FIELDS, STEP_META,
  SUBMITTED_COPY, TOTAL_STEPS, creatorApplicationSchema, type CreatorApplicationValues,
} from '@/schemas/creator-application'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Combobox } from '@/components/ui/combobox'
import { CheckboxRow } from '@/components/ui/checkbox'
import { Chips, FileDrop, Money, MultiFileDrop, RadioRow, YesNo } from './creator-wizard-parts'

type Form = UseFormReturn<CreatorApplicationValues>

const CITY_OPTIONS = POPULAR_CITIES.map((c) => ({ value: c, label: c }))
const DRAFT_KEY = 'hoc:creator-application'

// ===========================================================================
// Pages
// ===========================================================================
function Page1({ form }: { form: Form }) {
  const { control, register, formState: { errors } } = form
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="full_name" required error={errors.full_name?.message}>
          <Input id="full_name" autoComplete="name" {...register('full_name')} />
        </Field>
        <Field label="Creator / Instagram name" htmlFor="creator_name" required error={errors.creator_name?.message} hint="What brands will see.">
          <Input id="creator_name" {...register('creator_name')} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="WhatsApp number" htmlFor="whatsapp" required error={errors.whatsapp?.message}>
          <Input id="whatsapp" type="tel" placeholder="+91 98765 43210" {...register('whatsapp')} />
        </Field>
        <Field label="Email" htmlFor="email" required error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
        </Field>
      </div>

      <Controller
        control={control}
        name="city"
        render={({ field, fieldState }) => (
          <Field label="City" htmlFor="city" required error={fieldState.error?.message}>
            <Combobox id="city" value={field.value} onChange={field.onChange} options={CITY_OPTIONS} allowCustom clearable placeholder="Choose or type your city" />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="photo_path"
        render={({ field, fieldState }) => (
          <Field label="Profile photo" required error={fieldState.error?.message}>
            <FileDrop
              kind="image"
              path={field.value}
              label="Upload photo"
              hint="A well-lit headshot works best."
              onUploaded={(p) => field.onChange(p)}
              onClear={() => field.onChange('')}
            />
          </Field>
        )}
      />
    </div>
  )
}

function Page2({ form }: { form: Form }) {
  const { control, register, formState: { errors } } = form
  return (
    <div className="space-y-7">
      <section className="space-y-5">
        <h3 className="text-sm font-semibold tracking-wide text-ink uppercase">Instagram</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Instagram account" htmlFor="ig_handle" required error={errors.instagram?.handle?.message}>
            <Input id="ig_handle" placeholder="@username" {...register('instagram.handle')} />
          </Field>
          <Field label="Instagram profile link" htmlFor="ig_url" required error={errors.instagram?.url?.message}>
            <Input id="ig_url" placeholder="https://instagram.com/username" {...register('instagram.url')} />
          </Field>
        </div>
        <Field label="Followers" htmlFor="ig_followers" required error={errors.instagram?.followers?.message}>
          <Input id="ig_followers" inputMode="numeric" placeholder="25,000" {...register('instagram.followers')} />
        </Field>
      </section>

      <section className="space-y-5 border-t border-line pt-6">
        <h3 className="text-sm font-semibold tracking-wide text-ink uppercase">YouTube</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="YouTube link" htmlFor="yt_url" optional error={errors.youtube?.url?.message}>
            <Input id="yt_url" placeholder="https://youtube.com/@channel" {...register('youtube.url')} />
          </Field>
          <Field label="YouTube subscribers" htmlFor="yt_subs" optional error={errors.youtube?.subscribers?.message}>
            <Input id="yt_subs" inputMode="numeric" placeholder="12,000" {...register('youtube.subscribers')} />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-line pt-6">
        <h3 className="text-sm font-semibold tracking-wide text-ink uppercase">Your content categories</h3>
        <Controller
          control={control}
          name="categories"
          render={({ field, fieldState }) => (
            <Field required error={fieldState.error?.message}>
              <Chips name="Content categories" options={CREATOR_CATEGORIES} value={field.value} onChange={field.onChange} max={MAX_CATEGORIES} />
            </Field>
          )}
        />
      </section>
    </div>
  )
}

function Page3({ control }: { control: Control<CreatorApplicationValues> }) {
  return (
    <div className="space-y-6">
      <Controller
        control={control}
        name="videos"
        render={({ field, fieldState }) => (
          <Field label="Videos" required error={fieldState.error?.message} hint={`Up to ${MAX_VIDEOS}.`}>
            <MultiFileDrop kind="video" value={field.value} onChange={field.onChange} max={MAX_VIDEOS} label="Add videos" />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="photos"
        render={({ field, fieldState }) => (
          <Field label="Photos" required error={fieldState.error?.message} hint={`Up to ${MAX_PHOTOS}.`}>
            <MultiFileDrop kind="image" value={field.value} onChange={field.onChange} max={MAX_PHOTOS} label="Add photos" />
          </Field>
        )}
      />
    </div>
  )
}

function Page4({ form }: { form: Form }) {
  const { control, watch, formState: { errors } } = form
  const barter = watch('barter_available')
  return (
    <div className="space-y-5">
      {COLLABORATIONS.map((row) => (
        <Controller
          key={row.key}
          control={control}
          name={`rates.${row.key}`}
          render={({ field, fieldState }) => (
            <Field
              label={row.label}
              htmlFor={`rate_${row.key}`}
              error={fieldState.error?.message}
              className="sm:grid sm:grid-cols-[1fr_12rem] sm:items-center sm:gap-4"
            >
              <Money id={`rate_${row.key}`} value={field.value} onChange={field.onChange} invalid={!!fieldState.error} />
            </Field>
          )}
        />
      ))}

      {errors.rates?.ugc_video?.message && (
        <p role="alert" className="text-sm text-danger">
          {errors.rates.ugc_video.message}
        </p>
      )}

      <Controller
        control={control}
        name="barter_available"
        render={({ field }) => (
          <Field label="Barter collaboration" className="border-t border-line pt-6 sm:grid sm:grid-cols-[1fr_12rem] sm:items-center sm:gap-4">
            <YesNo value={field.value} onChange={field.onChange} name="barter" label="Barter collaboration" />
          </Field>
        )}
      />

      {barter && (
        <Controller
          control={control}
          name="barter_stance"
          render={({ field, fieldState }) => (
            <Field label="How does barter work for you?" required error={fieldState.error?.message}>
              <RadioRow value={field.value} onChange={field.onChange} options={BARTER_STANCES} name="barter_stance" label="Barter" />
            </Field>
          )}
        />
      )}
    </div>
  )
}

function Page5({ control }: { control: Control<CreatorApplicationValues> }) {
  return (
    <div className="space-y-6">
      <Controller
        control={control}
        name="open_to"
        render={({ field }) => (
          <Field label="Open to" optional>
            <Chips name="Open to" options={OPEN_TO} value={field.value} onChange={field.onChange} />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="confirmed"
        render={({ field, fieldState }) => (
          <Field error={fieldState.error?.message} className="border-t border-line pt-6">
            <CheckboxRow id="confirmed" label={CONFIRMATION} checked={field.value} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
    </div>
  )
}

// ===========================================================================
// Wizard
// ===========================================================================
function Submitted() {
  return (
    <div className="container-page flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center py-12">
      <Card className="w-full max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-brand" aria-hidden>
          <Sparkles className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-display-sm font-semibold tracking-tight">{SUBMITTED_COPY.title}</h1>
        <p className="mt-3 text-muted">{SUBMITTED_COPY.body}</p>
        <Button asChild className="mt-7" size="lg">
          <Link to="/">Back to {site.name}</Link>
        </Button>
      </Card>
    </div>
  )
}

export function CreatorApplicationWizard() {
  const [step, setStep] = React.useState(0)
  const [done, setDone] = React.useState(false)
  const topRef = React.useRef<HTMLDivElement>(null)

  const form = useForm<CreatorApplicationValues>({
    resolver: zodResolver(creatorApplicationSchema),
    defaultValues: (() => {
      // Five pages with uploads is a long way to lose to a closed tab, and
      // there is no account yet to save against — so the draft lives in this
      // browser only.
      try {
        const saved = localStorage.getItem(DRAFT_KEY)
        if (saved) return { ...CREATOR_APPLICATION_DEFAULTS, ...JSON.parse(saved) }
      } catch {
        // private mode, blocked storage, corrupt draft — start fresh
      }
      return CREATOR_APPLICATION_DEFAULTS
    })(),
  })

  React.useEffect(() => {
    const sub = form.watch((values) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
      } catch {
        // nothing we can do, and nothing that should break the form
      }
    })
    return () => sub.unsubscribe()
  }, [form])

  const submit = useMutation({
    mutationFn: (v: CreatorApplicationValues) => {
      const { full_name, creator_name, email, whatsapp, city, categories, instagram, youtube, videos, photos, ...rest } = v
      return submitApplication({
        role: 'creator',
        full_name,
        email,
        phone: whatsapp || null,
        city: city || null,
        categories: categories.length ? categories : null,
        social_platform: 'instagram',
        social_handle: instagram.handle || null,
        followers_count: instagram.followers ? Number(instagram.followers) : null,
        portfolio_url: instagram.url || youtube.url || null,
        // The first of each is mirrored into its own column so the admin list
        // and the existing provisioning keep working; the full set lives in
        // `profile` alongside everything else this form collects.
        video_path: videos[0] ?? null,
        image_path: photos[0] ?? null,
        profile: { creator_name, instagram, youtube, videos, photos, ...rest },
      })
    },
    meta: { successMessage: 'Profile submitted' },
    onSuccess: () => {
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        // the draft is a convenience; failing to clear it is not an error
      }
      setDone(true)
    },
    onError: (e) => form.setError('root', { message: toAppError(e).message }),
  })

  const go = (next: number) => {
    setStep(next)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const next = async () => {
    const ok = await form.trigger(STEP_FIELDS[step] as never)
    if (ok) go(step + 1)
  }

  /**
   * The last page validates all five, so an error can belong to a page the
   * creator isn't looking at. Jump to it rather than leaving them pressing a
   * button that seems to do nothing.
   */
  const onInvalid = (errors: Record<string, unknown>) => {
    const broken = Object.keys(errors)
    const owner = STEP_FIELDS.findIndex((fields) => (fields as readonly string[]).some((f) => broken.includes(f)))
    if (owner >= 0 && owner !== step) go(owner)
  }

  if (done) return <Submitted />

  const meta = STEP_META[step]
  const pct = Math.round(((step + 1) / TOTAL_STEPS) * 100)
  const last = step === TOTAL_STEPS - 1

  return (
    <div className="container-page py-10 sm:py-14">
      <div ref={topRef} className="mx-auto w-full max-w-2xl scroll-mt-(--header-height)">
        <h1 className="font-display text-display-md font-semibold tracking-tight">{meta.title}</h1>
        <p className="mt-2 text-muted">{meta.blurb}</p>

        <div className="mt-6 flex items-center gap-4">
          <Progress value={pct} tone="brand" className="flex-1" aria-label="Profile completion" />
          <span className="shrink-0 text-sm font-medium text-muted tabular-nums">
            Page {step + 1} of {TOTAL_STEPS} · {pct}%
          </span>
        </div>

        <Card className="mt-6 p-5 sm:p-8">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (last) void form.handleSubmit((v) => submit.mutate(v), onInvalid)(e)
              else void next()
            }}
            noValidate
          >
            {step === 0 && <Page1 form={form} />}
            {step === 1 && <Page2 form={form} />}
            {step === 2 && <Page3 control={form.control} />}
            {step === 3 && <Page4 form={form} />}
            {step === 4 && <Page5 control={form.control} />}

            {form.formState.errors.root?.message && (
              <p role="alert" className="mt-5 rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
                {form.formState.errors.root.message}
              </p>
            )}

            <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
              <Button type="button" variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}>
                <ArrowLeft /> Back
              </Button>
              <Button type="submit" size="lg" loading={submit.isPending}>
                {last ? 'Create my profile' : 'Continue'}
                {!last && <ArrowRight />}
              </Button>
            </div>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-muted">
          Your answers are saved in this browser as you go. We review every profile by hand.
        </p>
      </div>
    </div>
  )
}
