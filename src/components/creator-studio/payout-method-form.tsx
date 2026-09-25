import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Landmark, ShieldCheck, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { savePayoutMethod } from '@/services/earnings.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Json, PayoutMethod, PayoutMethodType } from '@/types'
import { bankSchema, upiSchema, type BankInput, type UpiInput } from './schemas'

type MaskableMethod = {
  method_type?: string | null
  upi_id?: string | null
  bank_account_last4?: string | null
  ifsc_code?: string | null
  bank_name?: string | null
}

/** "name@okbank" or "•••• 1234 · HDFC0001234 · HDFC Bank" — never the full account number. */
export function maskPayoutMethod(m: MaskableMethod) {
  if (m.method_type === 'upi') return m.upi_id ?? 'UPI'
  return [`•••• ${m.bank_account_last4 ?? '····'}`, m.ifsc_code, m.bank_name].filter(Boolean).join(' · ')
}

/** Reads the method snapshot stored on a payout request. */
export function snapshotMethod(snapshot: Json): MaskableMethod & { account_holder_name?: string | null } {
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? (snapshot as MaskableMethod & { account_holder_name?: string | null }) : {}
}

export function payoutMethodLabel(type?: string | null) {
  return type === 'upi' ? 'UPI' : 'Bank transfer'
}

export function PayoutMethodSummary({ method, className }: { method: PayoutMethod; className?: string }) {
  const Icon = method.method_type === 'upi' ? Smartphone : Landmark
  return (
    <div className={cn('flex items-start gap-3 rounded-card border border-line bg-subtle/50 p-4', className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card" aria-hidden>
        <Icon className="size-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {payoutMethodLabel(method.method_type)}
          {method.verified ? (
            <Badge tone="success" size="sm">
              <ShieldCheck /> Verified
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm">
              Pending verification
            </Badge>
          )}
        </p>
        <p className="mt-0.5 truncate font-mono text-sm">{maskPayoutMethod(method)}</p>
        <p className="truncate text-xs text-muted">{method.account_holder_name}</p>
      </div>
    </div>
  )
}

function useSaveMethod(onSaved?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: savePayoutMethod,
    meta: { successMessage: 'Payout method saved' },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.payouts.method }),
        qc.invalidateQueries({ queryKey: qk.earnings.summary }),
      ])
      onSaved?.()
    },
  })
}

function FormButtons({ submitting, label, onCancel }: { submitting: boolean; label: string; onCancel?: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      {onCancel && (
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      )}
      <Button type="submit" loading={submitting}>
        {label}
      </Button>
    </div>
  )
}

function UpiForm({ method, disabled, onSaved, onCancel }: { method: PayoutMethod | null; disabled?: boolean; onSaved?: () => void; onCancel?: () => void }) {
  const save = useSaveMethod(onSaved)
  const form = useForm<UpiInput>({
    resolver: zodResolver(upiSchema),
    defaultValues: {
      account_holder_name: method?.account_holder_name ?? '',
      upi_id: method?.method_type === 'upi' ? (method.upi_id ?? '') : '',
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ method_type: 'upi', account_holder_name: values.account_holder_name, upi_id: values.upi_id })
      form.reset(values)
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <legend className="sr-only">UPI details</legend>
        <Field label="Account holder name" htmlFor="upi-holder" required hint="As registered with your bank." error={errors.account_holder_name?.message}>
          <Input id="upi-holder" autoComplete="name" maxLength={120} {...form.register('account_holder_name')} />
        </Field>
        <Field label="UPI ID" htmlFor="upi-id" required error={errors.upi_id?.message}>
          <Input id="upi-id" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="yourname@okbank" {...form.register('upi_id')} />
        </Field>
        <FormButtons submitting={isSubmitting} label="Save UPI details" onCancel={onCancel} />
      </fieldset>
    </form>
  )
}

