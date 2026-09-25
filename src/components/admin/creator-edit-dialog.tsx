import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import { INDIAN_STATES, RESPONSE_TIMES } from '@/lib/constants'
import { listAllCreatorTypes, updateCreator, type AdminCreatorDetail } from '@/services/admin.service'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { SwitchRow } from '@/components/ui/switch'
import { adminKeys, adminLists } from './admin-keys'
import { FormDialog } from './form-dialog'
import { useAdminMutation } from './use-admin-mutation'

const RESPONSE_VALUES = RESPONSE_TIMES.map((r) => r.value)

const schema = z.object({
  display_name: z.string().trim().min(2, 'Use at least 2 characters').max(80, 'Keep it under 80 characters'),
  headline: z.string().trim().max(120, 'Keep it under 120 characters'),
  bio: z.string().trim().max(1500, 'Keep it under 1,500 characters'),
  city: z.string().trim().max(80, 'Keep it under 80 characters'),
  state: z.string().trim().max(80, 'Keep it under 80 characters'),
  creator_type: z.string(),
  available: z.boolean(),
  response_time: z.string().refine((v) => v === '' || RESPONSE_VALUES.includes(v), 'Choose a response time'),
})

type Values = z.infer<typeof schema>
type Patch = Parameters<typeof updateCreator>[1]

function initialValues(c: AdminCreatorDetail): Values {
  return {
    display_name: c.display_name,
    headline: c.headline ?? '',
    bio: c.bio ?? '',
    city: c.city ?? '',
    state: c.state ?? '',
    creator_type: c.creator_type ?? '',
    available: c.available,
    response_time: c.response_time ?? '',
  }
}

/** Admin edit of the storefront basics (only the fields `admin_update_creator` accepts). */
export function CreatorEditDialog({ creator, open, onOpenChange }: { creator: AdminCreatorDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const initial = React.useMemo(() => initialValues(creator), [creator])
  const form = useForm<Values>({ resolver: zodResolver(schema), values: initial })
  const e = form.formState.errors
  const types = useQuery({ queryKey: adminKeys.creatorTypes, queryFn: listAllCreatorTypes, enabled: open, staleTime: 5 * 60_000 })

  const save = useAdminMutation((patch: Patch) => updateCreator(creator.id, patch), {
    invalidate: [qk.admin.creator(creator.id), adminLists.creators, qk.creators.all],
    success: 'Creator profile updated',
    onSuccess: () => onOpenChange(false),
  })

  const onSubmit = form.handleSubmit((v) => {
    const patch: Patch = {}
    if (v.display_name !== initial.display_name) patch.display_name = v.display_name
    if (v.headline !== initial.headline) patch.headline = v.headline
    if (v.bio !== initial.bio) patch.bio = v.bio
    if (v.city !== initial.city) patch.city = v.city
    if (v.state !== initial.state) patch.state = v.state
    if (v.creator_type !== initial.creator_type) patch.creator_type = v.creator_type
    if (v.available !== initial.available) patch.available = v.available
    if (v.response_time !== initial.response_time) patch.response_time = v.response_time
    if (Object.keys(patch).length === 0) {
      toast('Nothing changed')
      onOpenChange(false)
      return
    }
    save.mutate(patch)
  })

  const stateOptions = React.useMemo(() => {
    const list = INDIAN_STATES.map((s) => ({ value: s, label: s }))
    const known = (INDIAN_STATES as readonly string[]).includes(initial.state)
    return initial.state && !known ? [{ value: initial.state, label: initial.state }, ...list] : list
  }, [initial.state])

  const typeOptions = (types.data ?? []).map((t) => ({ value: t.slug, label: t.active ? t.name : `${t.name} (inactive)` }))
  if (initial.creator_type && !typeOptions.some((o) => o.value === initial.creator_type)) {
    typeOptions.unshift({ value: initial.creator_type, label: initial.creator_type })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset(initial)
        onOpenChange(o)
      }}
      title="Edit creator profile"
      description="Changes go live on the storefront immediately and are recorded in the audit log."
      submitLabel="Save changes"
      loading={save.isPending}
      submitDisabled={!form.formState.isDirty}
      onSubmit={onSubmit}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Display name" htmlFor="ce-name" required error={e.display_name?.message} className="sm:col-span-2">
          <Input id="ce-name" maxLength={80} {...form.register('display_name')} />
        </Field>
        <Field label="Headline" htmlFor="ce-headline" error={e.headline?.message} hint="Shown under the name on cards." className="sm:col-span-2">
          <Input id="ce-headline" maxLength={120} {...form.register('headline')} />
        </Field>
        <Field label="Bio" htmlFor="ce-bio" error={e.bio?.message} className="sm:col-span-2" hint={`${form.watch('bio').length}/1500`}>
          <Textarea id="ce-bio" rows={5} maxLength={1500} {...form.register('bio')} />
        </Field>
        <Field label="City" htmlFor="ce-city" error={e.city?.message}>
          <Input id="ce-city" maxLength={80} {...form.register('city')} />
        </Field>
        <Field label="State" htmlFor="ce-state" error={e.state?.message}>
          <Select
            id="ce-state"
            value={form.watch('state')}
            onValueChange={(v) => form.setValue('state', v, { shouldDirty: true, shouldValidate: true })}
            options={stateOptions}
            anyLabel="Not set"
          />
        </Field>
        <Field label="Creator type" htmlFor="ce-type" error={e.creator_type?.message} hint={types.isError ? 'Couldn’t load creator types.' : undefined}>
          <Select
            id="ce-type"
            value={form.watch('creator_type')}
            onValueChange={(v) => form.setValue('creator_type', v, { shouldDirty: true })}
            options={typeOptions}
            anyLabel="No type"
            disabled={types.isPending}
            placeholder={types.isPending ? 'Loading…' : 'Choose a type'}
          />
        </Field>
        <Field label="Response time" htmlFor="ce-response" error={e.response_time?.message}>
          <Select
            id="ce-response"
            value={form.watch('response_time')}
            onValueChange={(v) => form.setValue('response_time', v, { shouldDirty: true, shouldValidate: true })}
            options={RESPONSE_TIMES}
            anyLabel="Not set"
          />
        </Field>
        <div className="rounded-control border border-line p-3.5 sm:col-span-2">
          <SwitchRow
            id="ce-available"
            label="Accepting new orders"
            description="When off, brands can view the storefront but can’t check out."
            checked={form.watch('available')}
            onCheckedChange={(v) => form.setValue('available', v, { shouldDirty: true })}
          />
        </div>
      </div>
    </FormDialog>
  )
}
