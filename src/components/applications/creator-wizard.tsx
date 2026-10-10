import * as React from 'react'
import { Link } from 'react-router'
import { Controller, useForm, type Control, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { site } from '@/config/site'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { scrollToFirstError } from '@/lib/scroll-to-error'
import { toE164 } from '@/lib/phone-otp'
import { usePhoneVerification } from './phone-verify'
import {
  DUPLICATE_CODES,
  DUPLICATE_MESSAGES,
  checkApplicationDuplicates,
  submitApplication,
} from '@/services/applications.service'
import {
  BARTER_STANCES, COLLABORATIONS, TRAVEL_SCOPES, CONFIRMATION, CREATOR_APPLICATION_DEFAULTS, CREATOR_CATEGORIES,
  MAX_CATEGORIES, MAX_PHOTOS, MAX_VIDEOS, OPEN_TO, STEP_FIELDS, STEP_META,
  SUBMITTED_COPY, TOTAL_STEPS, creatorApplicationSchema, type CreatorApplicationValues,
} from '@/schemas/creator-application'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { CheckboxRow } from '@/components/ui/checkbox'
import { Chips, FileDrop, Money, MultiFileDrop, RadioRow } from './creator-wizard-parts'

type Form = UseFormReturn<CreatorApplicationValues>

const DRAFT_KEY = 'hoc:creator-application'

/**
 * The number field with its OTP action inside it.
 *
 * `Field` keeps the `Input` as its only child so the error stays bound to the
 * real input; the "Get OTP" control rides in the input's own `rightSlot`, and
 * the code box appears underneath once a code has been sent.
 */
function PhoneField({
  phone,
  verified,
  onVerified,
  error,
  register,
}: {
  phone: string
  verified: boolean
  onVerified: (e164: string) => void
  error?: string
  register: Form['register']
}) {
  const { trailing, panel } = usePhoneVerification({ phone, verified, onVerified })
  // India is the default, shown rather than assumed, so nobody has to wonder
  // which country the number is read as. It is a label, not a value: the field
  // holds the local number and `toE164` adds the +91. Someone typing their own
  // '+' is giving a country code, so the prefix gets out of their way.
  const ownCountryCode = phone.trim().startsWith('+')
  return (
    <div>
      <Field label="WhatsApp number" htmlFor="whatsapp" required error={error}>
        <Input
          id="whatsapp"
          type="tel"
          inputMode="tel"
          placeholder={ownCountryCode ? '+1 415 555 0123' : '98765 43210'}
          leftIcon={ownCountryCode ? undefined : <span className="text-sm text-ink-soft">+91</span>}
          rightSlot={trailing}
          className={cn(
            // Room for the widest label the slot ever shows ("Resend OTP"),
            // so a typed number never runs underneath it.
            trailing && 'pr-28',
            !ownCountryCode && 'pl-12',
          )}
          {...register('whatsapp')}
        />
      </Field>
      {panel}
    </div>
  )
}

// ===========================================================================
// Pages
// ===========================================================================
/** Exported so Admin → Forms can render the same UI applicants see. */
export function Page1({ form }: { form: Form }) {
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
        <Controller
          control={control}
          name="verified_phone"
          render={({ field: verifiedField }) => {
            const typed = form.watch('whatsapp')
            // Verified means "this exact number passed", so editing the field
            // retires the badge without any extra bookkeeping.
            const isVerified = Boolean(verifiedField.value) && toE164(typed) === verifiedField.value
            return (
              <PhoneField
                phone={typed}
                verified={isVerified}
                onVerified={(e164) => verifiedField.onChange(e164)}
                error={errors.whatsapp?.message}
                register={register}
              />
            )
          }}
        />
        <Field label="Email" htmlFor="email" required error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
        </Field>
      </div>

      {/* Referral code is half the width of the row, so the photo picker sits
          beside it rather than leaving a gap. `items-start` keeps the two
          aligned at the top: the hints under them are different lengths, and
          stretched boxes of unequal height would look like a mistake. */}
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field label="Referral code" htmlFor="referral_code" optional error={errors.referral_code?.message} hint="If a creator or brand invited you, enter their code.">
          <Input id="referral_code" autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="e.g. HOC1234" {...register('referral_code')} />
        </Field>

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

      <Controller
        control={control}
        name="city"
        render={({ field, fieldState }) => (
          <Field label="City" htmlFor="city" required error={fieldState.error?.message}>
            <Input id="city" placeholder="Enter your city" {...field} />
          </Field>
        )}
      />
    </div>
  )
}

