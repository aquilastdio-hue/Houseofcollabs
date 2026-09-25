import * as React from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { AppError } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { GENDERS, INDIAN_STATES, LANGUAGES, POPULAR_CITIES } from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'
import {
  createMyCreator,
  setCreatorLanguages,
  updateMyCreator,
  type CreatorEditable,
  type CreatorProfile,
} from '@/services/creators.service'
import { uploadAvatar } from '@/services/profile.service'
import { uploadPortfolioMedia } from '@/services/portfolio.service'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Combobox, MultiSelect } from '@/components/ui/combobox'
import { ImageUploader } from '@/components/shared/image-uploader'
import type { Creator } from '@/types'
import { basicInfoSchema, type BasicInfoInput, type BasicInfoOutput } from './schemas'
import { FormActions, StudioSection } from './parts'
import { useStudioSync } from './use-studio'

const CITY_OPTIONS = POPULAR_CITIES.map((c) => ({ value: c, label: c }))
const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }))
const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l, label: l }))
const BIO_MIN_TO_PUBLISH = 40
const BIO_MAX = 1500

/** Mirrors the database's initcap() so the chips match what gets stored. */
function languageCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function sameLanguages(a: string[], b: string[]) {
  const norm = (list: string[]) => list.map((l) => l.trim().toLowerCase()).sort().join('|')
  return norm(a) === norm(b)
}

function defaultsFrom(creator: CreatorProfile | null, fallbackName: string, fallbackAvatar: string | null): BasicInfoInput {
  return {
    profile_image_url: creator ? creator.profile_image_url : fallbackAvatar,
    cover_image_url: creator?.cover_image_url ?? null,
    display_name: creator?.display_name ?? fallbackName,
    headline: creator?.headline ?? '',
    bio: creator?.bio ?? '',
    gender: creator?.gender ?? '',
    age: creator?.age != null ? String(creator.age) : '',
    city: creator?.city ?? '',
    state: creator?.state ?? '',
    languages: creator?.creator_languages.map((l) => l.language) ?? [],
  }
}

function BioHint({ control }: { control: Control<BasicInfoInput, unknown, BasicInfoOutput> }) {
  const bio = useWatch({ control, name: 'bio' }) ?? ''
  const needed = BIO_MIN_TO_PUBLISH - bio.trim().length
  return (
    <span className="flex items-start justify-between gap-3">
      <span className={needed > 0 ? 'text-warning' : 'text-success'}>
        {needed > 0 ? `Add ${needed} more character${needed === 1 ? '' : 's'} to publish (40 minimum).` : 'Great — that’s long enough to publish.'}
      </span>
      <span className="shrink-0 tabular-nums">
        {formatNumber(bio.length)}/{formatNumber(BIO_MAX)}
      </span>
    </span>
  )
}

/**
 * Photo, cover, name, headline, bio, demographics, location and languages.
 * Creates the creator record on first save (onboarding), updates it after.
 *
 * `essentials` hides everything a reviewer doesn't need — cover image,
 * headline, state, gender, age — so signup stays short. Those fields keep
 * their existing values and are edited later in Profile.
 */
