import * as React from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Camera, Megaphone, Smartphone, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact, formatNumber } from '@/lib/format'
import { RESPONSE_TIMES } from '@/lib/constants'
import { useCategories, useCreatorTypes } from '@/hooks/use-catalog'
import { setCreatorCategories, updateMyCreator, type CreatorProfile } from '@/services/creators.service'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MultiSelect } from '@/components/ui/combobox'
import { RadioCard, RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SwitchRow } from '@/components/ui/switch'
import { ErrorState } from '@/components/shared/states'
import type { CreatorTypeRow } from '@/types'
import { creatorInfoSchema, type CreatorInfoInput, type CreatorInfoOutput } from './schemas'
import { FormActions, StudioSection } from './parts'
import { useStudioSync } from './use-studio'

const TYPE_ICONS: Record<string, LucideIcon> = {
  ugc_creator: Smartphone,
  nano_creator: Sparkles,
  micro_creator: Users,
  influencer: Megaphone,
  professional_creator: Camera,
}

function followerRange(t: Pick<CreatorTypeRow, 'min_followers' | 'max_followers'>) {
  if (t.min_followers != null && t.max_followers != null) return `${formatCompact(t.min_followers)}–${formatCompact(t.max_followers)} followers`
  if (t.min_followers != null) return `${formatCompact(t.min_followers)}+ followers`
  if (t.max_followers != null) return `Up to ${formatCompact(t.max_followers)} followers`
  return 'Any audience size'
}

function matchesAudience(t: CreatorTypeRow, followers: number) {
  if (t.min_followers == null && t.max_followers == null) return false
  return followers >= (t.min_followers ?? 0) && (t.max_followers == null || followers < t.max_followers)
}

/**
 * Categories (+ primary), creator type, engagement, response time and
 * availability. Requires an existing creator record.
 *
 * `essentials` hides the "How you work" block (engagement rate, response time,
 * availability) so signup only asks what a reviewer needs. Those keep their
 * existing values and are edited later in Profile.
 */
