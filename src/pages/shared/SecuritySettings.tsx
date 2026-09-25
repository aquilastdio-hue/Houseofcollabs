import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { KeyRound, Lock, LogOut, MailCheck, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { passwordSchema } from '@/schemas/auth'
import { useAuth } from '@/contexts/auth-context'
import { changePassword, signOutEverywhere } from '@/services/auth.service'
import { updateMyProfile, type ProfilePatch } from '@/services/profile.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader, SectionTitle } from '@/components/shared/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { SwitchRow } from '@/components/ui/switch'
import { PasswordInput, PasswordMeter } from '@/components/auth/auth-parts'
import { BrandSettingsNav } from '@/components/brand/settings-nav'
import { CreatorSettingsNav } from '@/components/creator-studio/settings-nav'

const schema = z
  .object({
    current: z.string().min(1, 'Enter your current password'),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' })
  .refine((v) => v.password !== v.current, { path: ['password'], message: 'Choose a password you haven’t used here before' })

type Values = z.infer<typeof schema>

function ChangePasswordForm() {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { current: '', password: '', confirm: '' } })
  const password = form.watch('password')

  const change = useMutation({
    mutationFn: (values: Values) => changePassword(values.current, values.password),
    meta: { successMessage: 'Password updated' },
    onSuccess: () => form.reset({ current: '', password: '', confirm: '' }),
  })

  const { errors } = form.formState

  return (
    <form onSubmit={form.handleSubmit((values) => change.mutate(values))} className="space-y-5" noValidate>
      <Field label="Current password" htmlFor="current-password" error={errors.current?.message}>
        <PasswordInput id="current-password" autoComplete="current-password" aria-invalid={!!errors.current} {...form.register('current')} />
      </Field>

      <Separator />

      <Field label="New password" htmlFor="new-password" error={errors.password?.message} hint="At least 8 characters, with a letter and a number.">
        <PasswordInput id="new-password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register('password')} />
      </Field>
      <PasswordMeter value={password} />

      <Field label="Confirm new password" htmlFor="confirm-password" error={errors.confirm?.message}>
        <PasswordInput id="confirm-password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register('confirm')} />
      </Field>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="submit" loading={change.isPending}>
          <KeyRound /> Update password
        </Button>
        <p className="text-xs text-muted">You’ll stay signed in on this device.</p>
      </div>
    </form>
  )
}

function SignOutEverywhere() {
  const [open, setOpen] = React.useState(false)
  const signOutAll = useMutation({
    mutationFn: signOutEverywhere,
    meta: { successMessage: 'Signed out on every device' },
    onSuccess: () => setOpen(false),
  })

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Sign out everywhere</p>
          <p className="text-sm text-muted">Ends every active session, including this one and any phone or tablet you’ve used.</p>
        </div>
        <Button variant="danger-ghost" onClick={() => setOpen(true)}>
          <LogOut /> Sign out everywhere
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sign out of every device?"
        description="You’ll be signed out here too and will need to sign in again. Do this if you think someone else has access to your account."
        confirmLabel="Sign out everywhere"
        destructive
        reasonRequired={false}
        loading={signOutAll.isPending}
        onConfirm={() => signOutAll.mutate()}
      />
    </>
  )
}

/**
 * Per-category email opt-outs. These map 1:1 onto the columns read by
 * `private.wants_email()`, so a switch here is what the database actually
 * checks before queueing an email.
 */
const EMAIL_CATEGORIES = [
  {
    key: 'email_orders',
    label: 'Order updates',
    description: 'New orders, deliveries, revisions, approvals and shipping.',
  },
  {
    key: 'email_payments',
    label: 'Earnings and payments',
    description: 'Payments received, earnings becoming available, and withdrawals.',
  },
  {
    key: 'email_campaigns',
    label: 'Campaign updates',
    description: 'Briefs and collaboration invites sent to you.',
  },
  {
    key: 'email_account',
    label: 'Account updates',
    description: 'Profile reviews, verification and other changes to your account.',
  },
  {
    key: 'email_marketing',
    label: 'Marketing and product news',
    description: 'Occasional announcements about new features. Off by default.',
  },
] as const satisfies readonly { key: keyof ProfilePatch; label: string; description: string }[]

