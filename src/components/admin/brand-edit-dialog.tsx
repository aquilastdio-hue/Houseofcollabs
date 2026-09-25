import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import { INDUSTRIES } from '@/lib/constants'
import { updateBrand, type AdminBrandDetail } from '@/services/admin.service'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { adminLists } from './admin-keys'
import { FormDialog } from './form-dialog'
import { useAdminMutation } from './use-admin-mutation'

const optionalUrl = z
  .string()
  .trim()
  .max(300, 'Keep it under 300 characters')
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Start with https://')

const schema = z.object({
  brand_name: z.string().trim().min(2, 'Use at least 2 characters').max(80, 'Keep it under 80 characters'),
  description: z.string().trim().max(2000, 'Keep it under 2,000 characters'),
  industry: z.string().trim().max(80, 'Keep it under 80 characters'),
  location: z.string().trim().max(120, 'Keep it under 120 characters'),
  website_url: optionalUrl,
  instagram_url: optionalUrl,
  contact_email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email'),
  contact_phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number'),
})

type Values = z.infer<typeof schema>
type Patch = Parameters<typeof updateBrand>[1]
const FIELDS = ['brand_name', 'description', 'industry', 'location', 'website_url', 'instagram_url', 'contact_email', 'contact_phone'] as const

const INDUSTRY_OPTIONS = INDUSTRIES.map((i) => ({ value: i, label: i }))

/** Admin edit of the brand profile (fields accepted by `admin_update_brand`). */
export function BrandEditDialog({ brand, open, onOpenChange }: { brand: AdminBrandDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const initial = React.useMemo<Values>(
    () => ({
      brand_name: brand.brand_name,
      description: brand.description ?? '',
      industry: brand.industry ?? '',
      location: brand.location ?? '',
      website_url: brand.website_url ?? '',
      instagram_url: brand.instagram_url ?? '',
      contact_email: brand.contact_email ?? '',
      contact_phone: brand.contact_phone ?? '',
    }),
    [brand],
  )
  const form = useForm<Values>({ resolver: zodResolver(schema), values: initial })
  const e = form.formState.errors

  const save = useAdminMutation((patch: Patch) => updateBrand(brand.id, patch), {
    invalidate: [qk.admin.brand(brand.id), adminLists.brands],
    success: 'Brand updated',
    onSuccess: () => onOpenChange(false),
  })

  const onSubmit = form.handleSubmit((v) => {
    const patch: Patch = {}
    for (const key of FIELDS) if (v[key] !== initial[key]) patch[key] = v[key]
    if (Object.keys(patch).length === 0) {
      toast('Nothing changed')
      onOpenChange(false)
      return
    }
    save.mutate(patch)
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset(initial)
        onOpenChange(o)
      }}
      title="Edit brand"
      description="Changes are saved to the brand’s profile and recorded in the audit log."
      submitLabel="Save changes"
      loading={save.isPending}
      submitDisabled={!form.formState.isDirty}
      onSubmit={onSubmit}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Brand name" htmlFor="be-name" required error={e.brand_name?.message} className="sm:col-span-2">
          <Input id="be-name" maxLength={80} {...form.register('brand_name')} />
        </Field>
        <Field label="Description" htmlFor="be-description" error={e.description?.message} className="sm:col-span-2">
          <Textarea id="be-description" rows={4} maxLength={2000} {...form.register('description')} />
        </Field>
        <Field label="Industry" htmlFor="be-industry" error={e.industry?.message}>
          <Combobox
            id="be-industry"
            value={form.watch('industry')}
            onChange={(v) => form.setValue('industry', v, { shouldDirty: true, shouldValidate: true })}
            options={INDUSTRY_OPTIONS}
            placeholder="Choose industry"
            allowCustom
            clearable
          />
        </Field>
        <Field label="Location" htmlFor="be-location" error={e.location?.message}>
          <Input id="be-location" maxLength={120} placeholder="City, state" {...form.register('location')} />
        </Field>
        <Field label="Website" htmlFor="be-website" error={e.website_url?.message}>
          <Input id="be-website" type="url" inputMode="url" placeholder="https://" {...form.register('website_url')} />
        </Field>
        <Field label="Instagram" htmlFor="be-instagram" error={e.instagram_url?.message}>
          <Input id="be-instagram" type="url" inputMode="url" placeholder="https://instagram.com/…" {...form.register('instagram_url')} />
        </Field>
        <Field label="Contact email" htmlFor="be-email" error={e.contact_email?.message}>
          <Input id="be-email" type="email" autoComplete="off" {...form.register('contact_email')} />
        </Field>
        <Field label="Contact phone" htmlFor="be-phone" error={e.contact_phone?.message}>
          <Input id="be-phone" type="tel" autoComplete="off" {...form.register('contact_phone')} />
        </Field>
      </div>
    </FormDialog>
  )
}