function BankForm({ method, disabled, onSaved, onCancel }: { method: PayoutMethod | null; disabled?: boolean; onSaved?: () => void; onCancel?: () => void }) {
  const save = useSaveMethod(onSaved)
  const isBank = method?.method_type === 'bank_transfer'
  const form = useForm<BankInput>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      account_holder_name: method?.account_holder_name ?? '',
      // The full account number is write-only: it is never read back.
      bank_account_number: '',
      confirm_account_number: '',
      ifsc_code: isBank ? (method?.ifsc_code ?? '') : '',
      bank_name: isBank ? (method?.bank_name ?? '') : '',
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        method_type: 'bank_transfer',
        account_holder_name: values.account_holder_name,
        bank_account_number: values.bank_account_number,
        ifsc_code: values.ifsc_code,
        bank_name: values.bank_name,
      })
      form.reset({ ...values, bank_account_number: '', confirm_account_number: '' })
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <legend className="sr-only">Bank account details</legend>
        <Field label="Account holder name" htmlFor="bank-holder" required hint="As printed on your passbook or cheque." error={errors.account_holder_name?.message}>
          <Input id="bank-holder" autoComplete="name" maxLength={120} {...form.register('account_holder_name')} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Account number"
            htmlFor="bank-account"
            required
            hint={isBank && method?.bank_account_last4 ? `Saved account ends in ${method.bank_account_last4}. Re-enter it to make changes.` : undefined}
            error={errors.bank_account_number?.message}
          >
            <Input id="bank-account" inputMode="numeric" autoComplete="off" maxLength={24} {...form.register('bank_account_number')} />
          </Field>
          <Field label="Confirm account number" htmlFor="bank-account-confirm" required error={errors.confirm_account_number?.message}>
            <Input id="bank-account-confirm" inputMode="numeric" autoComplete="off" maxLength={24} {...form.register('confirm_account_number')} />
          </Field>
          <Field label="IFSC" htmlFor="bank-ifsc" required hint="11 characters, like HDFC0001234." error={errors.ifsc_code?.message}>
            <Input
              id="bank-ifsc"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={11}
              className="uppercase"
              {...form.register('ifsc_code', { setValueAs: (v: string) => v.toUpperCase() })}
            />
          </Field>
          <Field label="Bank name" htmlFor="bank-name" required error={errors.bank_name?.message}>
            <Input id="bank-name" autoComplete="off" maxLength={120} placeholder="e.g. HDFC Bank" {...form.register('bank_name')} />
          </Field>
        </div>
        <p className="text-xs text-muted">For your security we only ever show the last 4 digits after saving.</p>
        <FormButtons submitting={isSubmitting} label="Save bank details" onCancel={onCancel} />
      </fieldset>
    </form>
  )
}

/** UPI / bank transfer payout details, saved through `save_payout_method`. */
export function PayoutMethodForm({
  method,
  disabled,
  onSaved,
  onCancel,
  className,
}: {
  method: PayoutMethod | null
  disabled?: boolean
  onSaved?: () => void
  onCancel?: () => void
  className?: string
}) {
  const [tab, setTab] = React.useState<PayoutMethodType>(method?.method_type ?? 'upi')
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v === 'bank_transfer' ? 'bank_transfer' : 'upi')} className={className}>
      <TabsList aria-label="Payout method type">
        <TabsTrigger value="upi" disabled={disabled}>
          <Smartphone className="size-4" /> UPI
        </TabsTrigger>
        <TabsTrigger value="bank_transfer" disabled={disabled}>
          <Landmark className="size-4" /> Bank transfer
        </TabsTrigger>
      </TabsList>
      <TabsContent value="upi" className="mt-5">
        <UpiForm method={method} disabled={disabled} onSaved={onSaved} onCancel={onCancel} />
      </TabsContent>
      <TabsContent value="bank_transfer" className="mt-5">
        <BankForm method={method} disabled={disabled} onSaved={onSaved} onCancel={onCancel} />
      </TabsContent>
    </Tabs>
  )
}
