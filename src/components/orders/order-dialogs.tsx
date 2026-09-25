import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link2, Plus, Trash2 } from 'lucide-react'
import { DISPUTE_REASONS, INDIAN_STATES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/dialog'
import { FileUploader, type UploadItem } from '@/components/shared/file-uploader'
import { StarInput } from '@/components/shared/star-rating'
import { uploadOrderFile, type DeliverableInput } from '@/services/orders.service'
import type { Attachment, ShippingAddressInput, ShippingDetails } from '@/types'

// ---------------------------------------------------------------------------
// Shipping address (creator)
// ---------------------------------------------------------------------------
const addressSchema = z.object({
  recipient_name: z.string().trim().min(2, 'Enter the recipient name').max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
  address: z.string().trim().min(8, 'Enter the full address').max(500),
  city: z.string().trim().min(2, 'Enter the city').max(80),
  state: z.string().trim().max(80),
  postal_code: z.string().trim().regex(/^[A-Za-z0-9 -]{3,12}$/, 'Enter a valid PIN code'),
})

export function AddressDialog({
  open,
  onOpenChange,
  initial,
  title,
  description,
  submitLabel,
  loading,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial?: Partial<ShippingDetails> | null
  title: string
  description?: string
  submitLabel: string
  loading?: boolean
  onSubmit: (address: ShippingAddressInput) => void
}) {
  const form = useForm<z.infer<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    values: {
      recipient_name: initial?.recipient_name ?? '',
      phone: initial?.phone ?? '',
      address: initial?.address ?? '',
      city: initial?.city ?? '',
      state: initial?.state ?? '',
      postal_code: initial?.postal_code ?? '',
    },
  })
  const e = form.formState.errors
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={form.handleSubmit((v) => onSubmit(v))}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => onSubmit(v))} noValidate>
        <Field label="Recipient name" htmlFor="recipient_name" required error={e.recipient_name?.message}>
          <Input id="recipient_name" autoComplete="name" {...form.register('recipient_name')} />
        </Field>
        <Field label="Phone" htmlFor="phone" required error={e.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel" {...form.register('phone')} />
        </Field>
        <Field label="Address" htmlFor="address" required className="sm:col-span-2" error={e.address?.message}>
          <Textarea id="address" rows={2} autoComplete="street-address" {...form.register('address')} />
        </Field>
        <Field label="City" htmlFor="city" required error={e.city?.message}>
          <Input id="city" autoComplete="address-level2" {...form.register('city')} />
        </Field>
        <Field label="PIN code" htmlFor="postal_code" required error={e.postal_code?.message}>
          <Input id="postal_code" inputMode="numeric" autoComplete="postal-code" {...form.register('postal_code')} />
        </Field>
        <Field label="State" htmlFor="state" className="sm:col-span-2" error={e.state?.message}>
          <Select
            id="state"
            value={form.watch('state')}
            onValueChange={(v) => form.setValue('state', v, { shouldValidate: true })}
            options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
            placeholder="Choose state"
          />
        </Field>
        <p className="text-xs text-muted sm:col-span-2">Only this brand can see your address, and only for this order.</p>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Mark shipped (brand)
// ---------------------------------------------------------------------------
const shipSchema = z.object({
  courier: z.string().trim().min(2, 'Enter the courier').max(80),
  tracking_number: z.string().trim().min(3, 'Enter the tracking number').max(80),
  tracking_url: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Start with https://'),
})

export function ShipDialog({
  open,
  onOpenChange,
  loading,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  loading?: boolean
  onSubmit: (v: z.infer<typeof shipSchema>) => void
}) {
  const form = useForm<z.infer<typeof shipSchema>>({ resolver: zodResolver(shipSchema), defaultValues: { courier: '', tracking_number: '', tracking_url: '' } })
  const e = form.formState.errors
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Mark product as shipped"
      description="Add tracking so the creator knows when to expect it."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={form.handleSubmit(onSubmit)}>
            Confirm shipment
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field label="Courier" htmlFor="courier" required error={e.courier?.message}>
          <Input id="courier" placeholder="Delhivery, Blue Dart, India Post…" {...form.register('courier')} />
        </Field>
        <Field label="Tracking number" htmlFor="tracking_number" required error={e.tracking_number?.message}>
          <Input id="tracking_number" {...form.register('tracking_number')} />
        </Field>
        <Field label="Tracking link" htmlFor="tracking_url" optional error={e.tracking_url?.message}>
          <Input id="tracking_url" type="url" placeholder="https://" {...form.register('tracking_url')} />
        </Field>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Deliver (creator): files → private bucket, links, note
// ---------------------------------------------------------------------------
export function DeliverDialog({
  open,
  onOpenChange,
  orderId,
  isRevision,
  loading,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  orderId: string
  isRevision: boolean
  loading?: boolean
  onSubmit: (items: DeliverableInput[], note: string) => void
}) {
  const [files, setFiles] = React.useState<UploadItem<Attachment>[]>([])
  const [links, setLinks] = React.useState<string[]>([''])
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [uploaderKey, setUploaderKey] = React.useState(0)

  React.useEffect(() => {
    if (!open) {
      setFiles([])
      setLinks([''])
      setNote('')
      setError(null)
      setUploaderKey((k) => k + 1)
    }
  }, [open])

  const uploading = files.some((f) => f.status === 'uploading')
  const submit = () => {
    const cleanLinks = links.map((l) => l.trim()).filter(Boolean)
    if (cleanLinks.some((l) => !/^https?:\/\/\S+$/i.test(l))) return setError('Links must start with https://')
    const items: DeliverableInput[] = [
      ...files
        .filter((f) => f.status === 'done' && f.result)
        .map((f) => ({ storage_path: f.result!.path, file_name: f.result!.name, mime_type: f.result!.mime, size_bytes: f.result!.size })),
      ...cleanLinks.map((url) => ({ external_url: url })),
    ]
    if (items.length === 0) return setError('Upload at least one file or add a link.')
    setError(null)
    onSubmit(items, note.trim())
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isRevision ? 'Submit your revision' : 'Deliver your content'}
      description="Upload final files (private to you and the brand) or share links to large files."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="accent" loading={loading} disabled={uploading} onClick={submit}>
            {isRevision ? 'Submit revision' : 'Deliver'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FileUploader<Attachment>
          key={uploaderKey}
          bucket="order-deliverables"
          maxFiles={20}
          upload={(file) => uploadOrderFile(orderId, file)}
          onUploaded={(result, file) => setFiles((prev) => [...prev, { id: result.path, file, status: 'done', result }])}
          onRemove={(item) => setFiles((prev) => prev.filter((f) => f.result?.path !== item.result?.path))}
          hint="Videos, images, PDFs or ZIPs up to 50 MB each."
        />
        <div>
          <p className="mb-2 text-sm font-medium">Links (Google Drive, WeTransfer, published post…)</p>
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  leftIcon={<Link2 />}
                  value={l}
                  type="url"
                  placeholder="https://"
                  aria-label={`Link ${i + 1}`}
                  onChange={(e) => setLinks((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {links.length > 1 && (
                  <Button variant="ghost" size="icon-sm" aria-label="Remove link" onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            {links.length < 5 && (
              <Button variant="ghost" size="sm" onClick={() => setLinks((prev) => [...prev, ''])}>
                <Plus /> Add another link
              </Button>
            )}
          </div>
        </div>
        <Field label="Note for the brand" htmlFor="deliver-note" optional>
          <Textarea id="deliver-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What’s included, captions, anything they should know." />
        </Field>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Request revision (brand)
// ---------------------------------------------------------------------------
export function RevisionDialog({
  open,
  onOpenChange,
  orderId,
  remaining,
  loading,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  orderId: string
  remaining: number
  loading?: boolean
  onSubmit: (reason: string, instructions: string, attachments: Attachment[]) => void
}) {
  const [reason, setReason] = React.useState('')
  const [instructions, setInstructions] = React.useState('')
  const [attachments, setAttachments] = React.useState<Attachment[]>([])
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!open) {
      setReason('')
      setInstructions('')
      setAttachments([])
      setError(null)
    }
  }, [open])
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Request a revision"
      description={`You have ${remaining} revision${remaining === 1 ? '' : 's'} left on this order.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            onClick={() => {
              if (reason.trim().length < 3) return setError('Tell the creator what needs to change.')
              onSubmit(reason.trim(), instructions.trim(), attachments)
            }}
          >
            Send revision request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What needs to change?" htmlFor="rev-reason" required error={error ?? undefined}>
          <Input id="rev-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lighting is too dark in the first 5 seconds" />
        </Field>
        <Field label="Detailed instructions" htmlFor="rev-instructions" optional>
          <Textarea id="rev-instructions" rows={4} maxLength={4000} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Timestamps, examples, exact lines to add or remove…" />
        </Field>
        <FileUploader<Attachment>
          bucket="order-deliverables"
          maxFiles={5}
          compact
          label="Reference files (optional)"
          upload={(file) => uploadOrderFile(orderId, file, 'revisions')}
          onUploaded={(a) => setAttachments((prev) => [...prev, a])}
          onRemove={(item) => setAttachments((prev) => prev.filter((a) => a.path !== item.result?.path))}
        />
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Dispute (either party)
// ---------------------------------------------------------------------------
export function DisputeDialog({
  open,
  onOpenChange,
  loading,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  loading?: boolean
  onSubmit: (reason: string, description: string) => void
}) {
  const [reason, setReason] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!open) {
      setReason('')
      setDescription('')
      setError(null)
    }
  }, [open])
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Open a dispute"
      description="Our team reviews the brief, messages, deliveries and revisions, then decides fairly. The order is paused meanwhile."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() => {
              if (!reason) return setError('Choose a reason.')
              if (description.trim().length < 20) return setError('Describe the problem in at least 20 characters.')
              onSubmit(reason, description.trim())
            }}
          >
            Open dispute
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reason" htmlFor="dispute-reason" required>
          <Select id="dispute-reason" value={reason} onValueChange={setReason} options={DISPUTE_REASONS.map((r) => ({ value: r, label: r }))} placeholder="Choose a reason" />
        </Field>
        <Field label="What happened?" htmlFor="dispute-description" required error={error ?? undefined}>
          <Textarea id="dispute-description" rows={5} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------
export function ReviewForm({ onSubmit, loading, subject }: { onSubmit: (rating: number, comment: string) => void; loading?: boolean; subject: string }) {
  const [rating, setRating] = React.useState(0)
  const [comment, setComment] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!rating) return setError('Choose a rating.')
        setError(null)
        onSubmit(rating, comment.trim())
      }}
    >
      <Field label={`How was working with ${subject}?`} htmlFor="review-rating" error={error ?? undefined}>
        <StarInput id="review-rating" value={rating} onChange={setRating} />
      </Field>
      <Field label="Your review" htmlFor="review-comment" optional hint="Shown publicly on the creator’s profile.">
        <Textarea id="review-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <Button type="submit" loading={loading}>
        Submit review
      </Button>
    </form>
  )
}
