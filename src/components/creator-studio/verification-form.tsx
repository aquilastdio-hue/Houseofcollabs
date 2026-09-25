import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { FileCheck2, Loader2, Lock, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { INDIAN_STATES } from '@/lib/constants'
import { BUCKET_RULES } from '@/lib/validation/files'
import { useAuth } from '@/contexts/auth-context'
import { requestVerification, uploadVerificationDocument } from '@/services/creators.service'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const DOCUMENT_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'pan', label: 'PAN' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_licence', label: 'Driving licence' },
  { value: 'voter_id', label: 'Voter ID' },
] as const

const STATE_OPTIONS = INDIAN_STATES.map((v) => ({ value: v, label: v }))

/** Mirrors the checks in `public.request_creator_verification`. */
const schema = z.object({
  legal_name: z.string().trim().min(2, 'Enter your full legal name').max(120, 'Use 120 characters or fewer'),
  date_of_birth: z
    .string()
    .refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Enter a valid date')
    .refine((v) => {
      if (v === '') return true
      const age = (Date.now() - Date.parse(v)) / (365.25 * 24 * 3600 * 1000)
      return age >= 13 && age <= 100
    }, 'You must be at least 13'),
  document_type: z.string(),
  document_number_last4: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[A-Za-z0-9]{4}$/.test(v), 'Enter exactly the last 4 characters'),
  address_line: z.string().trim().max(200, 'Use 200 characters or fewer'),
  city: z.string().trim().max(80, 'Use 80 characters or fewer'),
  state: z.string(),
  postal_code: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9]{6}$/.test(v), 'Enter a 6-digit PIN code'),
  note: z.string().trim().max(1000, 'Use 1000 characters or fewer'),
})
type Values = z.infer<typeof schema>

function DocumentUpload({
  path,
  fileName,
  onUploaded,
  onClear,
}: {
  path: string | null
  fileName: string | null
  onUploaded: (path: string, name: string) => void
  onClear: () => void
}) {
  const { creator } = useAuth()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState<string | null>(null)

  const upload = useMutation({
    mutationFn: (file: File) => uploadVerificationDocument(creator!.id, file),
    onSuccess: (p, file) => {
      setError(null)
      onUploaded(p, file.name)
    },
    onError: (e) => setError(toAppError(e).message),
  })

  if (path) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-subtle px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <FileCheck2 className="size-4 shrink-0 text-success" aria-hidden />
          <span className="truncate">{fileName ?? 'Document uploaded'}</span>
        </span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Remove document">
          <X />
        </Button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={BUCKET_RULES['verification-documents'].accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload.mutate(file)
        }}
      />
      <Button type="button" variant="secondary" block disabled={upload.isPending || !creator} onClick={() => inputRef.current?.click()}>
        {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
        {upload.isPending ? 'Uploading…' : 'Upload document'}
      </Button>
      <p className={cn('mt-1.5 text-xs', error ? 'text-danger' : 'text-muted')}>
        {error ?? 'JPG, PNG or PDF, up to 10 MB. Stored privately — only our review team can open it.'}
      </p>
    </div>
  )
}

/**
 * Identity check, asked for only when a creator wants the verified badge.
 *
 * Deliberately collects as little as possible: the full document number is
 * never typed or stored, just the last four characters, and the file goes to a
 * private bucket that no public URL points at.
 */
export function VerificationForm({ onSaved, onCancel }: { onSaved?: () => void; onCancel?: () => void }) {
  const { profile } = useAuth()
  const [document, setDocument] = React.useState<{ path: string; name: string } | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      legal_name: profile?.full_name ?? '',
      date_of_birth: '',
      document_type: '',
      document_number_last4: '',
      address_line: '',
      city: '',
      state: '',
      postal_code: '',
      note: '',
    },
  })
  const { errors } = form.formState

  const submit = useMutation({
    mutationFn: (values: Values) =>
      requestVerification({
        legal_name: values.legal_name,
        date_of_birth: values.date_of_birth || null,
        document_type: values.document_type || null,
        document_number_last4: values.document_number_last4 || null,
        document_path: document?.path ?? null,
        address_line: values.address_line || null,
        city: values.city || null,
        state: values.state || null,
        postal_code: values.postal_code || null,
        note: values.note || null,
      }),
    meta: { successMessage: 'Verification submitted' },
    onSuccess: () => onSaved?.(),
  })

  return (
    <form onSubmit={form.handleSubmit((v) => submit.mutate(v))} className="space-y-5" noValidate>
      <p className="flex items-start gap-2.5 rounded-card border border-line bg-subtle p-3 text-sm text-ink-soft">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <span>
          We store your name and the <span className="font-medium text-ink">last four characters</span> of your document number — never the full number. Your
          document is kept privately and is only opened by our review team.
        </span>
      </p>

      <Field label="Full legal name" htmlFor="legal_name" required error={errors.legal_name?.message} hint="Exactly as it appears on your document.">
        <Input id="legal_name" autoComplete="name" maxLength={120} {...form.register('legal_name')} />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Document type" htmlFor="document_type" optional error={errors.document_type?.message}>
          <Controller
            control={form.control}
            name="document_type"
            render={({ field }) => (
              <Select id="document_type" value={field.value} onValueChange={field.onChange} options={DOCUMENT_TYPES} placeholder="Select" />
            )}
          />
        </Field>
        <Field
          label="Last 4 characters"
          htmlFor="document_number_last4"
          optional
          hint="Only the last four — never the whole number."
          error={errors.document_number_last4?.message}
        >
          <Input id="document_number_last4" autoComplete="off" maxLength={4} placeholder="e.g. 4821" {...form.register('document_number_last4')} />
        </Field>
      </div>

      <Field label="Document" optional hint="A photo or scan helps us approve you faster.">
        <DocumentUpload
          path={document?.path ?? null}
          fileName={document?.name ?? null}
          onUploaded={(path, name) => setDocument({ path, name })}
          onClear={() => setDocument(null)}
        />
      </Field>

      <Field label="Date of birth" htmlFor="date_of_birth" optional error={errors.date_of_birth?.message}>
        <Input id="date_of_birth" type="date" autoComplete="bday" {...form.register('date_of_birth')} />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Address" htmlFor="address_line" optional error={errors.address_line?.message} className="sm:col-span-2">
          <Input id="address_line" autoComplete="street-address" maxLength={200} {...form.register('address_line')} />
        </Field>
        <Field label="City" htmlFor="v_city" optional error={errors.city?.message}>
          <Input id="v_city" autoComplete="address-level2" maxLength={80} {...form.register('city')} />
        </Field>
        <Field label="State" htmlFor="v_state" optional error={errors.state?.message}>
          <Controller
            control={form.control}
            name="state"
            render={({ field }) => (
              <Select id="v_state" value={field.value} onValueChange={field.onChange} options={STATE_OPTIONS} placeholder="Choose a state" />
            )}
          />
        </Field>
        <Field label="PIN code" htmlFor="postal_code" optional error={errors.postal_code?.message}>
          <Input id="postal_code" inputMode="numeric" maxLength={6} placeholder="e.g. 400001" {...form.register('postal_code')} />
        </Field>
      </div>

      <Field label="Anything we should know?" htmlFor="v_note" optional error={errors.note?.message}>
        <Textarea id="v_note" rows={3} maxLength={1000} placeholder="Optional — context that helps our team verify you." {...form.register('note')} />
      </Field>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submit.isPending}>
          Submit for verification
        </Button>
      </div>
    </form>
  )
}