/** Exported so Admin → Forms can render the same UI applicants see. */
export function Page2({ form }: { form: Form }) {
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

/** Exported so Admin → Forms can render the same UI applicants see. */
export function Page3({ control }: { control: Control<CreatorApplicationValues> }) {
  return (
    <div className="space-y-6">
      {/* The videos hint asks for brand work rather than just "a video": it is
          what a brand scrolling the storefront is actually trying to judge, and
          saying so up front beats reviewing a reel that shows nothing about how
          someone handles a collaboration. Phrased as a preference, not a rule —
          the field itself only requires a video. */}
      <Controller
        control={control}
        name="videos"
        render={({ field, fieldState }) => (
          <Field
            label="Videos"
            required
            error={fieldState.error?.message}
            hint={`If you can, include a brand collaboration or a video promoting a brand — that's what brands look for first. Up to ${MAX_VIDEOS}.`}
          >
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

/** Exported so Admin → Forms can render the same UI applicants see. */
export function Page4({ form }: { form: Form }) {
  const { control, formState: { errors } } = form
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
        name="barter_stance"
        render={({ field }) => (
          <Field label="Barter collaboration" className="border-t border-line pt-6">
            <RadioRow
              value={field.value || (form.getValues('barter_available') ? 'yes' : 'no')}
              onChange={(stance) => {
                field.onChange(stance)
                form.setValue('barter_available', stance !== 'no')
              }}
              options={BARTER_STANCES}
              name="barter_stance"
              label="Barter collaboration"
              className="flex min-w-0 max-w-full flex-wrap gap-x-7 gap-y-2"
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="travel_scope"
        render={({ field, fieldState }) => (
          <Field label="Open to travel" required error={fieldState.error?.message} className="border-t border-line pt-6">
            <RadioRow value={field.value} onChange={field.onChange} options={TRAVEL_SCOPES} name="travel_scope" label="Open to travel" />
          </Field>
        )}
      />
    </div>
  )
}

/** Exported so Admin → Forms can render the same UI applicants see. */
export function Page5({ control }: { control: Control<CreatorApplicationValues> }) {
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

/** Which page collects each of the two values we check for duplicates. */
const PHONE_STEP = 0
const INSTAGRAM_STEP = 1

/** One step of the live creator form — used by the wizard and Admin → Forms. */
export function CreatorApplicationStep({ step, form }: { step: number; form: Form }) {
  if (step === 0) return <Page1 form={form} />
  if (step === 1) return <Page2 form={form} />
  if (step === 2) return <Page3 control={form.control} />
  if (step === 3) return <Page4 form={form} />
  return <Page5 control={form.control} />
}

export function CreatorApplicationWizard() {
  const [step, setStep] = React.useState(0)
  const [done, setDone] = React.useState(false)
  const [checking, setChecking] = React.useState(false)
  const topRef = React.useRef<HTMLDivElement>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

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
    const sub = form.watch((values, { name }) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
      } catch {
        // nothing we can do, and nothing that should break the form
      }
      // A "already registered" error is about one specific value, so editing
      // that value retires it. Zod's own errors re-run on their own; this one
      // was set by hand and would otherwise sit there until the next Continue.
      if (name === 'whatsapp' && form.getFieldState('whatsapp').error?.type === 'duplicate') {
        form.clearErrors('whatsapp')
      }
      if (name === 'instagram.handle' && form.getFieldState('instagram.handle').error?.type === 'duplicate') {
        form.clearErrors('instagram.handle')
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
    onError: (e) => {
      const err = toAppError(e)
      // The trigger catches anyone who got past the per-page check — a stale
      // tab, a second tab, or a request that skipped the form entirely. Put the
      // message on the field it belongs to and go back to that page, rather
      // than showing it at the bottom of page 5 next to an unrelated button.
      const onPhone = err.code === DUPLICATE_CODES.phone || err.code === DUPLICATE_CODES.both
      const onInstagram = err.code === DUPLICATE_CODES.instagram || err.code === DUPLICATE_CODES.both
      if (onPhone) form.setError('whatsapp', { type: 'duplicate', message: DUPLICATE_MESSAGES.phone })
      if (onInstagram) form.setError('instagram.handle', { type: 'duplicate', message: DUPLICATE_MESSAGES.instagram })
      if (onPhone || onInstagram) {
        form.setError('root', {
          message: onPhone && onInstagram ? DUPLICATE_MESSAGES.both : onPhone ? DUPLICATE_MESSAGES.phone : DUPLICATE_MESSAGES.instagram,
        })
        go(onPhone ? PHONE_STEP : INSTAGRAM_STEP)
        scrollToFirstError(formRef.current)
        return
      }
      form.setError('root', { message: err.message })
      scrollToFirstError(formRef.current)
    },
  })

  const go = (next: number) => {
    setStep(next)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /**
   * Continue runs the page's own validation first, then — only on the two pages
   * that collect them — asks whether the number or the Instagram account is
   * already registered. Checked on Continue rather than per keystroke, so a
   * half-typed number never reports itself taken.
   *
   * The number is on page 1 and the account on page 2, so each is checked as
   * the creator leaves the page that asks for it, and the combined message is
   * left to submit, which is the only point where both have been entered.
   */
  const next = async () => {
    const ok = await form.trigger(STEP_FIELDS[step] as never)
    if (!ok) return scrollToFirstError(formRef.current)

    const phone = step === PHONE_STEP ? form.getValues('whatsapp') : null
    const instagram = step === INSTAGRAM_STEP ? form.getValues('instagram.handle') : null
    if (!phone && !instagram) return go(step + 1)

    setChecking(true)
    try {
      const taken = await checkApplicationDuplicates({ phone, instagram, email: form.getValues('email') })
      let blocked = false
      if (phone && taken.phone_taken) {
        form.setError('whatsapp', { type: 'duplicate', message: DUPLICATE_MESSAGES.phone })
        blocked = true
      }
      if (instagram && taken.instagram_taken) {
        form.setError('instagram.handle', { type: 'duplicate', message: DUPLICATE_MESSAGES.instagram })
        blocked = true
      }
      if (blocked) scrollToFirstError(formRef.current)
      else go(step + 1)
    } catch {
      // A dropped connection shouldn't strand someone three pages into a form.
      // This check is a courtesy; the insert trigger is the real gate, so let
      // them carry on and let the server have the final say at submit.
      go(step + 1)
    } finally {
      setChecking(false)
    }
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
    scrollToFirstError(formRef.current)
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
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault()
              if (last) void form.handleSubmit((v) => submit.mutate(v), onInvalid)(e)
              else void next()
            }}
            noValidate
          >
            <CreatorApplicationStep step={step} form={form} />

            {form.formState.errors.root?.message && (
              <p role="alert" className="mt-5 rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
                {form.formState.errors.root.message}
              </p>
            )}

            <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
              <Button type="button" variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}>
                <ArrowLeft /> Back
              </Button>
              {/* `loading` also disables the button, so a second click cannot
                  start a second check while the first is in flight. */}
              <Button type="submit" size="lg" loading={submit.isPending || checking}>
                {checking ? 'Checking…' : last ? 'Create my profile' : 'Continue'}
                {!last && !checking && <ArrowRight />}
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
