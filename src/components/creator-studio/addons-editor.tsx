import * as React from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { IndianRupee, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDays, formatINR } from '@/lib/format'
import { ADDON_TYPES, labelFor } from '@/lib/constants'
import { createAddon, deleteAddon, updateAddon, type MyService } from '@/services/creator-services.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SwitchRow } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import type { AddonType, ServiceAddon } from '@/types'
import { makeAddonSchema, type AddonFormInput, type AddonFormOutput } from './schemas'
import { EarningEstimate, parseAmount } from './earning-estimate'
import { useStudioSync } from './use-studio'

type Preset = {
  key: string
  label: string
  addon_type: AddonType
  name: string
  price: number
  description: string
  extra_revisions?: number
  delivery_days_override?: number
}

export const ADDON_PRESETS: Preset[] = [
  {
    key: 'revision',
    label: 'Extra revision',
    addon_type: 'extra_revision',
    name: 'Extra revision',
    price: 300,
    extra_revisions: 1,
    description: 'One more round of changes after delivery.',
  },
  {
    key: 'express',
    label: '24-hour delivery',
    addon_type: 'express_delivery',
    name: '24-hour delivery',
    price: 1000,
    delivery_days_override: 1,
    description: 'Get the finished content within 24 hours.',
  },
  { key: 'raw', label: 'Raw footage', addon_type: 'raw_footage', name: 'Raw footage', price: 500, description: 'All the unedited clips from the shoot.' },
  { key: 'extra', label: 'Extra video', addon_type: 'extra_content', name: 'Extra video', price: 1000, description: 'One more video in the same style.' },
  {
    key: 'rights',
    label: 'Usage rights',
    addon_type: 'usage_rights',
    name: 'Usage rights',
    price: 1500,
    description: 'Run the content as paid ads on your brand’s channels.',
  },
]

function typeLabel(type?: string | null) {
  return labelFor(ADDON_TYPES, type)
}

/** Name we prefill when a type is picked (custom add-ons are named by the creator). */
function defaultName(type: string) {
  return type === 'custom' ? '' : typeLabel(type)
}

function suggestedExpressDays(serviceDays: number) {
  return Math.max(1, Math.floor(serviceDays / 2))
}

function addonDetails(a: Pick<ServiceAddon, 'addon_type' | 'extra_revisions' | 'delivery_days_override' | 'description'>) {
  const parts: string[] = []
  if (a.addon_type === 'extra_revision' && a.extra_revisions > 0) parts.push(`+${a.extra_revisions} revision${a.extra_revisions === 1 ? '' : 's'}`)
  if (a.addon_type === 'express_delivery' && a.delivery_days_override) parts.push(`Delivered in ${formatDays(a.delivery_days_override)}`)
  if (a.description) parts.push(a.description)
  return parts.join(' · ')
}

function PriceHint({ control }: { control: Control<AddonFormInput, unknown, AddonFormOutput> }) {
  const price = useWatch({ control, name: 'price' })
  const amount = parseAmount(price)
  return (
    <span>
      Use 0 to include it for free. <EarningEstimate amount={amount} />
    </span>
  )
}

