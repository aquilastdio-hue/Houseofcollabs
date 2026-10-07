import * as React from 'react'
import { Link } from 'react-router'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, BadgeCheck } from 'lucide-react'
import { site } from '@/config/site'
import { toAppError } from '@/lib/errors'
import { scrollToFirstError } from '@/lib/scroll-to-error'
import { POPULAR_CITIES } from '@/lib/constants'
import {
  DUPLICATE_CODES,
  DUPLICATE_MESSAGES,
  checkApplicationDuplicates,
  submitApplication,
} from '@/services/applications.service'
import {
  BRAND_APPLICATION_DEFAULTS, BRAND_CONFIRMATION, BRAND_STEP_META, BRAND_SUBMITTED_COPY, BRAND_TOTAL_STEPS,
  BUDGET_RANGES, COLLABORATION_TYPES, CREATOR_CATEGORIES, CREATOR_LOCATIONS, INDUSTRIES,
  MAX_SPECIFIC_CITIES, REGISTRATION_DOCS, STEP_FIELDS, brandApplicationSchema, summariseNeed,
  type BrandApplicationValues,
} from '@/schemas/brand-application'
import { Button } from '@/components/ui/button'
import { GoogleButton } from '@/components/auth/auth-parts'
import { signInWithGoogle } from '@/services/auth.service'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { Combobox, MultiSelect } from '@/components/ui/combobox'
import { CheckboxRow } from '@/components/ui/checkbox'
// Shared with the creator wizard — the uploader, chips and radio row are the
// same controls, so they live in one place rather than being rebuilt here.
import { Chips, FileDrop, RadioRow } from './creator-wizard-parts'

type Form = UseFormReturn<BrandApplicationValues>

const CITY_OPTIONS = POPULAR_CITIES.map((c) => ({ value: c, label: c }))
const DRAFT_KEY = 'hoc:brand-application'
const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }))

