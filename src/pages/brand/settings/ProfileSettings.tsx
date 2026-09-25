import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Globe, Instagram, MapPin, Save } from 'lucide-react'
import { INDUSTRIES } from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'
import { updateMyBrand, uploadBrandLogo, uploadPronunciation } from '@/services/brands.service'
import type { Brand } from '@/types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AudioRecorder } from '@/components/shared/audio-recorder'
import { ImageUploader } from '@/components/shared/image-uploader'
import { Seo } from '@/components/shared/seo'
import { BrandMissing } from '@/components/brand/brand-missing'
import { CharCount } from '@/components/brand/char-count'
import { SectionCard } from '@/components/brand/section-card'
import { BrandSettingsLayout } from '@/components/brand/settings-nav'
import { isHttpsUrl, isInstagramUrl } from '@/components/brand/validators'

// Limits mirror the `brands` table check constraints.
const schema = z.object({
  brand_name: z
    .string()
    .trim()
    .min(2, 'Your brand name needs at least 2 characters.')
    .max(80, 'Keep your brand name under 80 characters.'),
  brand_pronunciation: z.string().trim().max(120, 'Keep the pronunciation under 120 characters.'),
  website_url: z
    .string()
    .trim()
    .refine((v) => v === '' || isHttpsUrl(v), 'Enter your full website address, starting with https://'),
  instagram_url: z
    .string()
    .trim()
    .refine((v) => v === '' || isInstagramUrl(v), 'Enter your Instagram profile link, e.g. https://instagram.com/yourbrand'),
  description: z.string().trim().max(2000, 'Keep the description under 2,000 characters.'),
  industry: z.string().max(80),
  location: z.string().trim().max(120, 'Keep the location under 120 characters.'),
})
type Values = z.infer<typeof schema>

function toValues(b: Brand): Values {
  return {
    brand_name: b.brand_name,
    brand_pronunciation: b.brand_pronunciation ?? '',
    website_url: b.website_url ?? '',
    instagram_url: b.instagram_url ?? '',
    description: b.description ?? '',
    industry: b.industry ?? '',
    location: b.location ?? '',
  }
}

export default function ProfileSettings() {
  const { brand, user } = useAuth()
  return (
    <>
      <Seo title="Brand profile" noindex />
      <BrandSettingsLayout title="Brand profile" description="How your brand appears to creators on briefs, orders and messages.">
        {brand && user ? <ProfileForm key={brand.id} brand={brand} userId={user.id} /> : <BrandMissing />}
      </BrandSettingsLayout>
    </>
  )
}

