import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { site } from '@/config/site'
import { qk } from '@/lib/query-keys'
import { GST_STATES, cleanId, gstinProblem, isValidPan } from '@/lib/gst'
import { saveMyTaxProfile, type BrandBillingProfile, type CreatorTaxProfile } from '@/services/billing.service'
import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SwitchRow } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const ENTITY_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'sole_proprietor', label: 'Sole proprietor' },
  { value: 'huf', label: 'HUF' },
  { value: 'partnership', label: 'Partnership firm' },
  { value: 'llp', label: 'LLP' },
  { value: 'company', label: 'Company' },
  { value: 'other', label: 'Other' },
]

const STATE_OPTIONS = GST_STATES.map((s) => ({ value: s.code, label: s.name }))

// Mirrors the checks in public.save_my_tax_profile (migration 0038).
function schemaFor(role: 'creator' | 'brand') {
  return z
    .object({
      entity_type: z.string(),
      legal_name: z.string().trim().min(2, 'Enter the name exactly as it appears on your PAN or GST registration.').max(200),
      pan: z.string().trim().refine((v) => v === '' || isValidPan(v), 'A PAN is 10 characters, like ABCDE1234F.'),
      gst_registered: z.boolean(),
      gstin: z.string().trim(),
      state_code: z.string().min(2, 'Choose your state.'),
      address: z.string().trim().max(500, 'Keep the address under 500 characters.'),
      city: z.string().trim().max(100),
      pincode: z.string().trim().refine((v) => v === '' || /^[1-9][0-9]{5}$/.test(v), 'A PIN code is 6 digits.'),
      invoice_consent: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const needsGstin = role === 'creator' && v.gst_registered
      if (needsGstin && !v.gstin) ctx.addIssue({ code: 'custom', path: ['gstin'], message: 'Enter your GSTIN, or switch off “GST registered”.' })
      if (v.gstin && (needsGstin || role === 'brand')) {
        const problem = gstinProblem(v.gstin, { stateCode: v.state_code, pan: v.pan })
        if (problem) ctx.addIssue({ code: 'custom', path: ['gstin'], message: problem })
      }
      if (role === 'creator' && !v.invoice_consent) {
        ctx.addIssue({ code: 'custom', path: ['invoice_consent'], message: 'We need this to invoice brands for your work.' })
      }
    })
}
type Values = z.infer<ReturnType<typeof schemaFor>>

/**
 * The details that go on invoices: a creator's (who they are for tax, PAN,
 * GST registration) or a brand's (who to bill, GSTIN for input credit).
 */
