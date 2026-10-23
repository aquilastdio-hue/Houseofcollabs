import * as React from 'react'
import { useNavigate } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowRight, Mail } from 'lucide-react'
import { brandOnboardingSchema, type BrandOnboardingValues } from '@/schemas/auth'
import { toAppError } from '@/lib/errors'
import { INDUSTRIES } from '@/lib/constants'
import { invokeFunction } from '@/lib/supabase/functions'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'

type CreateBrandAccountResponse = {
  ok: boolean
  userId: string
  email: string
  redirectTo: string
}

/**
 * Self-serve brand signup: creates account instantly without admin approval.
 * User fills out brand details, account is created, and invite email is sent.
 */
export default function BrandOnboarding() {
  const navigate = useNavigate()
  const [submitted, setSubmitted] = React.useState<{ email: string } | null>(null)

  const form = useForm<BrandOnboardingValues>({
    resolver: zodResolver(brandOnboardingSchema),
    defaultValues: {
      brand_name: '',
      industry: '',
      website_url: '',
      instagram_url: '',
      location: '',
      description: '',
      contact_email: '',
      contact_phone: '',
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      // Call edge function to create account
      const result = await invokeFunction<CreateBrandAccountResponse>('create-brand-account', {
        body: {
          full_name: v.brand_name,
          email: v.contact_email,
          phone: v.contact_phone || null,
          city: v.location || null,
          brand_name: v.brand_name,
          website: v.website_url || null,
          industry: v.industry || null,
          location: v.location || null,
          description: v.description || null,
          contact_email: v.contact_email || null,
          contact_phone: v.contact_phone || null,
          instagram_url: v.instagram_url || null,
          logo_url: null,
        },
      })

      if (!result.ok) {
        throw new Error('Failed to create account')
      }

      setSubmitted({ email: v.contact_email })
      toast.success('Account created! Check your email for the password setup link.')
    } catch (e) {
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
    <div className="w-full max-w-2xl">
      <p className="eyebrow text-muted">Brand signup · 2 minutes</p>
      <h1 className="mt-2 font-display text-display-md font-semibold">Create your brand account</h1>
      <p className="mt-2 text-muted">Tell us about your brand. We'll create your account instantly.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-8" noValidate>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Brand name" htmlFor="brand_name" required error={errors.brand_name?.message}>
            <Input id="brand_name" placeholder="Your brand name" {...form.register('brand_name')} />
          </Field>
          <Field label="Industry" htmlFor="industry" required error={errors.industry?.message}>
            <Controller
              control={form.control}
              name="industry"
              render={({ field }) => (
                <Select id="industry" value={field.value} onValueChange={field.onChange} options={INDUSTRIES.map((i) => ({ value: i, label: i }))} placeholder="Choose industry" />
              )}
            />
          </Field>
          <Field label="Email (for login)" htmlFor="contact_email" required error={errors.contact_email?.message}>
            <Input id="contact_email" type="email" placeholder="you@yourbrand.com" {...form.register('contact_email')} />
          </Field>
          <Field label="Contact phone" htmlFor="contact_phone" optional error={errors.contact_phone?.message}>
            <Input id="contact_phone" type="tel" placeholder="+91 98xxxxxxx" {...form.register('contact_phone')} />
          </Field>
          <Field label="Website" htmlFor="website_url" optional error={errors.website_url?.message}>
            <Input id="website_url" type="url" placeholder="https://yourbrand.in" {...form.register('website_url')} />
          </Field>
          <Field label="Instagram" htmlFor="instagram_url" optional error={errors.instagram_url?.message}>
            <Input id="instagram_url" type="url" placeholder="https://instagram.com/yourbrand" {...form.register('instagram_url')} />
          </Field>
          <Field label="Location" htmlFor="location" optional error={errors.location?.message}>
            <Input id="location" placeholder="Enter your city" {...form.register('location')} />
          </Field>
          <Field label="About the brand" htmlFor="description" optional className="sm:col-span-2" error={errors.description?.message} hint="What you make, who it's for, and the vibe of your content.">
            <Textarea id="description" rows={4} maxLength={2000} {...form.register('description')} />
          </Field>
        </div>
        {errors.root?.message && (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={isSubmitting}>
            Create account <ArrowRight />
          </Button>
        </div>
      </form>
    </div>
  )
}
