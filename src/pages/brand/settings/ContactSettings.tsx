import { Link } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AtSign, Phone, Save, UserRound } from 'lucide-react'
import { site } from '@/config/site'
import { useAuth } from '@/contexts/auth-context'
import { updateMyBrand } from '@/services/brands.service'
import { updateMyProfile } from '@/services/profile.service'
import type { Brand, Profile } from '@/types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SwitchRow } from '@/components/ui/switch'
import { Seo } from '@/components/shared/seo'
import { BrandMissing } from '@/components/brand/brand-missing'
import { SectionCard } from '@/components/brand/section-card'
import { BrandSettingsLayout } from '@/components/brand/settings-nav'
import { EMAIL_PATTERN, PHONE_PATTERN } from '@/components/brand/validators'

// Mirrors the profiles.full_name / brands.contact_* check constraints.
const schema = z.object({
  full_name: z.string().trim().min(2, 'Enter the contact person’s name.').max(120, 'Keep the name under 120 characters.'),
  contact_email: z
    .string()
    .trim()
    .max(254, 'That email address is too long.')
    .refine((v) => v === '' || EMAIL_PATTERN.test(v), 'Enter a valid email address, e.g. partnerships@yourbrand.com'),
  contact_phone: z
    .string()
    .trim()
    .refine((v) => v === '' || PHONE_PATTERN.test(v), 'Use 7–20 digits, spaces, brackets or dashes, e.g. +91 98765 43210'),
  email_notifications: z.boolean(),
})
type Values = z.infer<typeof schema>

export default function ContactSettings() {
  const { brand, user, profile } = useAuth()
  return (
    <>
      <Seo title="Contact details" noindex />
      <BrandSettingsLayout title="Contact details" description={`Who creators and the ${site.name} team should reach about your collaborations.`}>
        {brand && user && profile ? <ContactForm key={brand.id} brand={brand} profile={profile} userId={user.id} /> : <BrandMissing />}
      </BrandSettingsLayout>
    </>
  )
}

function ContactForm({ brand, profile, userId }: { brand: Brand; profile: Profile; userId: string }) {
  const { refresh } = useAuth()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile.full_name ?? '',
      contact_email: brand.contact_email ?? '',
      contact_phone: brand.contact_phone ?? '',
      email_notifications: profile.email_notifications,
    },
    mode: 'onTouched',
  })
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = form

  const save = useMutation({
    mutationFn: async (v: Values) => {
      await Promise.all([
        updateMyProfile(userId, { full_name: v.full_name, email_notifications: v.email_notifications }),
        updateMyBrand(brand.id, { contact_email: v.contact_email || null, contact_phone: v.contact_phone || null }),
      ])
    },
    onSuccess: (_d, v) => {
      reset(v)
      toast.success('Contact details saved')
    },
    onSettled: () => refresh(),
  })

  return (
    <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-3xl space-y-6">
      <SectionCard title="Contact person" description="Creators you hire can see these details on their orders.">
        <Field label="Contact person" htmlFor="full_name" required error={errors.full_name?.message}>
          <Input id="full_name" autoComplete="name" placeholder="e.g. Priya Sharma" leftIcon={<UserRound />} {...register('full_name')} />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Contact email"
            htmlFor="contact_email"
            optional
            hint="Where creators and our team can reach you."
            error={errors.contact_email?.message}
          >
            <Input
              id="contact_email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="partnerships@yourbrand.com"
              leftIcon={<AtSign />}
              {...register('contact_email')}
            />
          </Field>
          <Field label="Contact phone" htmlFor="contact_phone" optional hint="Include your country code." error={errors.contact_phone?.message}>
            <Input
              id="contact_phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              leftIcon={<Phone />}
              {...register('contact_phone')}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Account" description="Your sign-in email and how we notify you.">
        <Field
          label="Account email"
          htmlFor="account_email"
          hint={
            <>
              You sign in with this email. Manage sign-in details in{' '}
              <Link to="/brand/settings/security" className="font-medium text-ink underline underline-offset-4">
                Security
              </Link>
              .
            </>
          }
        >
          <Input id="account_email" value={profile.email ?? ''} readOnly aria-readonly className="bg-subtle text-muted" leftIcon={<AtSign />} />
        </Field>
        <Controller
          control={control}
          name="email_notifications"
          render={({ field }) => (
            <SwitchRow
              id="email_notifications"
              label="Email notifications"
              description="Get order, brief and message updates by email."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
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
