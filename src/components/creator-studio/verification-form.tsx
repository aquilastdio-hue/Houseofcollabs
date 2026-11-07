import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { FileCheck2, Loader2, Lock, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toAppError } from '@/lib/errors'
import { BUCKET_RULES } from '@/lib/validation/files'
import { useAuth } from '@/contexts/auth-context'
import { requestVerification, uploadVerificationDocument } from '@/services/creators.service'
import { VERIFICATION_TERMS_VERSION } from '@/pages/public/legal/verification-terms'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { VerificationTermsDialog } from './verification-terms-dialog'

const noSpaces = (v: string) => v.replace(/\s/g, '')

/** Mirrors the checks in `public.submit_creator_verification` (migration 0047). */
const schema = z
  .object({
    legal_name: z.string().trim().min(2, 'Enter your full name as it appears on your PAN card').max(120, 'Use 120 characters or fewer'),
    instagram_url: z
      .string()
      .trim()
      .regex(/^(https?:\/\/)?(www\.|m\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?([?#].*)?$/i, 'Paste your Instagram profile link, like https://www.instagram.com/yourname/'),
    pan: z
      .string()
      .transform((v) => noSpaces(v).toUpperCase())
      .refine((v) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), 'A PAN is 10 characters, like ABCDE1234F'),
    bank_account_number: z
      .string()
      .transform(noSpaces)
      .refine((v) => /^[0-9]{9,18}$/.test(v), 'Enter your account number: 9 to 18 digits'),
    confirm_account_number: z.string().transform(noSpaces),
    ifsc: z
      .string()
      .transform((v) => noSpaces(v).toUpperCase())
      .refine((v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), 'An IFSC is 11 characters, like SBIN0001234'),
    branch_address: z.string().trim().min(5, 'Enter your bank branch address').max(300, 'Use 300 characters or fewer'),
    upi_id: z
      .string()
      .transform((v) => v.trim().toLowerCase())
      .refine((v) => /^[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,63}$/.test(v), 'A UPI ID looks like yourname@okicici'),
  })
  .refine((v) => v.confirm_account_number === v.bank_account_number, {
    path: ['confirm_account_number'],
    message: 'The two account numbers don’t match',
  })
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>

function DocumentUpload({
  path,
  fileName,
  error: missing,
  onUploaded,
  onClear,
}: {
  path: string | null
  fileName: string | null
  error?: string
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
          <span className="truncate">{fileName ?? 'PAN card uploaded'}</span>
        </span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Remove PAN card">
          <X />
        </Button>
      </div>
    )
  }

  const message = error ?? missing
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
        {upload.isPending ? 'Uploading…' : 'Upload PAN card'}
      </Button>
      <p className={cn('mt-1.5 text-xs', message ? 'text-danger' : 'text-muted')}>
        {message ?? 'PDF or a clear photo (JPG or PNG), up to 10 MB. Stored privately: only our team can open it.'}
      </p>
    </div>
  )
}

/** The creator's Instagram profile link, from the account on their profile, to start the form with. */
function instagramLink(accounts: { platform: string; username: string; profile_url: string | null }[] | undefined) {
  const ig = accounts?.find((a) => a.platform === 'instagram')
  if (!ig) return ''
  if (ig.profile_url && /instagram\.com\//i.test(ig.profile_url)) return ig.profile_url
  return ig.username ? `https://www.instagram.com/${ig.username.replace(/^@/, '')}/` : ''
}

/**
 * What a creator sends to get the verified badge: their name, Instagram link,
 * PAN with a copy of the card, bank account and UPI ID. All required. These
 * are records for the team, shown on the creator's admin page only; payouts
 * still go to whatever the creator sets on their Payouts page.
 */
export function VerificationForm({ onSaved, onCancel }: { onSaved?: () => void; onCancel?: () => void }) {
  const { profile, creator } = useAuth()
  const [document, setDocument] = React.useState<{ path: string; name: string } | null>(null)
  const [documentMissing, setDocumentMissing] = React.useState(false)
  // Ticked only by "I agree" at the end of the terms popup; unticking is allowed.
  const [agreed, setAgreed] = React.useState(false)
  const [termsOpen, setTermsOpen] = React.useState(false)
  const [termsMissing, setTermsMissing] = React.useState(false)

  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      legal_name: profile?.full_name ?? '',
      instagram_url: instagramLink(creator?.creator_social_accounts),
      pan: '',
      bank_account_number: '',
      confirm_account_number: '',
      ifsc: '',
      branch_address: '',
      upi_id: '',
    },
  })
  const { errors } = form.formState

  const submit = useMutation({
    mutationFn: (values: Output) =>
      requestVerification({
        legal_name: values.legal_name,
        instagram_url: values.instagram_url,
        pan: values.pan,
        pan_document_path: document!.path,
        bank_account_number: values.bank_account_number,
        ifsc: values.ifsc,
        branch_address: values.branch_address,
        upi_id: values.upi_id,
        terms_version: VERIFICATION_TERMS_VERSION,
      }),
    meta: { successMessage: 'Verification submitted' },
    onSuccess: () => onSaved?.(),
  })

  const onSubmit = form.handleSubmit(
    (values) => {
      setDocumentMissing(!document)
      setTermsMissing(!agreed)
      if (document && agreed) submit.mutate(values)
    },
    () => {
      setDocumentMissing(!document)
      setTermsMissing(!agreed)
    },
  )

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <p className="flex items-start gap-2.5 rounded-card border border-line bg-subtle p-3 text-sm text-ink-soft">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <span>
          Your PAN, bank account and UPI ID are kept privately. Only our team can see them, every view is recorded, and they’re never shown on your
          storefront. Payouts still go to the account on your Payouts page.
        </span>
      </p>

      <Field label="Full name" htmlFor="legal_name" required error={errors.legal_name?.message} hint="Exactly as it appears on your PAN card.">
        <Input id="legal_name" autoComplete="name" maxLength={120} {...form.register('legal_name')} />
      </Field>

      <Field label="Instagram profile link" htmlFor="instagram_url" required error={errors.instagram_url?.message}>
        <Input id="instagram_url" type="url" inputMode="url" autoComplete="url" placeholder="https://www.instagram.com/yourname/" {...form.register('instagram_url')} />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="PAN number" htmlFor="pan" required error={errors.pan?.message}>
          <Input id="pan" autoComplete="off" autoCapitalize="characters" maxLength={12} placeholder="ABCDE1234F" className="uppercase" {...form.register('pan')} />
        </Field>
        <Field label="PAN card" required>
          <DocumentUpload
            path={document?.path ?? null}
            fileName={document?.name ?? null}
            error={documentMissing && !document ? 'Upload a PDF or photo of your PAN card' : undefined}
            onUploaded={(path, name) => {
              setDocument({ path, name })
              setDocumentMissing(false)
            }}
            onClear={() => setDocument(null)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Bank account number" htmlFor="bank_account_number" required error={errors.bank_account_number?.message}>
          <Input id="bank_account_number" inputMode="numeric" autoComplete="off" maxLength={22} {...form.register('bank_account_number')} />
        </Field>
        <Field label="Confirm account number" htmlFor="confirm_account_number" required error={errors.confirm_account_number?.message}>
          <Input
            id="confirm_account_number"
            inputMode="numeric"
            autoComplete="off"
            maxLength={22}
            onPaste={(e) => e.preventDefault()}
            {...form.register('confirm_account_number')}
          />
        </Field>
        <Field label="IFSC" htmlFor="ifsc" required error={errors.ifsc?.message}>
          <Input id="ifsc" autoComplete="off" autoCapitalize="characters" maxLength={11} placeholder="SBIN0001234" className="uppercase" {...form.register('ifsc')} />
        </Field>
        <Field label="UPI ID" htmlFor="upi_id" required error={errors.upi_id?.message}>
          <Input id="upi_id" autoComplete="off" autoCapitalize="none" placeholder="yourname@okicici" {...form.register('upi_id')} />
        </Field>
      </div>

      <Field label="Bank branch address" htmlFor="branch_address" required error={errors.branch_address?.message}>
        <Textarea id="branch_address" rows={2} maxLength={300} placeholder="Branch name, street, city" {...form.register('branch_address')} />
      </Field>

      <div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="verification-terms"
            className="mt-0.5"
            checked={agreed}
            aria-invalid={termsMissing && !agreed}
            aria-describedby={termsMissing && !agreed ? 'verification-terms-error' : undefined}
            onCheckedChange={(checked) => (checked === true ? setTermsOpen(true) : setAgreed(false))}
          />
          <label htmlFor="verification-terms" className="text-sm leading-6 text-ink-soft">
            I have read and agree to the{' '}
            <button type="button" className="font-medium text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink" onClick={() => setTermsOpen(true)}>
              Creator Verification Terms
            </button>
            , including how my PAN, bank and UPI details are used.
          </label>
        </div>
        {termsMissing && !agreed && (
          <p id="verification-terms-error" className="mt-1.5 pl-8 text-xs text-danger">
            Read and agree to the Creator Verification Terms
          </p>
        )}
      </div>

      <VerificationTermsDialog
        open={termsOpen}
        onOpenChange={setTermsOpen}
        onAgree={() => {
          setAgreed(true)
          setTermsMissing(false)
        }}
      />

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
