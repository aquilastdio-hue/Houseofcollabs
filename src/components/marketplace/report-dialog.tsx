import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Flag } from 'lucide-react'
import { REPORT_REASONS } from '@/lib/constants'
import { createReport } from '@/services/support.service'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'

const reportSchema = z
  .object({
    reason: z.enum(REPORT_REASONS, { error: 'Choose what’s wrong.' }),
    description: z.string().trim().max(2000, 'Keep it under 2,000 characters.'),
  })
  .superRefine((values, ctx) => {
    if (values.reason === 'Other' && values.description.length < 10) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: 'Tell us a little more (at least 10 characters).' })
    }
  })

type ReportInput = z.input<typeof reportSchema>
type ReportOutput = z.output<typeof reportSchema>

/** Report a creator profile to the trust & safety team (signed-in users). */
export function ReportDialog({
  open,
  onOpenChange,
  creatorId,
  creatorName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  creatorId: string
  creatorName: string
}) {
  const form = useForm<ReportInput, unknown, ReportOutput>({ resolver: zodResolver(reportSchema), defaultValues: { description: '' } })
  const { errors } = form.formState
  const reason = form.watch('reason')

  React.useEffect(() => {
    if (!open) form.reset({ description: '' })
  }, [open, form])

  const report = useMutation({
    mutationFn: (values: ReportOutput) => createReport('creator', creatorId, values.reason, values.description || undefined),
    onSuccess: () => {
      toast.success('Report sent', { description: 'Our trust & safety team will review it. Thanks for keeping House of Collabs safe.' })
      onOpenChange(false)
    },
  })

  const onSubmit = form.handleSubmit((values) => report.mutate(values))

  return (
    <Dialog open={open} onOpenChange={(next) => !report.isPending && onOpenChange(next)}>
      <DialogContent size="md">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Report {creatorName}</DialogTitle>
            <DialogDescription>Reports are confidential — the creator won’t see who sent them.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <Controller
              control={form.control}
              name="reason"
              render={({ field }) => (
                <fieldset>
                  <legend id="report-reason-legend" className="mb-2 text-sm font-medium">
                    What’s the problem?
                  </legend>
                  <RadioGroup
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    aria-labelledby="report-reason-legend"
                    aria-invalid={!!errors.reason}
                    aria-describedby={errors.reason ? 'report-reason-error' : undefined}
                    className="gap-1"
                  >
                    {REPORT_REASONS.map((r, i) => (
                      <label
                        key={r}
                        htmlFor={`report-reason-${i}`}
                        className="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-subtle has-data-[state=checked]:bg-subtle"
                      >
                        <RadioGroupItem id={`report-reason-${i}`} value={r} />
                        <span className="text-sm">{r}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {errors.reason && (
                    <p id="report-reason-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
                      {errors.reason.message}
                    </p>
                  )}
                </fieldset>
              )}
            />
            <Field
              label="Details"
              htmlFor="report-description"
              optional={reason !== 'Other'}
              required={reason === 'Other'}
              error={errors.description?.message}
              hint="Links, dates or anything that helps us review this quickly."
            >
              <Textarea id="report-description" rows={4} maxLength={2000} {...form.register('description')} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={report.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={report.isPending}>
              Send report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ReportButton({
  creatorId,
  creatorName,
  variant = 'ghost',
  size = 'sm',
  className,
}: {
  creatorId: string
  creatorName: string
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <Flag /> Report
      </Button>
      <ReportDialog open={open} onOpenChange={setOpen} creatorId={creatorId} creatorName={creatorName} />
    </>
  )
}
