import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import { slugify } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatCompact } from '@/lib/format'
import { deleteCreatorType, listAllCreatorTypes, upsertCreatorType } from '@/services/admin.service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch, SwitchRow } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import type { CreatorTypeRow } from '@/types'
import { adminKeys } from './admin-keys'
import { DetailCard } from './detail'
import { FormDialog } from './form-dialog'
import { useAdminMutation } from './use-admin-mutation'

const optionalCount = z
  .string()
  .trim()
  .refine((v) => v === '' || (/^\d{1,10}$/.test(v) && Number(v) <= 2_000_000_000), 'Enter a whole number, or leave empty')

const schema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, 'Use at least 2 characters')
      .max(40, 'Keep it under 40 characters')
      .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, 'Lowercase letters and numbers, separated by single underscores'),
    name: z.string().trim().min(2, 'Use at least 2 characters').max(60, 'Keep it under 60 characters'),
    description: z.string().trim().max(300, 'Keep it under 300 characters'),
    min_followers: optionalCount,
    max_followers: optionalCount,
    sort_order: z.string().trim().regex(/^-?\d{1,4}$/, 'Enter a whole number between -9999 and 9999'),
    active: z.boolean(),
  })
  .refine((v) => v.min_followers === '' || v.max_followers === '' || Number(v.min_followers) <= Number(v.max_followers), {
    path: ['max_followers'],
    message: 'Must be at least the minimum',
  })
type Values = z.infer<typeof schema>

const toSlug = (name: string) => slugify(name).replace(/-/g, '_').slice(0, 40)

function toValues(t: CreatorTypeRow | null, nextSort: number): Values {
  return {
    slug: t?.slug ?? '',
    name: t?.name ?? '',
    description: t?.description ?? '',
    min_followers: t?.min_followers != null ? String(t.min_followers) : '',
    max_followers: t?.max_followers != null ? String(t.max_followers) : '',
    sort_order: String(t?.sort_order ?? nextSort),
    active: t?.active ?? true,
  }
}

function followerRange(t: CreatorTypeRow) {
  if (t.min_followers == null && t.max_followers == null) return 'Any audience'
  if (t.max_followers == null) return `${formatCompact(t.min_followers)}+`
  if (t.min_followers == null) return `Up to ${formatCompact(t.max_followers)}`
  return `${formatCompact(t.min_followers)} – ${formatCompact(t.max_followers)}`
}