function EmailPreferences() {
  const { profile, refresh } = useAuth()

  const save = useMutation({
    mutationFn: (patch: ProfilePatch) => updateMyProfile(profile!.id, patch),
    meta: { successMessage: 'Email preferences saved' },
    onSuccess: () => refresh(),
  })

  const master = profile?.email_notifications ?? true
  const busy = save.isPending || !profile

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SwitchRow
          id="email-notifications"
          label="Send me email notifications"
          description="Turn this off to stop every optional email at once. Security and billing emails still come through."
          checked={master}
          disabled={busy}
          onCheckedChange={(next) => save.mutate({ email_notifications: next })}
        />
      </Card>

      <Card className={cn('divide-y divide-line p-0 transition-opacity', !master && 'opacity-60')}>
        {EMAIL_CATEGORIES.map((c) => (
          <div key={c.key} className="p-5">
            <SwitchRow
              id={c.key.replace('_', '-')}
              label={c.label}
              description={c.description}
              checked={(profile?.[c.key] as boolean | undefined) ?? c.key !== 'email_marketing'}
              disabled={busy || !master}
              onCheckedChange={(next) => save.mutate({ [c.key]: next })}
            />
          </div>
        ))}
      </Card>

      <div className="flex items-start gap-3 rounded-card border border-line bg-subtle p-4">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">Some emails can’t be turned off.</span> Failed payments and withdrawals, refunds, disputes, cancellations and
          anything that changes your account’s status are sent whatever you choose here — you need them to keep control of your money and your account.
        </p>
      </div>
    </div>
  )
}

export default function SecuritySettings({ perspective }: { perspective: 'brand' | 'creator' }) {
  const { user, profile } = useAuth()

  const verified = !!user?.email_confirmed_at
  const provider = user?.app_metadata?.provider
  const usesGoogle = provider === 'google'

  const content = (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-4">
        <SectionTitle title="Account" description="How you sign in to House of Collabs." />
        <Card className="divide-y divide-line p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Email</p>
              <p className="truncate text-sm text-muted">{user?.email ?? profile?.email ?? '—'}</p>
            </div>
            <Badge tone={verified ? 'success' : 'warning'} size="sm">
              <MailCheck /> {verified ? 'Verified' : 'Not verified'}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Sign-in method</p>
              <p className="text-sm text-muted">{usesGoogle ? 'Google account' : 'Email and password'}</p>
            </div>
            {profile?.created_at && <p className="text-xs text-muted">Member since {formatDate(profile.created_at)}</p>}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="Password"
          description={usesGoogle ? 'You signed up with Google, so Google handles your password.' : 'Choose something long and unique to House of Collabs.'}
        />
        <Card className="p-5 sm:p-6">
          {usesGoogle ? (
            <p className="text-sm text-muted">
              Manage your password in your Google account. If you’d like a password here as well, sign out and use “Forgot password” on the sign-in page to set one.
            </p>
          ) : (
            <ChangePasswordForm />
          )}
        </Card>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Email preferences" description="In-app notifications are always on. This is only about what lands in your inbox." />
        <EmailPreferences />
      </section>

      <section className="space-y-4">
        <SectionTitle title="Sessions" description="Signed in somewhere you don’t recognise?" />
        <Card className="p-5">
          <SignOutEverywhere />
        </Card>
      </section>
    </div>
  )

  return (
    <>
      <Seo title="Security" noindex />
      {perspective === 'brand' ? (
        <>
          <PageHeader eyebrow="Settings" title="Security" description="Your password, email preferences and active sessions." />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
            <BrandSettingsNav className="lg:sticky lg:top-[calc(var(--header-height)_+_2rem)] lg:self-start" />
            <div className="min-w-0">{content}</div>
          </div>
        </>
      ) : (
        <>
          <PageHeader
            eyebrow="Settings"
            title="Security"
            description="Your password, email preferences and active sessions."
            actions={
              <Badge tone="brand-soft" size="sm">
                <ShieldCheck /> Account protected
              </Badge>
            }
          />
          <CreatorSettingsNav />
          {content}
        </>
      )}
    </>
  )
}
