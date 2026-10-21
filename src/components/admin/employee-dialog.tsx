import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createEmployee, updateEmployee, type EmployeeReferralRow } from '@/services/admin.service'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SwitchRow } from '@/components/ui/switch'
import { adminKeys } from './admin-keys'
import { FormDialog, Notice } from './form-dialog'
import { useAdminMutation } from './use-admin-mutation'

const schema = z.object({
  full_name: z.string().trim().min(2, 'Use at least 2 characters').max(120, 'Keep it under 120 characters'),
  // Stored the way the sign-up form stores what creators type: upper-cased.
  referral_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,40}$/, 'Use 2–40 letters, numbers, - or _ (no spaces)'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number'),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email'),
  active: z.boolean(),
})

type Values = z.infer<typeof schema>

/**
 * Add an employee, or edit one when `employee` is given. A code that creators
 * already typed but no one owns can be passed as `code` to pre-fill a new one.
 */
export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  code,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: EmployeeReferralRow | null
  code?: string
}) {
  const editing = !!employee?.employee_id
  const initial = React.useMemo<Values>(
    () => ({
      full_name: employee?.full_name ?? '',
      referral_code: employee?.referral_code ?? code ?? '',
      phone: employee?.phone ?? '',
      email: employee?.email ?? '',
      active: employee?.active ?? true,
    }),
    [employee, code],
  )
  const form = useForm<Values>({ resolver: zodResolver(schema), values: initial })
  const e = form.formState.errors
  const codeChanged = editing && form.watch('referral_code').trim().toUpperCase() !== initial.referral_code

  const save = useAdminMutation(
    (v: Values) => {
      const input = { full_name: v.full_name, referral_code: v.referral_code, phone: v.phone || null, email: v.email || null, active: v.active }
      return editing ? updateEmployee(employee!.employee_id!, input) : createEmployee(input)
    },
    {
      invalidate: [adminKeys.employees],
      success: (_d, v) => (editing ? `${v.full_name} updated` : `${v.full_name} added`),
      onSuccess: () => onOpenChange(false),
    },
  )

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset(initial)
        onOpenChange(o)
      }}
      title={editing ? 'Edit employee' : 'Add employee'}
      description="Creators who type this code on the sign-up form are counted for this employee."
      submitLabel={editing ? 'Save changes' : 'Add employee'}
      loading={save.isPending}
      submitDisabled={editing && !form.formState.isDirty}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
    >
      <Field label="Full name" htmlFor="emp-name" required error={e.full_name?.message}>
        <Input id="emp-name" maxLength={120} autoComplete="off" {...form.register('full_name')} />
      </Field>
      <Field label="Referral code" htmlFor="emp-code" required error={e.referral_code?.message} hint="What creators type in the referral code box. Not case-sensitive.">
        <Input id="emp-code" maxLength={40} autoComplete="off" className="font-mono uppercase" {...form.register('referral_code')} />
      </Field>
      {codeChanged && (
        <Notice tone="warning">
          Creators are counted by the code they typed. Changing it moves everyone who used the old code out of this employee’s count.
        </Notice>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="emp-phone" optional error={e.phone?.message}>
          <Input id="emp-phone" type="tel" autoComplete="off" {...form.register('phone')} />
        </Field>
        <Field label="Email" htmlFor="emp-email" optional error={e.email?.message}>
          <Input id="emp-email" type="email" autoComplete="off" {...form.register('email')} />
        </Field>
      </div>
      {editing && (
        <SwitchRow
          id="emp-active"
          label="Active"
          description="Inactive employees stay on the list with their counts, marked as no longer on the team."
          checked={form.watch('active')}
          onCheckedChange={(v) => form.setValue('active', v, { shouldDirty: true })}
        />
      )}
    </FormDialog>
  )
}