function ProfileForm({ brand, userId }: { brand: Brand; userId: string }) {
  const { refresh } = useAuth()
  const [logo, setLogo] = React.useState(brand.brand_logo_url)
  const [audio, setAudio] = React.useState(brand.pronunciation_audio_url)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(brand), mode: 'onTouched' })
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = form

  const industryOptions = React.useMemo(() => {
    const options = INDUSTRIES.map((i) => ({ value: i as string, label: i as string }))
    if (brand.industry && !options.some((o) => o.value === brand.industry)) options.push({ value: brand.industry, label: brand.industry })
    return options
  }, [brand.industry])

  const save = useMutation({
    mutationFn: (v: Values) =>
      updateMyBrand(brand.id, {
        brand_name: v.brand_name,
        brand_pronunciation: v.brand_pronunciation || null,
        website_url: v.website_url || null,
        instagram_url: v.instagram_url || null,
        description: v.description || null,
        industry: v.industry || null,
        location: v.location || null,
      }),
    onSuccess: async (_brand, v) => {
      reset(v)
      toast.success('Brand profile saved')
      await refresh()
    },
  })

  // Logo + voice clip are saved as soon as they're uploaded.
  const saveAsset = useMutation({
    mutationFn: (patch: { brand_logo_url?: string | null; pronunciation_audio_url?: string | null }) => updateMyBrand(brand.id, patch),
    onSuccess: () => refresh(),
  })

  const onLogoChange = (url: string | null) => {
    const previous = logo
    setLogo(url)
    saveAsset.mutate(
      { brand_logo_url: url },
      { onSuccess: () => toast.success(url ? 'Logo updated' : 'Logo removed'), onError: () => setLogo(previous) },
    )
  }

  const onAudioChange = (url: string | null) => {
    const previous = audio
    setAudio(url)
    saveAsset.mutate(
      { pronunciation_audio_url: url },
      { onSuccess: () => !url && toast.success('Pronunciation recording removed'), onError: () => setAudio(previous) },
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-3xl space-y-6">
      <SectionCard title="Brand identity" description="Your logo and name appear on every brief, order and message.">
        <div>
          <p className="mb-2 text-sm font-medium">Logo</p>
          <ImageUploader
            bucket="brand-assets"
            shape="rounded"
            value={logo}
            onChange={onLogoChange}
            upload={(file) => uploadBrandLogo(userId, file)}
            label="Upload logo"
          />
          <p className="mt-2 text-xs text-muted">Saved automatically. A square image at least 400 × 400 px looks sharpest.</p>
        </div>
        <Field
          label="Brand name"
          htmlFor="brand_name"
          required
          error={errors.brand_name?.message}
          labelAction={<CharCount control={control} name="brand_name" max={80} />}
        >
          <Input id="brand_name" autoComplete="organization" {...register('brand_name')} />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Controller
            control={control}
            name="industry"
            render={({ field }) => (
              <Field label="Industry" htmlFor="industry" optional error={errors.industry?.message}>
                <Select id="industry" value={field.value} onValueChange={field.onChange} options={industryOptions} placeholder="Choose your industry" />
              </Field>
            )}
          />
          <Field label="Location" htmlFor="location" optional error={errors.location?.message}>
            <Input id="location" placeholder="e.g. Bengaluru, Karnataka" autoComplete="address-level2" leftIcon={<MapPin />} {...register('location')} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Pronunciation" description="Help creators say your brand name correctly in their videos.">
        <Field
          label="How it’s pronounced"
          htmlFor="brand_pronunciation"
          optional
          hint="Spell it out phonetically, e.g. SAH-fron street."
          error={errors.brand_pronunciation?.message}
          labelAction={<CharCount control={control} name="brand_pronunciation" max={120} />}
        >
          <Input id="brand_pronunciation" placeholder="e.g. SAH-fron street" autoComplete="off" {...register('brand_pronunciation')} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium">Voice pronunciation</p>
          <AudioRecorder value={audio} onChange={onAudioChange} upload={(blob, name) => uploadPronunciation(userId, blob, name)} />
          <p className="mt-2 text-xs text-muted">Saved automatically. Up to 15 seconds.</p>
        </div>
      </SectionCard>

      <SectionCard title="About your brand" description="Context creators read before they accept a brief.">
        <Field
          label="Description"
          htmlFor="description"
          optional
          error={errors.description?.message}
          labelAction={<CharCount control={control} name="description" max={2000} />}
        >
          <Textarea
            id="description"
            rows={5}
            placeholder="What you make, who it’s for and what you care about."
            {...register('description')}
          />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Website" htmlFor="website_url" optional error={errors.website_url?.message}>
            <Input
              id="website_url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://yourbrand.com"
              leftIcon={<Globe />}
              {...register('website_url')}
            />
          </Field>
          <Field label="Instagram" htmlFor="instagram_url" optional error={errors.instagram_url?.message}>
            <Input
              id="instagram_url"
              type="url"
              inputMode="url"
              placeholder="https://instagram.com/yourbrand"
              leftIcon={<Instagram />}
              {...register('instagram_url')}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" disabled={!isDirty || save.isPending} onClick={() => reset()}>
          Discard changes
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          {!save.isPending && <Save />} Save changes
        </Button>
      </div>
    </form>
  )
}
