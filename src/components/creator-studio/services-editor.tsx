import * as React from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Archive, Check, IndianRupee, Pencil, Plus, Tags, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { CONTENT_TYPES, PLATFORMS } from '@/lib/constants'
import { archiveService, createService, updateService, type MyService } from '@/services/creator-services.service'
import type { CreatorProfile } from '@/services/creators.service'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch, SwitchRow } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { ServiceCard } from '@/components/creator/service-card'
import { INCLUDE_MAX_ITEMS, INCLUDE_MAX_LENGTH, serviceSchema, type ServiceFormInput, type ServiceFormOutput } from './schemas'
import { AddonsEditor } from './addons-editor'
import { EarningEstimate, parseAmount } from './earning-estimate'
import { StudioSection } from './parts'
import { useMyServices, useStudioSync } from './use-studio'

const INCLUDE_SUGGESTIONS = ['1 video', 'Script & concept', 'Subtitles', 'Raw files', 'Posted on my account']

/** Chip-style editor for the "what's included" list. */
function IncludesInput({ id, value, onChange, invalid }: { id: string; value: string[]; onChange: (value: string[]) => void; invalid?: boolean }) {
  const [draft, setDraft] = React.useState('')
  const [problem, setProblem] = React.useState<string | null>(null)
  const full = value.length >= INCLUDE_MAX_ITEMS

  const add = (raw: string) => {
    const item = raw.trim().replace(/\s+/g, ' ')
    if (!item) return
    if (item.length > INCLUDE_MAX_LENGTH) return setProblem(`Keep each item to ${INCLUDE_MAX_LENGTH} characters or fewer.`)
    if (value.some((v) => v.toLowerCase() === item.toLowerCase())) return setProblem('That’s already on the list.')
    if (full) return setProblem(`You can list up to ${INCLUDE_MAX_ITEMS} items.`)
    onChange([...value, item])
    setDraft('')
    setProblem(null)
  }

  const suggestions = INCLUDE_SUGGESTIONS.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          maxLength={INCLUDE_MAX_LENGTH}
          disabled={full}
          placeholder={full ? 'The list is full' : 'e.g. 1 vertical video (30–60s)'}
          aria-invalid={invalid || !!problem || undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            setProblem(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={() => add(draft)} disabled={full || !draft.trim()}>
          <Plus /> Add
        </Button>
      </div>
      {problem && (
        <p role="alert" className="text-xs font-medium text-danger">
          {problem}
        </p>
      )}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Included items">
          {value.map((item) => (
            <li key={item} className="inline-flex max-w-full items-center gap-1.5 rounded-pill bg-subtle py-1 pr-1 pl-2.5 text-sm">
              <Check className="size-3.5 shrink-0 text-brand-ink" aria-hidden />
              <span className="truncate">{item}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== item))}
                className="focus-ring rounded-full p-1 text-muted hover:bg-muted-surface hover:text-ink"
                aria-label={`Remove “${item}”`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="tabular-nums">
          {value.length}/{INCLUDE_MAX_ITEMS} items
        </span>
        {!full && suggestions.length > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>Suggestions:</span>
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="focus-ring rounded-pill border border-dashed border-line-strong px-2 py-0.5 text-ink-soft hover:border-ink hover:text-ink"
              >
                + {s}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function PriceHint({ control }: { control: Control<ServiceFormInput, unknown, ServiceFormOutput> }) {
  const price = useWatch({ control, name: 'price' })
  const amount = parseAmount(price)
  return Number.isFinite(amount) && amount > 0 ? <EarningEstimate amount={amount} /> : <span>Between ₹100 and ₹1,00,00,000.</span>
}

function ServiceForm({
  creatorId,
  service,
  nextSortOrder,
  onDone,
}: {
  creatorId: string
  service: MyService | null
  nextSortOrder: number
  onDone: () => void
}) {
  const sync = useStudioSync()
  const form = useForm<ServiceFormInput, unknown, ServiceFormOutput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: service
      ? {
          title: service.title,
          description: service.description ?? '',
          price: String(service.price),
          delivery_days: String(service.delivery_days),
          revisions_included: String(service.revisions_included),
          content_type: service.content_type,
          platform: service.platform ?? '',
          requires_shipping: service.requires_shipping,
          includes: service.includes,
          active: service.active,
        }
      : {
          title: '',
          description: '',
          price: '',
          delivery_days: '7',
          revisions_included: '1',
          content_type: 'ugc_video',
          platform: '',
          requires_shipping: false,
          includes: [],
          active: true,
        },
  })
  const { errors, isSubmitting } = form.formState

  const save = useMutation({
    mutationFn: async (values: ServiceFormOutput) => {
      const input = { ...values, description: values.description || null }
      const row = service ? await updateService(service.id, input) : await createService(creatorId, { ...input, sort_order: nextSortOrder })
      await sync(qk.services.mine)
      return row
    },
    meta: { successMessage: service ? 'Service updated' : 'Service created' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
      onDone()
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>{service ? 'Edit service' : 'New service'}</DialogTitle>
        <DialogDescription>A fixed-price package: what brands get, how fast, and how many revisions.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-5">
        <Field label="Title" htmlFor="service-title" required error={errors.title?.message}>
          <Input id="service-title" maxLength={100} placeholder="e.g. 1 UGC video for Instagram Reels" {...form.register('title')} />
        </Field>
        <Field
          label="Description"
          htmlFor="service-description"
          optional
          hint="What the brand gets, how you work and what you need from them."
          error={errors.description?.message}
        >
          <Textarea id="service-description" rows={4} maxLength={2000} {...form.register('description')} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Price" htmlFor="service-price" required hint={<PriceHint control={form.control} />} error={errors.price?.message} className="sm:col-span-2">
            <Input id="service-price" inputMode="decimal" autoComplete="off" leftIcon={<IndianRupee />} placeholder="2500" {...form.register('price')} />
          </Field>
          <Field label="Delivery" htmlFor="service-delivery" required hint="1–90 days" error={errors.delivery_days?.message}>
            <Input
              id="service-delivery"
              inputMode="numeric"
              autoComplete="off"
              rightSlot={<span className="px-2 text-sm text-muted">days</span>}
              {...form.register('delivery_days')}
            />
          </Field>
          <Field label="Revisions" htmlFor="service-revisions" required hint="0–10 included" error={errors.revisions_included?.message}>
            <Input id="service-revisions" inputMode="numeric" autoComplete="off" {...form.register('revisions_included')} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Content type" htmlFor="service-content-type" required error={errors.content_type?.message}>
            <Controller
              control={form.control}
              name="content_type"
              render={({ field }) => (
                <Select
                  id="service-content-type"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={CONTENT_TYPES}
                  placeholder="Choose a content type"
                  aria-invalid={!!errors.content_type}
                />
              )}
            />
          </Field>
          <Field label="Platform" htmlFor="service-platform" optional error={errors.platform?.message}>
            <Controller
              control={form.control}
              name="platform"
              render={({ field }) => (
                <Select
                  id="service-platform"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={PLATFORMS}
                  anyLabel="Any platform"
                  aria-invalid={!!errors.platform}
                />
              )}
            />
          </Field>
        </div>

        <Field label="What’s included" htmlFor="service-includes" optional hint="Press Enter to add each item." error={errors.includes?.message}>
          <Controller
            control={form.control}
            name="includes"
            render={({ field }) => <IncludesInput id="service-includes" value={field.value} onChange={field.onChange} invalid={!!errors.includes} />}
          />
        </Field>

        <div className="space-y-4 rounded-card border border-line bg-subtle/50 p-4">
          <Controller
            control={form.control}
            name="requires_shipping"
            render={({ field }) => (
              <SwitchRow
                id="service-shipping"
                label="Needs the brand’s product"
                description="The brand ships you the product before you start."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Controller
            control={form.control}
            name="active"
            render={({ field }) => (
              <SwitchRow
                id="service-active"
                label="Show on my storefront"
                description="Hidden services stay saved but can’t be ordered."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {service ? 'Save service' : 'Create service'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * The creator's services (ServiceCard + edit / archive / show-hide) with an
 * add-ons editor per service. `showAddons={false}` hides add-on management.
 */
export function ServicesEditor({
  creator,
  showAddons = true,
  title = 'Your services',
  description = 'Fixed-price packages brands can order instantly.',
  gridClassName = 'md:grid-cols-2',
  className,
}: {
  creator: CreatorProfile
  showAddons?: boolean
  title?: string
  description?: string
  gridClassName?: string
  className?: string
}) {
  const qc = useQueryClient()
  const sync = useStudioSync()
  const services = useMyServices(creator.id)
  const [editing, setEditing] = React.useState<{ service: MyService | null } | null>(null)
  const [archiving, setArchiving] = React.useState<MyService | null>(null)
  const list = services.data ?? []
  const nextSortOrder = list.reduce((max, s) => Math.max(max, s.sort_order + 1), list.length)

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateService(id, { active }),
    onMutate: async ({ id, active }) => {
      await qc.cancelQueries({ queryKey: qk.services.mine })
      const previous = qc.getQueryData<MyService[]>(qk.services.mine)
      qc.setQueryData<MyService[]>(qk.services.mine, (old) => old?.map((s) => (s.id === id ? { ...s, active } : s)))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(qk.services.mine, context.previous)
    },
    onSuccess: (_row, vars) => {
      toast.success(vars.active ? 'Service is on your storefront' : 'Service hidden from your storefront')
    },
    onSettled: () => sync(qk.services.mine),
  })

  const archive = useMutation({
    mutationFn: async (id: string) => {
      await archiveService(id)
      await sync(qk.services.mine)
    },
    meta: { successMessage: 'Service archived' },
  })

  return (
    <StudioSection
      className={className}
      title={title}
      description={description}
      action={
        list.length > 0 && (
          <Button type="button" size="sm" onClick={() => setEditing({ service: null })}>
            <Plus /> New service
          </Button>
        )
      }
    >
      {services.isPending ? (
        <div className={cn('grid gap-4', gridClassName)}>
          <Skeleton className="h-72 rounded-card" />
          <Skeleton className="h-72 rounded-card" />
        </div>
      ) : services.isError ? (
        <ErrorState error={services.error} title="Couldn’t load your services" onRetry={() => void services.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Tags />}
          title="No services yet"
          description="Create a fixed-price package — for example, one UGC video with two revisions, delivered in 7 days."
          action={
            <Button type="button" onClick={() => setEditing({ service: null })}>
              <Plus /> Create your first service
            </Button>
          }
        />
      ) : (
        <div className={cn('grid items-start gap-4', gridClassName)}>
          {list.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              addons={showAddons ? [] : s.service_addons}
              action={
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <label htmlFor={`service-live-${s.id}`} className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                      <Switch
                        id={`service-live-${s.id}`}
                        checked={s.active}
                        disabled={toggle.isPending && toggle.variables?.id === s.id}
                        onCheckedChange={(active) => toggle.mutate({ id: s.id, active })}
                      />
                      <span>
                        Show on storefront<span className="sr-only">: {s.title}</span>
                      </span>
                    </label>
                    <div className="flex gap-1.5">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setEditing({ service: s })} aria-label={`Edit ${s.title}`}>
                        <Pencil /> Edit
                      </Button>
                      <Button type="button" variant="danger-ghost" size="sm" onClick={() => setArchiving(s)} aria-label={`Archive ${s.title}`}>
                        <Archive /> Archive
                      </Button>
                    </div>
                  </div>
                  {showAddons && <AddonsEditor service={s} />}
                </div>
              }
            />
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="lg">
          {editing && (
            <ServiceForm
              key={editing.service?.id ?? 'new'}
              creatorId={creator.id}
              service={editing.service}
              nextSortOrder={nextSortOrder}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={archiving ? `Archive “${archiving.title}”?` : 'Archive service?'}
        description="Existing orders keep their details. The service is removed from your storefront and this list."
        confirmLabel="Archive service"
        destructive
        loading={archive.isPending}
        onConfirm={async () => {
          if (!archiving) return
          try {
            await archive.mutateAsync(archiving.id)
            setArchiving(null)
          } catch {
            // The mutation cache already surfaced the error.
          }
        }}
      />
    </StudioSection>
  )
}