// ===========================================================================
// Pages
// ===========================================================================
/** Exported so Admin → Forms can render the same UI applicants see. */
export function Page1({ form }: { form: Form }) {
  const { control, register, formState: { errors } } = form
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Brand / company name" htmlFor="brand_name" required error={errors.brand_name?.message}>
          <Input id="brand_name" placeholder="e.g. your brand name" {...register('brand_name')} />
        </Field>
        <Field
          label="Website / Instagram handle"
          htmlFor="website_or_handle"
          required
          error={errors.website_or_handle?.message}
        >
          <Input id="website_or_handle" placeholder="yourbrand.com or @yourbrand" {...register('website_or_handle')} />
        </Field>
      </div>

      <Controller
        control={control}
        name="logo_path"
        render={({ field, fieldState }) => (
          <Field label="Brand logo" required error={fieldState.error?.message}>
            <FileDrop
              kind="image"
              path={field.value}
              label="Upload logo"
              hint="A square logo on a plain background works best."
              onUploaded={(p) => field.onChange(p)}
              onClear={() => field.onChange('')}
            />
          </Field>
        )}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Controller
          control={control}
          name="industry"
          render={({ field, fieldState }) => (
            <Field label="Industry / category" htmlFor="industry" required error={fieldState.error?.message}>
              <Select id="industry" value={field.value} onValueChange={field.onChange} options={opts(INDUSTRIES)} placeholder="Select" />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="location"
          render={({ field, fieldState }) => (
            <Field label="Company location" htmlFor="location" required error={fieldState.error?.message}>
              <Combobox id="location" value={field.value} onChange={field.onChange} options={CITY_OPTIONS} allowCustom clearable placeholder="Choose or type your city" />
            </Field>
          )}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Brand contact person" htmlFor="contact_person" required error={errors.contact_person?.message}>
          <Input id="contact_person" autoComplete="name" {...register('contact_person')} />
        </Field>
        <Field label="Designation" htmlFor="designation" required error={errors.designation?.message}>
          <Input id="designation" placeholder="e.g. Marketing Manager" {...register('designation')} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business email" htmlFor="business_email" required error={errors.business_email?.message}>
          <Input id="business_email" type="email" autoComplete="email" placeholder="you@yourbrand.com" {...register('business_email')} />
        </Field>
        <Field label="WhatsApp number" htmlFor="whatsapp" required error={errors.whatsapp?.message}>
          <Input id="whatsapp" type="tel" placeholder="+91 98765 43210" {...register('whatsapp')} />
        </Field>
      </div>
    </div>
  )
}

/** Exported so Admin → Forms can render the same UI applicants see. */
export function Page2({ form }: { form: Form }) {
  const { control, watch } = form
  const where = watch('creator_location')
  return (
    <div className="space-y-7">
      <Controller
        control={control}
        name="creator_categories"
        render={({ field, fieldState }) => (
          <Field label="Creator categories" required error={fieldState.error?.message}>
            <Chips name="Creator categories" options={CREATOR_CATEGORIES} value={field.value} onChange={field.onChange} />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="collaboration_types"
        render={({ field, fieldState }) => (
          <Field label="Collaboration type" required error={fieldState.error?.message} className="border-t border-line pt-6">
            <Chips name="Collaboration type" options={COLLABORATION_TYPES} value={field.value} onChange={field.onChange} />
          </Field>
        )}
      />

      <div className="space-y-4 border-t border-line pt-6">
        <Controller
          control={control}
          name="creator_location"
          render={({ field, fieldState }) => (
            <Field label="Creator location" required error={fieldState.error?.message}>
              <RadioRow value={field.value} onChange={field.onChange} options={CREATOR_LOCATIONS} name="creator_location" label="Creator location" />
            </Field>
          )}
        />
        {where === 'specific' && (
          <Controller
            control={control}
            name="specific_cities"
            render={({ field, fieldState }) => (
              <Field label="Which cities?" required error={fieldState.error?.message} hint={`Up to ${MAX_SPECIFIC_CITIES}.`}>
                <MultiSelect value={field.value} onChange={field.onChange} options={CITY_OPTIONS} max={MAX_SPECIFIC_CITIES} allowCustom placeholder="Choose cities" />
              </Field>
            )}
          />
        )}
      </div>

      <Controller
        control={control}
        name="budget_range"
        render={({ field, fieldState }) => (
          <Field label="Approx. campaign budget" htmlFor="budget_range" required error={fieldState.error?.message} className="border-t border-line pt-6">
            <Select id="budget_range" value={field.value} onValueChange={field.onChange} options={BUDGET_RANGES} placeholder="Select a range" />
          </Field>
        )}
      />
    </div>
  )
}

/** Exported so Admin → Forms can render the same UI applicants see. */
export function Page3({ form }: { form: Form }) {
  const { control, register, formState: { errors } } = form
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Business email"
          htmlFor="v_business_email"
          required
          error={errors.business_email?.message}
          hint="Preferably your company-domain email."
        >
          <Input id="v_business_email" type="email" {...register('business_email')} />
        </Field>
        <Field label="Company website" htmlFor="company_website" required error={errors.company_website?.message}>
          <Input id="company_website" placeholder="https://yourbrand.com" {...register('company_website')} />
        </Field>
      </div>

      <div className="space-y-4 border-t border-line pt-6">
        <Controller
          control={control}
          name="registration_doc_type"
          render={({ field, fieldState }) => (
            <Field label="Company / brand registration document" htmlFor="doc_type" optional error={fieldState.error?.message}>
              <Select id="doc_type" value={field.value} onValueChange={field.onChange} options={opts(REGISTRATION_DOCS)} placeholder="Choose a document type" />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="registration_doc_path"
          render={({ field, fieldState }) => (
            <Field error={fieldState.error?.message}>
              <FileDrop
                kind="document"
                path={field.value}
                label="Upload document"
                onUploaded={(p) => field.onChange(p)}
                onClear={() => field.onChange('')}
              />
            </Field>
          )}
        />
      </div>

      <Controller
        control={control}
        name="representative_id_path"
        render={({ field, fieldState }) => (
          <Field
            label="Authorized representative ID"
            required
            error={fieldState.error?.message}
            className="border-t border-line pt-6"
            hint="A valid professional or company ID, or an authorization document."
          >
            <FileDrop
              kind="document"
              path={field.value}
              label="Upload ID"
              onUploaded={(p) => field.onChange(p)}
              onClear={() => field.onChange('')}
            />
          </Field>
        )}
      />

      <div className="grid gap-5 border-t border-line pt-6 sm:grid-cols-2">
        <Field label="LinkedIn profile" htmlFor="linkedin_url" optional error={errors.linkedin_url?.message} hint="Company or authorized representative.">
          <Input id="linkedin_url" placeholder="https://linkedin.com/company/…" {...register('linkedin_url')} />
        </Field>
        <Field label="Instagram profile" htmlFor="instagram_url" required error={errors.instagram_url?.message}>
          <Input id="instagram_url" placeholder="@yourbrand" {...register('instagram_url')} />
        </Field>
      </div>

      <Controller
        control={control}
        name="authorized"
        render={({ field, fieldState }) => (
          <Field error={fieldState.error?.message} className="border-t border-line pt-6">
            <CheckboxRow id="authorized" label={BRAND_CONFIRMATION} checked={field.value} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
    </div>
  )
}

// ===========================================================================
// Wizard
// ===========================================================================
/**
 * Brands are self-serve, so this is the end of signing up rather than the start
 * of waiting. The account itself is created on first sign-in: the application
 * was written as approved, and the profile row that Google sign-in creates is
 * what triggers provisioning (migration 0068).
 *
 * Which is why the address is spelled out. Signing in with a different Google
 * account finds no application to claim and silently produces an account with
 * no brand attached — so the one address that works is on screen, not implied.
 */
function Submitted({ email }: { email: string }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle({ role: 'brand', redirect: '/brand' })
      // A redirect to Google follows; leave the button spinning behind it.
    } catch (e) {
      setError(toAppError(e).message)
      setBusy(false)
    }
  }

  return (
    <div className="container-page flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center py-12">
      <Card className="w-full max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-brand" aria-hidden>
          <BadgeCheck className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-display-sm font-semibold tracking-tight">{BRAND_SUBMITTED_COPY.title}</h1>
        <p className="mt-3 text-muted">{BRAND_SUBMITTED_COPY.body}</p>

        <div className="mt-7">
          <GoogleButton onClick={() => void go()} loading={busy} />
        </div>

        <p className="mt-3 text-sm text-muted">
          {BRAND_SUBMITTED_COPY.emailNote}{' '}
          {/* inline-block keeps the full address together: if it won't fit beside
              the note, the whole email moves to the next line instead of splitting. */}
          <span className="inline-block max-w-full font-medium break-all text-ink">{email}</span>
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <Button asChild variant="primary" size="md" className="mt-6">
          <Link to="/">Back to {site.name}</Link>
        </Button>
      </Card>
    </div>
  )
}

/** The page that collects the WhatsApp number. */
const PHONE_STEP = 0

/** One step of the live brand form — used by the wizard and Admin → Forms. */
export function BrandApplicationStep({ step, form }: { step: number; form: Form }) {
  if (step === 0) return <Page1 form={form} />
  if (step === 1) return <Page2 form={form} />
  return <Page3 form={form} />
}

export function BrandApplicationWizard() {
  const [step, setStep] = React.useState(0)
  const [done, setDone] = React.useState<string | null>(null)
  const [checking, setChecking] = React.useState(false)
  const topRef = React.useRef<HTMLDivElement>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  const form = useForm<BrandApplicationValues>({
    resolver: zodResolver(brandApplicationSchema),
    defaultValues: (() => {
      // Three pages with uploads is a lot to lose to a closed tab, and there is
      // no account yet to save against — so the draft lives in this browser.
      try {
        const saved = localStorage.getItem(DRAFT_KEY)
        if (saved) return { ...BRAND_APPLICATION_DEFAULTS, ...JSON.parse(saved) }
      } catch {
        // private mode, blocked storage, corrupt draft — start fresh
      }
      return BRAND_APPLICATION_DEFAULTS
    })(),
  })

  React.useEffect(() => {
    const sub = form.watch((values, { name }) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
      } catch {
        // nothing we can do, and nothing that should break the form
      }
      // Set by hand rather than by Zod, so it needs retiring by hand once the
      // value it complained about has changed.
      if (name === 'whatsapp' && form.getFieldState('whatsapp').error?.type === 'duplicate') {
        form.clearErrors('whatsapp')
      }
    })
    return () => sub.unsubscribe()
  }, [form])

  const submit = useMutation({
    mutationFn: (v: BrandApplicationValues) =>
      submitApplication({
        role: 'brand',
        // `applications.full_name` is NOT NULL and means the person we'd speak
        // to, which this form now asks for outright.
        full_name: v.contact_person,
        email: v.business_email,
        phone: v.whatsapp || null,
        city: v.location || null,
        brand_name: v.brand_name,
        website: v.company_website || v.website_or_handle || null,
        budget_range: v.budget_range || null,
        // The admin list and provisioning read this, so page 2 is summarised
        // into it rather than leaving it empty for every brand.
        looking_for: summariseNeed(v),
        categories: v.creator_categories.length ? v.creator_categories : null,
        image_path: v.logo_path || null,
        profile: {
          website_or_handle: v.website_or_handle,
          industry: v.industry,
          designation: v.designation,
          contact_person: v.contact_person,
          collaboration_types: v.collaboration_types,
          creator_location: v.creator_location,
          specific_cities: v.specific_cities,
          verification: {
            company_website: v.company_website,
            registration_doc_type: v.registration_doc_type,
            registration_doc_path: v.registration_doc_path,
            representative_id_path: v.representative_id_path,
            linkedin_url: v.linkedin_url,
            instagram_url: v.instagram_url,
            authorized: v.authorized,
          },
        },
      }),
    meta: { successMessage: 'Your brand account is ready' },
    // The submitted values carry the address the account will be claimed with.
    onSuccess: (_result, v) => {
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        // the draft is a convenience; failing to clear it is not an error
      }
      setDone(v.business_email)
    },
    onError: (e) => {
      const err = toAppError(e)
      if (err.code === DUPLICATE_CODES.phone || err.code === DUPLICATE_CODES.both) {
        form.setError('whatsapp', { type: 'duplicate', message: DUPLICATE_MESSAGES.phone })
        form.setError('root', { message: DUPLICATE_MESSAGES.phone })
        go(PHONE_STEP)
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
   * Page 1 collects the WhatsApp number, so that is where it is checked against
   * numbers already registered. A brand application carries no Instagram
   * handle — page 3 asks for a profile URL, which the form stores as a link
   * rather than as the identity we de-duplicate on — so only the number is
   * checked here.
   */
  const next = async () => {
    const ok = await form.trigger(STEP_FIELDS[step] as never)
    if (!ok) return scrollToFirstError(formRef.current)
    const phone = step === PHONE_STEP ? form.getValues('whatsapp') : null
    if (!phone) return go(step + 1)

    setChecking(true)
    try {
      const taken = await checkApplicationDuplicates({ phone, email: form.getValues('business_email') })
      if (taken.phone_taken) {
        form.setError('whatsapp', { type: 'duplicate', message: DUPLICATE_MESSAGES.phone })
        scrollToFirstError(formRef.current)
        return
      }
      go(step + 1)
    } catch {
      // The insert trigger is the real gate; a dropped request shouldn't trap
      // someone mid-form.
      go(step + 1)
    } finally {
      setChecking(false)
    }
  }

  /**
   * The last page validates all three, so an error can belong to a page they
   * aren't looking at. Jump to it rather than leaving them pressing a button
   * that seems to do nothing.
   */
  const onInvalid = (errors: Record<string, unknown>) => {
    const broken = Object.keys(errors)
    const owner = STEP_FIELDS.findIndex((fields) => (fields as readonly string[]).some((f) => broken.includes(f)))
    if (owner >= 0 && owner !== step) go(owner)
    scrollToFirstError(formRef.current)
  }

  if (done) return <Submitted email={done} />

  const meta = BRAND_STEP_META[step]
  const pct = Math.round(((step + 1) / BRAND_TOTAL_STEPS) * 100)
  const last = step === BRAND_TOTAL_STEPS - 1

  return (
    <div className="container-page py-10 sm:py-14">
      <div ref={topRef} className="mx-auto w-full max-w-2xl scroll-mt-(--header-height)">
        <h1 className="font-display text-display-md font-semibold tracking-tight">{meta.title}</h1>
        <p className="mt-2 text-muted">{meta.blurb}</p>

        <div className="mt-6 flex items-center gap-4">
          <Progress value={pct} tone="brand" className="flex-1" aria-label="Profile completion" />
          <span className="shrink-0 text-sm font-medium text-muted tabular-nums">
            Page {step + 1} of {BRAND_TOTAL_STEPS} · {pct}%
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
            <BrandApplicationStep step={step} form={form} />

            {form.formState.errors.root?.message && (
              <p role="alert" className="mt-5 rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
                {form.formState.errors.root.message}
              </p>
            )}

            <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
              <Button type="button" variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}>
                <ArrowLeft /> Back
              </Button>
              <Button type="submit" size="lg" loading={submit.isPending || checking}>
                {last ? 'Submit' : 'Continue'}
                {!last && <ArrowRight />}
              </Button>
            </div>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-muted">
          Your answers are saved in this browser as you go. We review every brand by hand.
        </p>
      </div>
    </div>
  )
}