export function TaxProfileForm({
  role,
  profile,
  onSaved,
}: {
  role: 'creator' | 'brand'
  profile: CreatorTaxProfile | BrandBillingProfile | null
  onSaved?: () => void
}) {
  const queryClient = useQueryClient()
  const creator = role === 'creator' ? (profile as CreatorTaxProfile | null) : null
  const form = useForm<Values>({
    resolver: zodResolver(schemaFor(role)),
    defaultValues: {
      entity_type: creator?.entity_type ?? 'individual',
      legal_name: profile?.legal_name ?? '',
      pan: profile?.pan ?? '',
      gst_registered: role === 'brand' ? !!profile?.gstin : (creator?.gst_registered ?? false),
      gstin: profile?.gstin ?? '',
      state_code: profile?.state_code ?? '',
      address: profile?.address ?? '',
      city: profile?.city ?? '',
      pincode: profile?.pincode ?? '',
      invoice_consent: !!creator?.invoice_consent_at,
    },
    mode: 'onTouched',
  })
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = form
  const registered = watch('gst_registered')

  const save = useMutation({
    mutationFn: (v: Values) =>
      saveMyTaxProfile({
        legal_name: v.legal_name,
        state_code: v.state_code,
        pan: cleanId(v.pan),
        gstin: role === 'brand' || v.gst_registered ? cleanId(v.gstin) : '',
        gst_registered: role === 'creator' && v.gst_registered,
        entity_type: v.entity_type,
        address: v.address,
        city: v.city,
        pincode: v.pincode,
        invoice_consent: v.invoice_consent,
      }),
    meta: { successMessage: role === 'creator' ? 'Tax details saved' : 'Billing details saved' },
    onSuccess: (_d, v) => {
      reset(v)
      void queryClient.invalidateQueries({ queryKey: qk.billing.all })
      void queryClient.invalidateQueries({ queryKey: qk.orders.all })
      onSaved?.()
    },
  })

  return (
    <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label={role === 'creator' ? 'Legal name' : 'Billing name'}
          htmlFor="legal_name"
          required
          hint={role === 'creator' ? 'As on your PAN, or your business name if you’re registered.' : 'Your company’s registered name.'}
          error={errors.legal_name?.message}
        >
          <Input id="legal_name" autoComplete="organization" {...register('legal_name')} />
        </Field>
        {role === 'creator' && (
          <Field label="You are" htmlFor="entity_type" required>
            <Controller
              control={control}
              name="entity_type"
              render={({ field }) => <Select id="entity_type" value={field.value} onValueChange={field.onChange} options={ENTITY_TYPES} />}
            />
          </Field>
        )}
        <Field
          label="PAN"
          htmlFor="pan"
          optional={role === 'brand'}
          hint={role === 'creator' ? 'Without a PAN, income-tax TDS is deducted at 5% instead of 0.1%.' : undefined}
          error={errors.pan?.message}
        >
          <Input id="pan" autoCapitalize="characters" placeholder="ABCDE1234F" className="uppercase" {...register('pan')} />
        </Field>
        <Field label="State" htmlFor="state_code" required hint="Decides CGST + SGST or IGST." error={errors.state_code?.message}>
          <Controller
            control={control}
            name="state_code"
            render={({ field }) => (
              <Select id="state_code" value={field.value} onValueChange={field.onChange} options={STATE_OPTIONS} placeholder="Choose a state" aria-invalid={!!errors.state_code} />
            )}
          />
        </Field>
      </div>

      {role === 'creator' && (
        <Controller
          control={control}
          name="gst_registered"
          render={({ field }) => (
            <SwitchRow
              id="gst_registered"
              label="I’m registered for GST"
              description="Brands then pay 18% GST on your fee, which we pass on to you with your payout. You file and pay it yourself."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      )}
      {(role === 'brand' || registered) && (
        <Field
          label="GSTIN"
          htmlFor="gstin"
          required={role === 'creator'}
          optional={role === 'brand'}
          hint={role === 'brand' ? 'Add it to claim input tax credit on our invoices.' : undefined}
          error={errors.gstin?.message}
        >
          <Input id="gstin" autoCapitalize="characters" placeholder="07ABCDE1234F1Z5" className="uppercase" {...register('gstin')} />
        </Field>
      )}

      <Field label="Address" htmlFor="address" optional error={errors.address?.message}>
        <Textarea id="address" rows={2} autoComplete="street-address" {...register('address')} />
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="City" htmlFor="city" optional>
          <Input id="city" autoComplete="address-level2" {...register('city')} />
        </Field>
        <Field label="PIN code" htmlFor="pincode" optional error={errors.pincode?.message}>
          <Input id="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} {...register('pincode')} />
        </Field>
      </div>

      {role === 'creator' && (
        <div>
          <Controller
            control={control}
            name="invoice_consent"
            render={({ field }) => (
              <CheckboxRow
                id="invoice_consent"
                label={`I allow ${site.name} to issue invoices to brands on my behalf`}
                description="Each paid order gets an invoice from you to the brand, with these details, numbered in your own series."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          {errors.invoice_consent && <p className="mt-1.5 text-sm text-danger">{errors.invoice_consent.message}</p>}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" disabled={!isDirty || save.isPending} onClick={() => reset()}>
          Discard changes
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!isDirty && !!profile}>
          {!save.isPending && <Save />} Save details
        </Button>
      </div>
    </form>
  )
}
