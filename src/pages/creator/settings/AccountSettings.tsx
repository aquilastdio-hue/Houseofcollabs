import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Mail, Phone } from 'lucide-react'
import { RESPONSE_TIMES } from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'
import { updateMyProfile } from '@/services/profile.service'
import { updateMyCreator, type CreatorProfile } from '@/services/creators.service'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SwitchRow } from '@/components/ui/switch'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { CreatorSettingsNav } from '@/components/creator-studio/settings-nav'
import { CreatorSetupRequired, FormActions, StudioSection } from '@/components/creator-studio/parts'
import { StorefrontUrlForm } from '@/components/creator-studio/storefront-url-form'
import { useStudioSync } from '@/components/creator-studio/use-studio'
import { accountSchema, availabilitySchema, type AccountInput, type AvailabilityInput } from '@/components/creator-studio/schemas'
import type { Profile } from '@/types'

function AccountForm({ profile, email }: { profile: Profile; email: string }) {
  const { refresh } = useAuth()
  const form = useForm<AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      full_name: profile.full_name ?? '',
      phone: profile.phone ?? '',
      email_notifications: profile.email_notifications,
    },
  })
  const { errors, isSubmitting, isDirty } = form.formState

  const save = useMutation({
    mutationFn: async (values: AccountInput) => {
      const row = await updateMyProfile(profile.id, {
        full_name: values.full_name,
        phone: values.phone || null,
        email_notifications: values.email_notifications,
      })
      await refresh()
      return row
    },
    meta: { successMessage: 'Account settings saved' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
      form.reset(values)
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <StudioSection title="Account" description="Private details for your account — brands don’t see these.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="account-name" required error={errors.full_name?.message}>
            <Input id="account-name" autoComplete="name" maxLength={120} {...form.register('full_name')} />
          </Field>
          <Field label="Phone" htmlFor="account-phone" optional hint="Used by our team for payout or order issues." error={errors.phone?.message}>
            <Input id="account-phone" type="tel" autoComplete="tel" leftIcon={<Phone />} placeholder="+91 98765 43210" {...form.register('phone')} />
          </Field>
        </div>
        <Field label="Email" htmlFor="account-email" hint="The email you log in with.">
          <Input id="account-email" type="email" value={email} readOnly aria-readonly className="bg-subtle" leftIcon={<Mail />} />
        </Field>
      </StudioSection>
      <StudioSection title="Notifications" description="In-app notifications are always on.">
        <div className="rounded-card border border-line bg-subtle/50 p-4">
          <Controller
            control={form.control}
            name="email_notifications"
            render={({ field }) => (
              <SwitchRow
                id="account-email-notifications"
                label="Email notifications"
                description="New orders, messages, briefs and payout updates."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </StudioSection>
      <FormActions submitLabel="Save account" submitting={isSubmitting} dirty={isDirty} />
    </form>
  )
}

function AvailabilityForm({ creator }: { creator: CreatorProfile }) {
  const sync = useStudioSync()
  const form = useForm<AvailabilityInput>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: { available: creator.available, response_time: creator.response_time ?? '' },
  })
  const { isSubmitting, isDirty } = form.formState

  const save = useMutation({
    mutationFn: async (values: AvailabilityInput) => {
      const row = await updateMyCreator(creator.id, { available: values.available, response_time: values.response_time || null })
      await sync()
      return row
    },
    meta: { successMessage: 'Availability updated' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
      form.reset(values)
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <StudioSection title="Availability" description="Let brands know whether you’re taking on new work and how fast you reply.">
        <div className="rounded-card border border-line bg-subtle/50 p-4">
          <Controller
            control={form.control}
            name="available"
            render={({ field }) => (
              <SwitchRow
                id="settings-available"
                label="Available for new orders"
                description="Turn this off when you’re fully booked. Your storefront stays visible."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
        <Field label="Typical response time" htmlFor="settings-response-time" optional>
          <Controller
            control={form.control}
            name="response_time"
            render={({ field }) => (
              <Select
                id="settings-response-time"
                value={field.value}
                onValueChange={field.onChange}
                options={RESPONSE_TIMES}
                placeholder="Select"
                className="sm:max-w-xs"
              />
            )}
          />
        </Field>
      </StudioSection>
      <FormActions submitLabel="Save availability" submitting={isSubmitting} dirty={isDirty} />
    </form>
  )
}

export default function AccountSettings() {
  const { user, profile, creator } = useAuth()
  return (
    <>
      <Seo title="Settings" noindex />
      <PageHeader title="Settings" description="Your account details, notifications, availability and storefront link." />
      <CreatorSettingsNav />
      <div className="max-w-3xl space-y-6">
        <Card className="p-5 sm:p-8">
          {profile ? (
            <AccountForm profile={profile} email={profile.email ?? user?.email ?? ''} />
          ) : (
            <div className="space-y-4" aria-busy="true">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          )}
        </Card>
        {creator ? (
          <>
            <Card className="p-5 sm:p-8">
              <AvailabilityForm creator={creator} />
            </Card>
            <Card className="p-5 sm:p-8">
              <StorefrontUrlForm creator={creator} />
            </Card>
          </>
        ) : (
          <CreatorSetupRequired />
        )}
      </div>
    </>
  )
}
