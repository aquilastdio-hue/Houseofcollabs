import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AtSign, BadgeCheck, ExternalLink, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { toAppError } from '@/lib/errors'
import { formatCompact, formatNumber } from '@/lib/format'
import { PLATFORMS } from '@/lib/constants'
import { addSocialAccount, deleteSocialAccount, updateSocialAccount, type CreatorOwnProfile } from '@/services/creators.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/states'
import { socialAccountSchema, type SocialAccountInput, type SocialAccountOutput } from './schemas'
import { StudioSection } from './parts'
import { PlatformIcon, platformLabel, profileUrlFor } from './platform'
import { useStudioSync } from './use-studio'

type SocialRow = CreatorOwnProfile['creator_social_accounts'][number]

function SocialAccountForm({ creatorId, account, onDone }: { creatorId: string; account: SocialRow | null; onDone: () => void }) {
  const sync = useStudioSync()
  const form = useForm<SocialAccountInput, unknown, SocialAccountOutput>({
    resolver: zodResolver(socialAccountSchema),
    defaultValues: account
      ? {
          platform: account.platform,
          username: account.username,
          profile_url: account.profile_url ?? '',
          followers_count: String(account.followers_count),
        }
      : { platform: '', username: '', profile_url: '', followers_count: '' },
  })
  const { errors, isSubmitting } = form.formState

  const save = useMutation({
    mutationFn: async (values: SocialAccountOutput) => {
      const row = account ? await updateSocialAccount(account.id, values) : await addSocialAccount(creatorId, values)
      await sync()
      return row
    },
    meta: { silent: true },
  })

  const suggestUrl = () => {
    if (form.getValues('profile_url').trim()) return
    const guess = profileUrlFor(form.getValues('platform'), form.getValues('username'))
    if (guess) form.setValue('profile_url', guess, { shouldDirty: true })
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
      toast.success(account ? 'Account updated' : 'Account added')
      onDone()
    } catch (e) {
      const err = toAppError(e)
      if (err.code === '23505') form.setError('username', { message: 'You’ve already added this account.' })
      else form.setError('root', { message: err.message })
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>{account ? 'Edit social account' : 'Add a social account'}</DialogTitle>
        <DialogDescription>Brands see your handle and follower count. Verified badges are added by our team.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <Field label="Platform" htmlFor="social-platform" required error={errors.platform?.message}>
          <Controller
            control={form.control}
            name="platform"
            render={({ field }) => (
              <Select
                id="social-platform"
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  suggestUrl()
                }}
                options={PLATFORMS}
                placeholder="Choose a platform"
                aria-invalid={!!errors.platform}
              />
            )}
          />
        </Field>
        <Field label="Username" htmlFor="social-username" required error={errors.username?.message}>
          <Input
            id="social-username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={101}
            leftIcon={<AtSign />}
            placeholder="yourhandle"
            {...form.register('username', { onBlur: suggestUrl })}
          />
        </Field>
        <Field label="Profile link" htmlFor="social-url" optional hint="The full link to your profile, starting with https://" error={errors.profile_url?.message}>
          <Input id="social-url" type="url" inputMode="url" autoComplete="url" placeholder="https://" {...form.register('profile_url')} />
        </Field>
        <Field label="Followers" htmlFor="social-followers" required hint="Use the number shown on your profile." error={errors.followers_count?.message}>
          <Input id="social-followers" inputMode="numeric" autoComplete="off" placeholder="e.g. 25000" {...form.register('followers_count')} />
        </Field>
        {errors.root?.message && (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {account ? 'Save account' : 'Add account'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * The creator's social accounts. Total followers on the profile are computed
 * by the database from these rows; verification is admin-controlled.
 */
export function SocialAccountsEditor({ creator, className }: { creator: CreatorOwnProfile; className?: string }) {
  const sync = useStudioSync()
  const [editing, setEditing] = React.useState<{ account: SocialRow | null } | null>(null)
  const [deleting, setDeleting] = React.useState<SocialRow | null>(null)
  const accounts = creator.creator_social_accounts

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteSocialAccount(id)
      await sync()
    },
    meta: { successMessage: 'Account removed' },
  })

  return (
    <StudioSection
      className={className}
      title="Social accounts"
      description="Add the accounts you post on. Your total followers are calculated from these."
      action={
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing({ account: null })}>
          <Plus /> Add account
        </Button>
      }
    >
      <div className="flex items-center justify-between gap-4 rounded-card bg-night px-5 py-4 text-white">
        <div>
          <p className="text-sm text-white/70">Total followers</p>
          <p className="font-display text-2xl font-semibold tabular-nums" aria-live="polite">
            {formatNumber(creator.followers_count)}
          </p>
        </div>
        <span className="flex size-11 items-center justify-center rounded-full bg-white/10 text-brand" aria-hidden>
          <Users className="size-5" />
        </span>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          compact
          icon={<AtSign />}
          title="No social accounts yet"
          description="Brands use your audience size to decide who to hire. Add at least one account."
          action={
            <Button type="button" size="sm" onClick={() => setEditing({ account: null })}>
              <Plus /> Add account
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-4">
              <PlatformIcon platform={a.platform} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                  <span className="truncate">@{a.username}</span>
                  {a.verified && (
                    <Badge tone="success" size="sm">
                      <BadgeCheck /> Verified
                    </Badge>
                  )}
                </p>
                <p className="truncate text-sm text-muted">
                  {platformLabel(a.platform)} · <span className="tabular-nums">{formatCompact(a.followers_count)}</span> followers
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {a.profile_url && (
                  <Button asChild variant="ghost" size="icon-sm">
                    <a href={a.profile_url} target="_blank" rel="noopener noreferrer" aria-label={`Open @${a.username} on ${platformLabel(a.platform)}`}>
                      <ExternalLink />
                    </a>
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit @${a.username}`} onClick={() => setEditing({ account: a })}>
                  <Pencil />
                </Button>
                <Button type="button" variant="danger-ghost" size="icon-sm" aria-label={`Remove @${a.username}`} onClick={() => setDeleting(a)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="md">
          {editing && (
            <SocialAccountForm key={editing.account?.id ?? 'new'} creatorId={creator.id} account={editing.account} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Remove @${deleting.username}?` : 'Remove account?'}
        description="Your total follower count updates automatically."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            setDeleting(null)
          } catch {
            // The mutation cache already surfaced the error.
          }
        }}
      />
    </StudioSection>
  )
}
