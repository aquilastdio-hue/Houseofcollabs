import * as React from 'react'
import { useNavigate } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { brandOnboardingSchema, type BrandOnboardingValues } from '@/schemas/auth'
import { createMyBrand, updateMyBrand, uploadBrandLogo } from '@/services/brands.service'
import { completeOnboarding } from '@/services/auth.service'
import { toAppError } from '@/lib/errors'
import { INDUSTRIES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { ImageUploader } from '@/components/shared/image-uploader'

/** Single-step brand onboarding: creates the brand record and completes onboarding. */
export default function BrandOnboarding() {
  const { user, brand, profile, refresh } = useAuth()
  const navigate = useNavigate()
  const [logo, setLogo] = React.useState<string | null>(brand?.brand_logo_url ?? null)

  const form = useForm<BrandOnboardingValues>({
    resolver: zodResolver(brandOnboardingSchema),
    defaultValues: {
      brand_name: brand?.brand_name ?? '',
      industry: brand?.industry ?? '',
      website_url: brand?.website_url ?? '',
      instagram_url: brand?.instagram_url ?? '',
      location: brand?.location ?? '',
      description: brand?.description ?? '',
      contact_email: brand?.contact_email ?? profile?.email ?? '',
      contact_phone: brand?.contact_phone ?? '',
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (v) => {
    const payload = {
      brand_name: v.brand_name,
      industry: v.industry || null,
      website_url: v.website_url || null,
      instagram_url: v.instagram_url || null,
      location: v.location || null,
      description: v.description || null,
      contact_email: v.contact_email || null,
      contact_phone: v.contact_phone || null,
      brand_logo_url: logo,
    }
    try {
      if (brand) await updateMyBrand(brand.id, payload)
      else await createMyBrand(user!.id, payload)
      await completeOnboarding()
      await refresh()
      toast.success('Welcome to House of Collabs!')
      navigate('/brand', { replace: true })
    } catch (e) {
      form.setError('root', { message: toAppError(e).message })
    }
  })

  return (
    <div className="w-full max-w-2xl">
      <p className="eyebrow text-muted">Brand setup · 1 minute</p>
      <h1 className="mt-2 font-display text-display-md font-semibold">Tell creators about your brand</h1>
      <p className="mt-2 text-muted">Creators see this on your briefs and orders. You can change it anytime in settings.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-8" noValidate>
        <Field label="Logo" optional>
          <ImageUploader
            value={logo}
            onChange={setLogo}
            bucket="brand-assets"
            shape="rounded"
            label="Upload logo"
            upload={(file) => uploadBrandLogo(user!.id, file)}
          />
        </Field>
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
          <Field label="Website" htmlFor="website_url" optional error={errors.website_url?.message}>
            <Input id="website_url" type="url" placeholder="https://yourbrand.in" {...form.register('website_url')} />
          </Field>
          <Field label="Instagram" htmlFor="instagram_url" optional error={errors.instagram_url?.message}>
            <Input id="instagram_url" type="url" placeholder="https://instagram.com/yourbrand" {...form.register('instagram_url')} />
          </Field>
          <Field label="Location" htmlFor="location" optional error={errors.location?.message}>
            <Input id="location" placeholder="Enter your city" {...form.register('location')} />
          </Field>
          <Field label="Contact phone" htmlFor="contact_phone" optional error={errors.contact_phone?.message}>
            <Input id="contact_phone" type="tel" placeholder="+91 98xxxxxxx" {...form.register('contact_phone')} />
          </Field>
          <Field label="Contact email" htmlFor="contact_email" optional className="sm:col-span-2" error={errors.contact_email?.message}>
            <Input id="contact_email" type="email" placeholder="marketing@yourbrand.in" {...form.register('contact_email')} />
          </Field>
          <Field label="About the brand" htmlFor="description" optional className="sm:col-span-2" error={errors.description?.message} hint="What you make, who it’s for, and the vibe of your content.">
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
            Continue to dashboard <ArrowRight />
          </Button>
        </div>
      </form>
    </div>
  )
}
