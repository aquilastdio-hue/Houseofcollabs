import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn, slugify } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { titleCase } from '@/lib/format'
import { toneFor } from '@/lib/constants'
import { createCategory, deleteCategory, listAllCategories, updateCategory } from '@/services/admin.service'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch, SwitchRow } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/states'
import type { Category } from '@/types'
import { adminKeys } from './admin-keys'
import { DetailCard } from './detail'
import { FormDialog, Notice } from './form-dialog'
import { useAdminMutation } from './use-admin-mutation'

export const CATEGORY_COLORS = ['rose', 'peach', 'sand', 'mint', 'sky', 'lilac', 'brand'] as const

function ToneChip({ color, label }: { color: string | null; label?: string }) {
  const tone = toneFor(color)
  return <span className={cn('inline-flex h-5 items-center rounded-pill px-2 text-[0.6875rem] font-semibold', tone.bg, tone.fg)}>{label ?? titleCase(color ?? 'sand')}</span>
}

const COLOR_OPTIONS = CATEGORY_COLORS.map((c) => ({ value: c, label: <ToneChip color={c} /> }))

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters').max(60, 'Keep it under 60 characters'),
  slug: z
    .string()
    .trim()
    .min(2, 'Use at least 2 characters')
    .max(60, 'Keep it under 60 characters')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters and numbers, separated by single hyphens'),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
  icon: z
    .string()
    .trim()
    .max(60, 'Keep it under 60 characters')
    .refine((v) => v === '' || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), 'Use a Lucide icon name in kebab-case, e.g. gamepad-2'),
  color: z.enum(CATEGORY_COLORS),
  sort_order: z.string().trim().regex(/^-?\d{1,4}$/, 'Enter a whole number between -9999 and 9999'),
  active: z.boolean(),
})
type Values = z.infer<typeof schema>

function toValues(c?: Category | null): Values {
  const color = CATEGORY_COLORS.find((x) => x === c?.color) ?? 'sand'
  return {
    name: c?.name ?? '',
    slug: c?.slug ?? '',
    description: c?.description ?? '',
    icon: c?.icon ?? '',
    color,
    sort_order: String(c?.sort_order ?? 0),
    active: c?.active ?? true,
  }
}

function CategoryDialog({ category, nextSort, open, onOpenChange }: { category: Category | null; nextSort: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const editing = !!category
  const initial = React.useMemo(() => (category ? toValues(category) : { ...toValues(null), sort_order: String(nextSort) }), [category, nextSort])
  const form = useForm<Values>({ resolver: zodResolver(schema), values: initial })
  const [slugTouched, setSlugTouched] = React.useState(editing)
  const e = form.formState.errors

  React.useEffect(() => {
    if (open) setSlugTouched(editing)
  }, [open, editing])

  const save = useAdminMutation(
    (v: Values) => {
      const payload = {
        name: v.name,
        slug: v.slug,
        description: v.description || null,
        icon: v.icon || null,
        color: v.color,
        sort_order: Number(v.sort_order),
        active: v.active,
      }
      return category ? updateCategory(category.id, payload) : createCategory(payload)
    },
    {
      invalidate: [adminKeys.categories, qk.categories],
      success: (_d, v) => (category ? `“${v.name}” updated` : `“${v.name}” created`),
      onSuccess: () => {
        form.reset(initial)
        onOpenChange(false)
      },
    },
  )

  const slug = form.watch('slug')
  const nameField = form.register('name', {
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
      if (!slugTouched) form.setValue('slug', slugify(ev.target.value).slice(0, 60), { shouldValidate: form.formState.isSubmitted })
    },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset(initial)
        onOpenChange(o)
      }}
      title={editing ? `Edit ${category.name}` : 'New category'}
      description="Categories power discovery filters, creator tags and /categories pages."
      submitLabel={editing ? 'Save category' : 'Create category'}
      loading={save.isPending}
      submitDisabled={editing && !form.formState.isDirty}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="cat-name" required error={e.name?.message}>
          <Input id="cat-name" maxLength={60} autoComplete="off" {...nameField} />
        </Field>
        <Field label="Slug" htmlFor="cat-slug" required error={e.slug?.message} hint={`URL: /categories/${slug || 'your-slug'}`}>
          <Input
            id="cat-slug"
            maxLength={60}
            autoComplete="off"
            className="font-mono"
            {...form.register('slug', { onChange: () => setSlugTouched(true) })}
          />
        </Field>
        {editing && slug !== category.slug && (
          <Notice tone="warning" className="sm:col-span-2">
            Changing the slug changes the public URL. Old links to /categories/{category.slug} will stop working.
          </Notice>
        )}
        <Field label="Description" htmlFor="cat-description" error={e.description?.message} className="sm:col-span-2" hint={`${form.watch('description').length}/500`}>
          <Textarea id="cat-description" rows={3} maxLength={500} {...form.register('description')} />
        </Field>
        <Field
          label="Icon"
          htmlFor="cat-icon"
          optional
          error={e.icon?.message}
          hint={
            <>
              A{' '}
              <a href="https://lucide.dev/icons" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Lucide icon
              </a>{' '}
              name, e.g. sparkles, gamepad-2.
            </>
          }
        >
          <Input id="cat-icon" maxLength={60} autoComplete="off" className="font-mono" placeholder="sparkles" {...form.register('icon')} />
        </Field>
        <Field label="Colour" htmlFor="cat-color" required error={e.color?.message}>
          <Select id="cat-color" value={form.watch('color')} onValueChange={(v) => form.setValue('color', v as Values['color'], { shouldDirty: true })} options={COLOR_OPTIONS} />
        </Field>
        <Field label="Sort order" htmlFor="cat-sort" required error={e.sort_order?.message} hint="Lower numbers show first.">
          <Input id="cat-sort" type="number" inputMode="numeric" step={1} {...form.register('sort_order')} />
        </Field>
        <div className="flex items-end">
          <div className="w-full rounded-control border border-line p-3">
            <SwitchRow
              id="cat-active"
              label="Active"
              description="Inactive categories are hidden from discovery."
              checked={form.watch('active')}
              onCheckedChange={(v) => form.setValue('active', v, { shouldDirty: true })}
            />
          </div>
        </div>
      </div>
    </FormDialog>
  )
}

