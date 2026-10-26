import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { toAppError } from '@/lib/errors'
import {
  BRAND_APPLICATION_DEFAULTS,
  BRAND_STEP_META,
  BRAND_TOTAL_STEPS,
  STEP_FIELDS,
  brandApplicationSchema,
  type BrandApplicationValues,
} from '@/schemas/brand-application'
import { invokeFunction } from '@/lib/supabase/functions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/combobox'
import { CheckboxRow } from '@/components/ui/checkbox'
import { FileDrop, RadioRow } from '@/components/applications/creator-wizard-parts'
import { Chips } from '@/components/applications/creator-wizard-parts'
import { Logo } from '@/components/shared/logo'

type Form = UseFormReturn<BrandApplicationValues>

type CreateBrandAccountResponse = {
  ok: boolean
  userId: string
  email: string
  redirectTo: string
}

const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }))

// ===========================================================================
// Pages (reused from brand-wizard.tsx)
// ===========================================================================
function Page1({ form }: { form: Form }) {
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
              <Select id="industry" value={field.value} onValueChange={field.onChange} options={opts(['Fashion', 'Beauty', 'Food & Beverage', 'Lifestyle', 'Travel & Hospitality', 'Health & Wellness', 'Technology', 'Other'])} placeholder="Select" />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="location"
          render={({ field, fieldState }) => (
            <Field label="Company location" htmlFor="location" required error={fieldState.error?.message}>
              <Input id="location" placeholder="Enter your city" {...field} />
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

function Page2({ form }: { form: Form }) {
  const { control, watch } = form
  const where = watch('creator_location')
  return (
    <div className="space-y-7">
      <Controller
        control={control}
        name="creator_categories"
        render={({ field, fieldState }) => (
          <Field label="Creator categories" required error={fieldState.error?.message}>
            <Chips name="Creator categories" options={['Fashion', 'Beauty', 'Lifestyle', 'Food', 'Travel', 'Fitness', 'Other']} value={field.value} onChange={field.onChange} />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="collaboration_types"
        render={({ field, fieldState }) => (
          <Field label="Collaboration type" required error={fieldState.error?.message} className="border-t border-line pt-6">
            <Chips name="Collaboration type" options={['UGC', 'Instagram Reel', 'Static / Carousel', 'Stories', 'YouTube', 'Barter', 'Long-term collaboration']} value={field.value} onChange={field.onChange} />
          </Field>
        )}
      />

      <div className="space-y-4 border-t border-line pt-6">
        <Controller
          control={control}
          name="creator_location"
          render={({ field, fieldState }) => (
            <Field label="Creator location" required error={fieldState.error?.message}>
              <RadioRow value={field.value} onChange={field.onChange} options={[{ value: 'pan_india', label: 'Pan India' }, { value: 'specific', label: 'Specific cities' }]} name="creator_location" label="Creator location" />
            </Field>
          )}
        />
        {where === 'specific' && (
          <Controller
            control={control}
            name="specific_cities"
            render={({ field, fieldState }) => (
              <Field label="Which cities?" required error={fieldState.error?.message} hint="Up to 8.">
                <MultiSelect value={field.value} onChange={field.onChange} options={[]} max={8} allowCustom placeholder="Type a city and add it" searchPlaceholder="Type a city" />
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
            <Select id="budget_range" value={field.value} onValueChange={field.onChange} options={[{ value: 'under_25k', label: 'Under ₹25K' }, { value: '25k_50k', label: '₹25K – ₹50K' }, { value: '50k_100k', label: '₹50K – ₹1L' }, { value: '100k_500k', label: '₹1L – ₹5L' }, { value: 'over_500k', label: '₹5L+' }]} placeholder="Select a range" />
          </Field>
        )}
      />
    </div>
  )
}

function Page3({ form }: { form: Form }) {
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
              <Select id="doc_type" value={field.value} onValueChange={field.onChange} options={opts(['GST certificate', 'Certificate of incorporation', 'Udyam registration', 'Other valid business document'])} placeholder="Choose a document type" />
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
            <CheckboxRow id="authorized" label="I confirm that I am authorized to represent this brand/company." checked={field.value} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
    </div>
  )
}

// ===========================================================================
// Main Component
// ===========================================================================
/**
 * Self-serve brand signup: 3-page wizard that creates account instantly without admin approval.
 */
export default function BrandOnboarding() {
  const navigate = useNavigate()
  const [step, setStep] = React.useState(1)
  const [submitted, setSubmitted] = React.useState<{ email: string } | null>(null)

  const form = useForm<BrandApplicationValues>({
    resolver: zodResolver(brandApplicationSchema),
    defaultValues: BRAND_APPLICATION_DEFAULTS,
    mode: 'onChange',
  })
  const { errors, isSubmitting } = form.formState

  const currentPageMeta = BRAND_STEP_META[step - 1]
  const progress = (step / BRAND_TOTAL_STEPS) * 100

  const validateStep = async (stepNumber: number) => {
    const fields = STEP_FIELDS[stepNumber - 1]
    
    // Trigger validation for all fields on this page
    for (const field of fields) {
      await form.trigger(field as any)
    }
    
    // Check if any fields on this page have errors
    const hasErrors = fields.some((field) => {
      const error = form.formState.errors[field as keyof BrandApplicationValues]
      return error !== undefined
    })
    
    if (hasErrors) {
      // Find first error field name
      const firstErrorField = fields.find((field) => {
        const error = form.formState.errors[field as keyof BrandApplicationValues]
        return error !== undefined
      })
      if (firstErrorField) {
        const element = document.getElementById(firstErrorField as string)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.focus({ preventScroll: true })
        }
      }
      return false
    }
    
    return true
  }

  const handleNext = async () => {
    const isValid = await validateStep(step)
    if (isValid && step < BRAND_TOTAL_STEPS) {
      setStep(step + 1)
      // Scroll to top when changing pages
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      // invokeFunction already wraps this object as the request body — do not nest under `body`.
      const result = await invokeFunction<CreateBrandAccountResponse>('create-brand-account', {
        full_name: v.brand_name,
        email: v.business_email,
        phone: v.whatsapp || null,
        city: v.location || null,
        brand_name: v.brand_name,
        website: v.company_website || v.website_or_handle || null,
        industry: v.industry || null,
        location: v.location || null,
        description: null,
        contact_email: v.business_email || null,
        contact_phone: v.whatsapp || null,
        instagram_url: v.instagram_url || null,
        logo_url: v.logo_path || null,
        contact_person: v.contact_person || null,
        designation: v.designation || null,
        creator_categories: v.creator_categories || null,
        collaboration_types: v.collaboration_types || null,
        creator_location: v.creator_location || null,
        specific_cities: v.specific_cities || null,
        budget_range: v.budget_range || null,
        registration_doc_type: v.registration_doc_type || null,
        registration_doc_path: v.registration_doc_path || null,
        representative_id_path: v.representative_id_path || null,
        linkedin_url: v.linkedin_url || null,
        authorized: v.authorized ?? true,
      })

      if (!result?.ok) {
        throw new Error('Failed to create account')
      }

      setSubmitted({ email: v.business_email })
      toast.success('Account created! Check your email for the password setup link.')
    } catch (e) {
      console.error('Account creation error:', e)
      form.setError('root', { message: toAppError(e).message })
    }
  })

  if (submitted) {
    return (
      <div className="w-full max-w-lg">
        <Card className="p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-brand">
            <Mail className="size-7" />
          </span>
          <h1 className="mt-5 font-display text-display-sm font-semibold">Check your email</h1>
          <p className="mt-3 text-muted">
            We've sent a password setup link to <span className="font-medium text-ink">{submitted.email}</span>.
          </p>
          <p className="mt-2 text-sm text-muted">
            You can also sign in with Google using the same email.
          </p>
          <Button className="mt-6" onClick={() => navigate('/login')}>
            Go to login
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-canvas/85 backdrop-blur-md sticky top-0 z-10">
        <div className="container-page flex h-(--header-height) items-center justify-between">
          <Link to="/" className="focus-ring">
            <Logo />
          </Link>
        </div>
      </header>
      <main id="main" className="container-page flex justify-center py-10 sm:py-16">
        <div className="w-full max-w-2xl">
          <p className="eyebrow text-muted">Brand signup · {BRAND_TOTAL_STEPS} steps</p>
          <h1 className="mt-2 font-display text-display-md font-semibold">{currentPageMeta.title}</h1>
          <p className="mt-2 text-muted">{currentPageMeta.blurb}</p>

          <div className="mt-6 space-y-2">
            <Progress value={progress} className="h-2" tone="brand" />
            <div className="flex justify-between text-xs text-muted">
              <span>Step {step} of {BRAND_TOTAL_STEPS}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
          </div>

          <div className="mt-8 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-8">
            {step === 1 && <Page1 form={form} />}
            {step === 2 && <Page2 form={form} />}
            {step === 3 && <Page3 form={form} />}

            {errors.root?.message && (
              <p role="alert" className="mt-6 rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
                {errors.root.message}
              </p>
            )}

            <div className="mt-8 flex justify-between">
              {step > 1 ? (
                <Button type="button" variant="ghost" onClick={handlePrevious}>
                  <ArrowLeft /> Back
                </Button>
              ) : (
                <div />
              )}

              {step < BRAND_TOTAL_STEPS ? (
                <Button type="button" onClick={handleNext}>
                  Next <ArrowRight />
                </Button>
              ) : (
                <Button type="submit" onClick={onSubmit} loading={isSubmitting}>
                  Create account <ArrowRight />
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