export function BasicInfoForm({
  submitLabel = 'Save changes',
  secondaryAction,
  onSaved,
  essentials,
  className,
}: {
  submitLabel?: string
  secondaryAction?: React.ReactNode
  onSaved?: (creator: Creator) => void
  essentials?: boolean
  className?: string
}) {
  const { user, profile, creator } = useAuth()
  const sync = useStudioSync()
  const form = useForm<BasicInfoInput, unknown, BasicInfoOutput>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: defaultsFrom(creator, profile?.full_name ?? '', profile?.avatar_url ?? null),
  })
  const { errors, isSubmitting, isDirty } = form.formState

  const requireUserId = () => {
    if (!user) throw new AppError('Your session expired. Please sign in again.', { kind: 'auth', code: 'AUTH_REQUIRED' })
    return user.id
  }

  const save = useMutation({
    mutationFn: async (values: BasicInfoOutput) => {
      const userId = requireUserId()
      const patch: CreatorEditable = {
        display_name: values.display_name,
        headline: values.headline || null,
        bio: values.bio || null,
        profile_image_url: values.profile_image_url,
        cover_image_url: values.cover_image_url,
        gender: values.gender,
        age: values.age,
        city: values.city || null,
        state: values.state || null,
      }
      const row = creator
        ? await updateMyCreator(creator.id, patch)
        : await createMyCreator(userId, { ...patch, display_name: values.display_name })
      try {
        const languages = values.languages.map(languageCase)
        if (!creator || !sameLanguages(languages, creator.creator_languages.map((l) => l.language))) {
          await setCreatorLanguages(languages)
        }
      } finally {
        // Reload even if languages failed so a retry updates instead of re-creating.
        await sync()
      }
      return row
    },
    meta: { successMessage: creator ? 'Profile saved' : 'Profile created' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const row = await save.mutateAsync(values)
      form.reset({ ...form.getValues(), languages: values.languages.map(languageCase) })
      onSaved?.(row)
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className={cn('space-y-10', className)}>
      <StudioSection title="Photos" description="A clear, friendly photo is the first thing brands notice.">
        {/* The first track must be bounded: `auto` resolves to max-content, so the
            profile-photo column claimed the row's full width and squeezed the cover
            column until its hint wrapped one word per line. */}
        <div className={cn('grid grid-cols-1 gap-6 lg:items-start', !essentials && 'lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]')}>
          <Field label="Profile photo" hint="Required to publish. A well-lit headshot works best.">
            <Controller
              control={form.control}
              name="profile_image_url"
              render={({ field }) => (
                <ImageUploader
                  value={field.value}
                  onChange={field.onChange}
                  upload={(file) => uploadAvatar(requireUserId(), file)}
                  bucket="avatars"
                  label="Upload photo"
                />
              )}
            />
          </Field>
          {!essentials && (
            <Field label="Cover image" optional hint="Shown across the top of your storefront. Wide images (3:1) look best.">
              <Controller
                control={form.control}
                name="cover_image_url"
                render={({ field }) => (
                  <ImageUploader
                    value={field.value}
                    onChange={field.onChange}
                    upload={async (file) => (await uploadPortfolioMedia(requireUserId(), file)).media_url}
                    bucket="creator-portfolio"
                    aspect="cover"
                    shape="rounded"
                    label="Upload cover"
                  />
                )}
              />
            </Field>
          )}
        </div>
      </StudioSection>

      <StudioSection title="About you" description="Introduce yourself the way you would to a brand manager.">
        <Field label="Display name" htmlFor="display_name" required error={errors.display_name?.message}>
          <Input id="display_name" autoComplete="nickname" maxLength={80} placeholder="e.g. Priya Sharma" {...form.register('display_name')} />
        </Field>
        {!essentials && (
          <Field
            label="Headline"
            htmlFor="headline"
            optional
            hint="One line about what you create, e.g. “Skincare reels in Hindi & English”."
            error={errors.headline?.message}
          >
            <Input id="headline" maxLength={120} placeholder="What do you make, and for whom?" {...form.register('headline')} />
          </Field>
        )}
        <Field label="Bio" htmlFor="bio" hint={<BioHint control={form.control} />} error={errors.bio?.message}>
          <Textarea
            id="bio"
            rows={6}
            maxLength={BIO_MAX}
            placeholder="Your niche, your audience, the brands you’ve worked with and what makes your content convert."
            {...form.register('bio')}
          />
        </Field>
      </StudioSection>

      <StudioSection
        title="Details"
        description={essentials ? 'Where you are and what you create in.' : 'Brands filter creators by location, language, age and gender.'}
      >
        <div className={cn('grid grid-cols-1 gap-5', !essentials && 'sm:grid-cols-2')}>
          <Field label="City" htmlFor="city" hint="Required to publish." error={errors.city?.message}>
            <Controller
              control={form.control}
              name="city"
              render={({ field }) => (
                <Combobox
                  id="city"
                  value={field.value}
                  onChange={field.onChange}
                  options={CITY_OPTIONS}
                  allowCustom
                  clearable
                  placeholder="Choose or type your city"
                  searchPlaceholder="Search or type a city…"
                  aria-invalid={!!errors.city}
                />
              )}
            />
          </Field>
          {!essentials && (
            <>
              <Field label="State" htmlFor="state" optional error={errors.state?.message}>
                <Controller
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <Select
                      id="state"
                      value={field.value}
                      onValueChange={field.onChange}
                      options={STATE_OPTIONS}
                      placeholder="Choose a state"
                      aria-invalid={!!errors.state}
                    />
                  )}
                />
              </Field>
              <Field label="Gender" htmlFor="gender" optional error={errors.gender?.message}>
                <Controller
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <Select
                      id="gender"
                      value={field.value}
                      onValueChange={field.onChange}
                      options={GENDERS}
                      placeholder="Select"
                      aria-invalid={!!errors.gender}
                    />
                  )}
                />
              </Field>
              <Field label="Age" htmlFor="age" optional error={errors.age?.message}>
                <Input id="age" inputMode="numeric" autoComplete="off" maxLength={3} placeholder="e.g. 24" {...form.register('age')} />
              </Field>
            </>
          )}
        </div>
        <Field
          label="Languages you create in"
          htmlFor="languages"
          required
          hint="Choose up to 10. Type to add one that isn’t listed."
          error={errors.languages?.message}
        >
          <Controller
            control={form.control}
            name="languages"
            render={({ field }) => (
              <MultiSelect
                id="languages"
                value={field.value}
                onChange={field.onChange}
                options={LANGUAGE_OPTIONS}
                max={10}
                allowCustom
                placeholder="Choose languages"
                searchPlaceholder="Search or add a language…"
                aria-invalid={!!errors.languages}
              />
            )}
          />
        </Field>
      </StudioSection>

      <FormActions submitLabel={submitLabel} submitting={isSubmitting} dirty={isDirty} secondary={secondaryAction} />
    </form>
  )
}