/** Categories CRUD (name, slug, description, icon, colour, order, active). */
export function CategoryManager() {
  const query = useQuery({ queryKey: adminKeys.categories, queryFn: listAllCategories })
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [deleting, setDeleting] = React.useState<Category | null>(null)
  const categories = query.data ?? []
  const nextSort = categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1

  const toggle = useAdminMutation(({ id, active }: { id: string; active: boolean; name: string }) => updateCategory(id, { active }), {
    invalidate: [adminKeys.categories, qk.categories],
    success: (_d, v) => `“${v.name}” ${v.active ? 'activated' : 'hidden from discovery'}`,
  })
  const remove = useAdminMutation((c: Category) => deleteCategory(c.id), {
    invalidate: [adminKeys.categories, qk.categories, qk.creators.all],
    success: (_d, c) => `“${c.name}” deleted`,
    onSuccess: () => setDeleting(null),
  })

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Category',
      cell: (c) => (
        <span className="flex min-w-0 items-center gap-3">
          <ToneChip color={c.color} label={c.name.slice(0, 1).toUpperCase()} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{c.name}</span>
            <span className="block truncate font-mono text-xs text-muted">/{c.slug}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      className: 'max-w-72',
      cell: (c) => (c.description ? <span className="line-clamp-2 text-sm text-ink-soft">{c.description}</span> : <span className="text-faint">—</span>),
    },
    { key: 'icon', header: 'Icon', cell: (c) => (c.icon ? <span className="font-mono text-xs">{c.icon}</span> : <span className="text-faint">—</span>) },
    { key: 'color', header: 'Colour', cell: (c) => <ToneChip color={c.color} /> },
    { key: 'sort', header: 'Order', className: 'tabular-nums', cell: (c) => c.sort_order },
    {
      key: 'active',
      header: 'Active',
      cell: (c) => (
        <Switch
          checked={c.active}
          disabled={toggle.isPending && toggle.variables?.id === c.id}
          onCheckedChange={(v) => toggle.mutate({ id: c.id, active: v, name: c.name })}
          aria-label={`${c.name} active`}
        />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      mobileLabel: 'Actions',
      cell: (c) => (
        <span className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
            <Pencil />
          </Button>
          <Button variant="danger-ghost" size="icon-xs" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}>
            <Trash2 />
          </Button>
        </span>
      ),
    },
  ]

  return (
    <DetailCard
      title="Categories"
      description={query.data ? `${categories.length} categories · ${categories.filter((c) => c.active).length} active` : 'Niches creators tag themselves with.'}
      action={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus /> New category
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={query.data}
        rowKey={(c) => c.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        mobilePrimary="name"
        empty={
          <EmptyState
            compact
            icon={<FolderTree />}
            title="No categories yet"
            description="Create the niches creators can pick, like Beauty or Tech."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus /> New category
              </Button>
            }
          />
        }
      />

      <CategoryDialog
        category={editing}
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
        description="Creators tagged with this category lose the tag, and its /categories page disappears. Portfolio items and briefs keep working without it. To keep history, turn the category off instead."
        confirmLabel="Delete category"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting)
        }}
      />
    </DetailCard>
  )
}