function CreatorTypeDialog({ type, nextSort, open, onOpenChange }: { type: CreatorTypeRow | null; nextSort: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const editing = !!type
  const initial = React.useMemo(() => toValues(type, nextSort), [type, nextSort])
  const form = useForm<Values>({ resolver: zodResolver(schema), values: initial })
  const [slugTouched, setSlugTouched] = React.useState(editing)
  const e = form.formState.errors

  React.useEffect(() => {
    if (open) setSlugTouched(editing)
  }, [open, editing])

  const close = () => {
    form.reset(initial)
    onOpenChange(false)
  }

  const save = useAdminMutation(
    (v: Values) =>
      upsertCreatorType({
        slug: v.slug,
        name: v.name,
        description: v.description || null,
        min_followers: v.min_followers === '' ? null : Number(v.min_followers),
        max_followers: v.max_followers === '' ? null : Number(v.max_followers),
        sort_order: Number(v.sort_order),
        active: v.active,
      }),
    {
      invalidate: [adminKeys.creatorTypes, qk.creatorTypes],
      success: (_d, v) => (editing ? `“${v.name}” updated` : `“${v.name}” created`),
      onSuccess: close,
    },
  )

  const nameField = form.register('name', {
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
      if (!slugTouched && !editing) form.setValue('slug', toSlug(ev.target.value), { shouldValidate: form.formState.isSubmitted })
    },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={editing ? `Edit ${type.name}` : 'New creator type'}
      description="Creator types describe audience size or specialism and power the marketplace filters."
      submitLabel={editing ? 'Save type' : 'Create type'}
      loading={save.isPending}
      submitDisabled={editing && !form.formState.isDirty}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="ct-name" required error={e.name?.message}>
          <Input id="ct-name" maxLength={60} autoComplete="off" {...nameField} />
        </Field>
        <Field label="Slug" htmlFor="ct-slug" required error={e.slug?.message} hint={editing ? 'The slug identifies the type and can’t be changed.' : 'e.g. micro_creator'}>
          <Input id="ct-slug" maxLength={40} autoComplete="off" className="font-mono" disabled={editing} {...form.register('slug', { onChange: () => setSlugTouched(true) })} />
        </Field>
        <Field label="Description" htmlFor="ct-description" optional error={e.description?.message} className="sm:col-span-2">
          <Textarea id="ct-description" rows={2} maxLength={300} {...form.register('description')} />
        </Field>
        <Field label="Min followers" htmlFor="ct-min" optional error={e.min_followers?.message}>
          <Input id="ct-min" type="number" inputMode="numeric" min={0} step={1} {...form.register('min_followers')} />
        </Field>
        <Field label="Max followers" htmlFor="ct-max" optional error={e.max_followers?.message} hint="Leave empty for no upper limit.">
          <Input id="ct-max" type="number" inputMode="numeric" min={0} step={1} {...form.register('max_followers')} />
        </Field>
        <Field label="Sort order" htmlFor="ct-sort" required error={e.sort_order?.message}>
          <Input id="ct-sort" type="number" inputMode="numeric" step={1} {...form.register('sort_order')} />
        </Field>
        <div className="flex items-end">
          <div className="w-full rounded-control border border-line p-3">
            <SwitchRow
              id="ct-active"
              label="Active"
              description="Inactive types can’t be picked by creators."
              checked={form.watch('active')}
              onCheckedChange={(v) => form.setValue('active', v, { shouldDirty: true })}
            />
          </div>
        </div>
      </div>
    </FormDialog>
  )
}

/** Creator types (slug, name, follower range, order, active) via upsert/delete. */
export function CreatorTypeManager() {
  const query = useQuery({ queryKey: adminKeys.creatorTypes, queryFn: listAllCreatorTypes })
  const [editing, setEditing] = React.useState<CreatorTypeRow | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [deleting, setDeleting] = React.useState<CreatorTypeRow | null>(null)
  const types = query.data ?? []
  const nextSort = types.reduce((max, t) => Math.max(max, t.sort_order), 0) + 1

  const toggle = useAdminMutation((t: CreatorTypeRow & { next: boolean }) => upsertCreatorType({ slug: t.slug, name: t.name, description: t.description, min_followers: t.min_followers, max_followers: t.max_followers, sort_order: t.sort_order, active: t.next }), {
    invalidate: [adminKeys.creatorTypes, qk.creatorTypes],
    success: (_d, t) => `“${t.name}” ${t.next ? 'activated' : 'deactivated'}`,
  })
  const remove = useAdminMutation((t: CreatorTypeRow) => deleteCreatorType(t.slug), {
    invalidate: [adminKeys.creatorTypes, qk.creatorTypes, qk.creators.all],
    success: (_d, t) => `“${t.name}” deleted`,
    onSuccess: () => setDeleting(null),
  })

  const columns: Column<CreatorTypeRow>[] = [
    {
      key: 'name',
      header: 'Type',
      cell: (t) => (
        <span className="min-w-0">
          <span className="block truncate font-medium">{t.name}</span>
          <span className="block truncate font-mono text-xs text-muted">{t.slug}</span>
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      className: 'max-w-72',
      cell: (t) => (t.description ? <span className="line-clamp-2 text-sm text-ink-soft">{t.description}</span> : <span className="text-faint">—</span>),
    },
    {
      key: 'followers',
      header: 'Followers',
      cell: (t) => (
        <Badge tone="outline" size="sm">
          {followerRange(t)}
        </Badge>
      ),
    },
    { key: 'sort', header: 'Order', className: 'tabular-nums', cell: (t) => t.sort_order },
    {
      key: 'active',
      header: 'Active',
      cell: (t) => (
        <Switch
          checked={t.active}
          disabled={toggle.isPending && toggle.variables?.slug === t.slug}
          onCheckedChange={(v) => toggle.mutate({ ...t, next: v })}
          aria-label={`${t.name} active`}
        />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      mobileLabel: 'Actions',
      cell: (t) => (
        <span className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>
            <Pencil />
          </Button>
          <Button variant="danger-ghost" size="icon-xs" onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`}>
            <Trash2 />
          </Button>
        </span>
      ),
    },
  ]

  return (
    <DetailCard
      title="Creator types"
      description={query.data ? `${types.length} types · ${types.filter((t) => t.active).length} active` : 'Audience-size and specialism labels.'}
      action={
        <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
          <Plus /> New type
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={query.data}
        rowKey={(t) => t.slug}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        mobilePrimary="name"
        empty={
          <EmptyState
            compact
            icon={<UsersRound />}
            title="No creator types yet"
            description="Add types like Nano creator or UGC creator for creators to choose from."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus /> New type
              </Button>
            }
          />
        }
      />

      <CreatorTypeDialog
        type={editing}
        nextSort={nextSort}
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="Creators using this type will have no type until they pick a new one. To keep it on existing profiles, deactivate it instead."
        confirmLabel="Delete type"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting)
        }}
      />
    </DetailCard>
  )
}