export function CreatorInfoForm({
  creator,
  submitLabel = 'Save changes',
  secondaryAction,
  onSaved,
  essentials,
  className,
}: {
  creator: CreatorProfile
  submitLabel?: string
  secondaryAction?: React.ReactNode
  onSaved?: () => void
  essentials?: boolean
  className?: string
}) {
  const sync = useStudioSync()
  const categories = useCategories()
  const types = useCreatorTypes()

  const current = creator.creator_categories
  const form = useForm<CreatorInfoInput, unknown, CreatorInfoOutput>({
    resolver: zodResolver(creatorInfoSchema),
    defaultValues: {
      categories: current.map((c) => c.category.id),
      primary_category: (current.find((c) => c.is_primary) ?? current[0])?.category.id ?? '',
      creator_type: creator.creator_type ?? '',
      engagement_rate: creator.engagement_rate != null ? String(creator.engagement_rate) : '',
      response_time: creator.response_time ?? '',
      available: creator.available,
    },
  })
  const { errors, isSubmitting, isDirty } = form.formState
  const selected = useWatch({ control: form.control, name: 'categories' }) ?? []

  // Active categories plus any the creator already has (keeps labels readable).
  const categoryOptions = React.useMemo(() => {
    const list = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))
    for (const cc of current) if (!list.some((o) => o.value === cc.category.id)) list.push({ value: cc.category.id, label: cc.category.name })
    return list
  }, [categories.data, current])
  const nameOf = (id: string) => categoryOptions.find((o) => o.value === id)?.label ?? 'Category'

  const save = useMutation({
    mutationFn: async (values: CreatorInfoOutput) => {
      try {
        await setCreatorCategories(values.categories, values.primary_category)
        return await updateMyCreator(creator.id, {
          creator_type: values.creator_type,
          engagement_rate: values.engagement_rate,
          response_time: values.response_time || null,
          available: values.available,
        })
      } finally {
        await sync()
      }
    },
    meta: { successMessage: 'Creator details saved' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
      form.reset(form.getValues())
      onSaved?.()
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className={cn('space-y-10', className)}>
      <StudioSection title="Your niche" description="Pick up to 5 categories. Your primary category leads your profile and search results.">
        <Field label="Categories" htmlFor="categories" required error={errors.categories?.message}>
          {categories.isPending ? (
            <Skeleton className="h-11 w-full" />
          ) : categories.isError ? (
            <ErrorState compact error={categories.error} title="Couldn’t load categories" onRetry={() => void categories.refetch()} />
          ) : (
            <Controller
              control={form.control}
              name="categories"
              render={({ field }) => (
                <MultiSelect
                  id="categories"
                  value={field.value}
                  onChange={(ids) => {
                    field.onChange(ids)
                    const primary = form.getValues('primary_category')
                    if (!ids.includes(primary)) form.setValue('primary_category', ids[0] ?? '', { shouldDirty: true })
                  }}
                  options={categoryOptions}
                  max={5}
                  placeholder="Choose categories"
                  searchPlaceholder="Search categories…"
                  aria-invalid={!!errors.categories}
                />
              )}
            />
          )}
        </Field>

        {selected.length > 1 && (
          <Field label="Primary category" htmlFor="primary_category" error={errors.primary_category?.message}>
            <Controller
              control={form.control}
              name="primary_category"
              render={({ field }) => (
                <RadioGroup
                  id="primary_category"
                  value={field.value}
                  onValueChange={field.onChange}
                  aria-label="Primary category"
                  className="flex flex-wrap gap-2"
                >
                  {selected.map((id) => (
                    <label
                      key={id}
                      htmlFor={`primary-${id}`}
                      className="flex cursor-pointer items-center gap-2 rounded-pill border border-line bg-surface py-1.5 pr-3.5 pl-2 text-sm font-medium transition-colors hover:border-line-strong has-data-[state=checked]:border-ink has-data-[state=checked]:bg-brand-soft"
                    >
                      <RadioGroupItem id={`primary-${id}`} value={id} className="size-4" />
                      {nameOf(id)}
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
          </Field>
        )}
      </StudioSection>

      <StudioSection
        title="Creator type"
        description={
          <>
            Follower ranges are a guide. Your total from social accounts is{' '}
            <span className="font-medium text-ink">{formatNumber(creator.followers_count)}</span>.
          </>
        }
      >
        {types.isPending ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-card" />
            ))}
          </div>
        ) : types.isError ? (
          <ErrorState compact error={types.error} title="Couldn’t load creator types" onRetry={() => void types.refetch()} />
        ) : (
          <Field htmlFor="creator_type" error={errors.creator_type?.message}>
            <Controller
              control={form.control}
              name="creator_type"
              render={({ field }) => (
                <RadioGroup
                  id="creator_type"
                  value={field.value}
                  onValueChange={field.onChange}
                  aria-label="Creator type"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  {types.data.map((t) => {
                    const Icon = TYPE_ICONS[t.slug] ?? Sparkles
                    return (
                      <RadioCard
                        key={t.slug}
                        value={t.slug}
                        icon={<Icon />}
                        title={
                          <span className="flex flex-wrap items-center gap-2">
                            {t.name}
                            {matchesAudience(t, creator.followers_count) && (
                              <Badge tone="brand-soft" size="sm">
                                Matches your audience
                              </Badge>
                            )}
                          </span>
                        }
                        description={
                          <>
                            {t.description}
                            <span className="mt-1 block text-xs font-medium text-ink-soft">{followerRange(t)}</span>
                          </>
                        }
                      />
                    )
                  })}
                </RadioGroup>
              )}
            />
          </Field>
        )}
      </StudioSection>

      {!essentials && (
      <StudioSection title="How you work" description="Set expectations so brands know what to expect before they order.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Engagement rate"
            htmlFor="engagement_rate"
            optional
            hint="Average across your main account, from your analytics."
            error={errors.engagement_rate?.message}
          >
            <Input
              id="engagement_rate"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 4.5"
              rightSlot={<span className="px-2 text-sm text-muted">%</span>}
              {...form.register('engagement_rate')}
            />
          </Field>
          <Field label="Typical response time" htmlFor="response_time" optional error={errors.response_time?.message}>
            <Controller
              control={form.control}
              name="response_time"
              render={({ field }) => (
                <Select id="response_time" value={field.value} onValueChange={field.onChange} options={RESPONSE_TIMES} placeholder="Select" />
              )}
            />
          </Field>
        </div>
        <div className="rounded-card border border-line bg-subtle/50 p-4">
          <Controller
            control={form.control}
            name="available"
            render={({ field }) => (
              <SwitchRow
                id="creator-available"
                label="Available for new orders"
                description="Turn this off when you’re fully booked. Brands can still see your profile."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </StudioSection>
      )}

      <FormActions submitLabel={submitLabel} submitting={isSubmitting} dirty={isDirty} secondary={secondaryAction} />
    </form>
  )
}