function AddonForm({
  service,
  addon,
  preset,
  onDone,
}: {
  service: MyService
  addon: ServiceAddon | null
  preset?: Preset
  onDone: () => void
}) {
  const sync = useStudioSync()
  const schema = React.useMemo(() => makeAddonSchema(service.delivery_days), [service.delivery_days])
  const expressBlocked = service.delivery_days <= 1
  const form = useForm<AddonFormInput, unknown, AddonFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: addon
      ? {
          addon_type: addon.addon_type,
          name: addon.name,
          description: addon.description ?? '',
          price: String(addon.price),
          extra_revisions: String(addon.extra_revisions),
          delivery_days_override: addon.delivery_days_override != null ? String(addon.delivery_days_override) : '',
          active: addon.active,
        }
      : preset
        ? {
            addon_type: preset.addon_type,
            name: preset.name,
            description: preset.description,
            price: String(preset.price),
            extra_revisions: String(preset.extra_revisions ?? 0),
            delivery_days_override: preset.delivery_days_override != null ? String(preset.delivery_days_override) : '',
            active: true,
          }
        : { addon_type: '', name: '', description: '', price: '', extra_revisions: '0', delivery_days_override: '', active: true },
  })
  const { errors, isSubmitting } = form.formState
  const type = useWatch({ control: form.control, name: 'addon_type' })

  const typeOptions = ADDON_TYPES.map((o) => ({ value: o.value, label: o.label, disabled: o.value === 'express_delivery' && expressBlocked }))

  /** Smart defaults when the type changes. */
  const applyType = (next: string) => {
    const prev = form.getValues('addon_type')
    form.setValue('addon_type', next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    const name = form.getValues('name').trim()
    if (!name || (prev && name === defaultName(prev))) form.setValue('name', defaultName(next), { shouldDirty: true })
    if (next === 'extra_revision') {
      if (!(Number(form.getValues('extra_revisions')) >= 1)) form.setValue('extra_revisions', '1', { shouldDirty: true })
    } else {
      form.setValue('extra_revisions', '0')
    }
    if (next === 'express_delivery') {
      if (!form.getValues('delivery_days_override')) {
        form.setValue('delivery_days_override', String(suggestedExpressDays(service.delivery_days)), { shouldDirty: true })
      }
    } else {
      form.setValue('delivery_days_override', '')
    }
  }

  const save = useMutation({
    mutationFn: async (values: AddonFormOutput) => {
      const input = {
        addon_type: values.addon_type,
        name: values.name,
        description: values.description || null,
        price: values.price,
        extra_revisions: values.addon_type === 'extra_revision' ? values.extra_revisions : 0,
        delivery_days_override: values.addon_type === 'express_delivery' ? values.delivery_days_override : null,
        active: values.active,
      }
      const row = addon
        ? await updateAddon(addon.id, input)
        : await createAddon(service.id, { ...input, sort_order: service.service_addons.length })
      await sync(qk.services.mine)
      return row
    },
    meta: { successMessage: addon ? 'Add-on updated' : 'Add-on added' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
      onDone()
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  const selectedType = ADDON_TYPES.find((o) => o.value === type)

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>{addon ? 'Edit add-on' : 'New add-on'}</DialogTitle>
        <DialogDescription>
          For “{service.title}” · standard delivery {formatDays(service.delivery_days)}, {service.revisions_included} revision
          {service.revisions_included === 1 ? '' : 's'}.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <Field label="Type" htmlFor="addon-type" required hint={selectedType?.description} error={errors.addon_type?.message}>
          <Controller
            control={form.control}
            name="addon_type"
            render={({ field }) => (
              <Select
                id="addon-type"
                value={field.value}
                onValueChange={applyType}
                options={typeOptions}
                placeholder="Choose a type"
                aria-invalid={!!errors.addon_type}
              />
            )}
          />
        </Field>
        <Field label="Name" htmlFor="addon-name" required error={errors.name?.message}>
          <Input id="addon-name" maxLength={80} placeholder="e.g. Extra video" {...form.register('name')} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Price" htmlFor="addon-price" required hint={<PriceHint control={form.control} />} error={errors.price?.message}>
            <Input id="addon-price" inputMode="decimal" autoComplete="off" leftIcon={<IndianRupee />} placeholder="500" {...form.register('price')} />
          </Field>
          {type === 'extra_revision' && (
            <Field label="Extra revisions" htmlFor="addon-revisions" required error={errors.extra_revisions?.message}>
              <Input id="addon-revisions" inputMode="numeric" autoComplete="off" placeholder="1" {...form.register('extra_revisions')} />
            </Field>
          )}
          {type === 'express_delivery' && (
            <Field
              label="Faster delivery (days)"
              htmlFor="addon-delivery"
              required
              hint={`Must be under the standard ${formatDays(service.delivery_days)}. Use 1 for 24 hours.`}
              error={errors.delivery_days_override?.message}
            >
              <Input id="addon-delivery" inputMode="numeric" autoComplete="off" placeholder="1" {...form.register('delivery_days_override')} />
            </Field>
          )}
        </div>
        <Field label="Description" htmlFor="addon-description" optional error={errors.description?.message}>
          <Textarea id="addon-description" rows={3} maxLength={500} placeholder="What exactly does the brand get?" {...form.register('description')} />
        </Field>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <SwitchRow
              id="addon-active"
              label="Offer this add-on"
              description="Hidden add-ons stay saved but brands can’t pick them."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {addon ? 'Save add-on' : 'Add add-on'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Add-ons for one service: list, presets and create/edit/delete dialogs. */
export function AddonsEditor({ service, className }: { service: MyService; className?: string }) {
  const sync = useStudioSync()
  const [editing, setEditing] = React.useState<{ addon: ServiceAddon | null; preset?: Preset } | null>(null)
  const [deleting, setDeleting] = React.useState<ServiceAddon | null>(null)
  const addons = service.service_addons
  const expressBlocked = service.delivery_days <= 1
  const presets = ADDON_PRESETS.filter((p) => !addons.some((a) => a.name.trim().toLowerCase() === p.name.toLowerCase()))

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteAddon(id)
      await sync(qk.services.mine)
    },
    meta: { successMessage: 'Add-on deleted' },
  })

  return (
    <div className={cn('rounded-card border border-line bg-subtle/40 p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">
          Add-ons <span className="font-normal text-muted">({addons.length})</span>
        </h4>
        <Button type="button" variant="secondary" size="xs" onClick={() => setEditing({ addon: null })} aria-label={`New add-on for ${service.title}`}>
          <Plus /> Add-on
        </Button>
      </div>

      {addons.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No add-ons yet. Extras like faster delivery or raw footage raise your order value.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {addons.map((a) => {
            const details = addonDetails(a)
            return (
              <li key={a.id} className="flex items-start gap-3 rounded-control border border-line bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                    <span className="break-words">{a.name}</span>
                    <Badge tone="neutral" size="sm">
                      {typeLabel(a.addon_type)}
                    </Badge>
                    {!a.active && (
                      <Badge tone="outline" size="sm">
                        Hidden
                      </Badge>
                    )}
                  </p>
                  {details && <p className="mt-0.5 text-xs text-muted">{details}</p>}
                </div>
                <p className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums">+{formatINR(a.price)}</p>
                <div className="-my-1 flex shrink-0">
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Edit ${a.name}`} onClick={() => setEditing({ addon: a })}>
                    <Pencil />
                  </Button>
                  <Button type="button" variant="danger-ghost" size="icon-xs" aria-label={`Delete ${a.name}`} onClick={() => setDeleting(a)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {presets.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted">Quick add</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.key}
                type="button"
                variant="outline"
                size="xs"
                disabled={p.addon_type === 'express_delivery' && expressBlocked}
                onClick={() => setEditing({ addon: null, preset: p })}
              >
                <Plus /> {p.label} · {formatINR(p.price)}
              </Button>
            ))}
          </div>
          {expressBlocked && presets.some((p) => p.addon_type === 'express_delivery') && (
            <p className="mt-2 text-xs text-faint">This service already delivers within 24 hours, so a faster-delivery add-on isn’t available.</p>
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="md">
          {editing && (
            <AddonForm
              key={editing.addon?.id ?? editing.preset?.key ?? 'new'}
              service={service}
              addon={editing.addon}
              preset={editing.preset}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete “${deleting.name}”?` : 'Delete add-on?'}
        description="Brands won’t be able to pick it any more. Orders that already include it keep their details."
        confirmLabel="Delete"
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
    </div>
  )
}
