import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, CircleX } from 'lucide-react'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import { respondToBrief, type BriefDetail } from '@/services/briefs.service'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { CharCount } from '@/components/brand/char-count'
import { FeatureGateDialog, useFeatureGate } from '@/components/creator-studio/feature-gate'

const NOTE_MAX = 1000

const schema = z.object({
  note: z.string().trim().max(NOTE_MAX, `Keep your note under ${NOTE_MAX.toLocaleString('en-IN')} characters.`),
})
type Values = z.infer<typeof schema>

/** Creator accepts or declines a sent brief, with an optional note. */
export function BriefResponsePanel({ brief }: { brief: Pick<BriefDetail, 'id' | 'brand'> }) {
  const qc = useQueryClient()
  const headingId = React.useId()
  const [confirmDecline, setConfirmDecline] = React.useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { note: '' } })
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form
  const brandName = brief.brand?.brand_name ?? 'The brand'
  // Accepting is where a creator commits to work, so it's the point at which
  // the campaign essentials are worth asking for. Declining never is.
  const gate = useFeatureGate('campaign')

  const respond = useMutation({
    mutationFn: ({ accept, note }: { accept: boolean; note: string }) => respondToBrief(brief.id, accept, note || undefined),
    onSuccess: (_data, { accept }) => {
      setConfirmDecline(false)
      toast.success(accept ? `Brief accepted — ${brandName} has been notified.` : `Brief declined — ${brandName} has been notified.`)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.briefs.all })
      void qc.invalidateQueries({ queryKey: qk.dashboard.creator })
    },
  })

  const accepting = respond.isPending && respond.variables?.accept === true
  const declining = respond.isPending && respond.variables?.accept === false

  return (
    <section aria-labelledby={headingId} className="rounded-card border border-brand-strong/50 bg-brand-soft/70 p-5 sm:p-6">
      <h2 id={headingId} className="font-display text-lg font-semibold tracking-tight">
        Respond to this brief
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Accept to let {brandName} know you’re in, or decline if it isn’t the right fit. You can add a note either way.
      </p>
      <form
        noValidate
        className="mt-4 space-y-4"
        onSubmit={handleSubmit((v) => gate.run(() => respond.mutate({ accept: true, note: v.note })))}
      >
        <Field
          label="Note to the brand"
          htmlFor="brief-response-note"
          optional
          error={errors.note?.message}
          labelAction={<CharCount control={control} name="note" max={NOTE_MAX} />}
        >
          <Textarea
            id="brief-response-note"
            rows={3}
            className="bg-surface"
            placeholder="e.g. Love the product — I can deliver the reel by the 20th."
            {...register('note')}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={respond.isPending}
            onClick={() => void handleSubmit(() => setConfirmDecline(true))()}
          >
            <CircleX /> Decline
          </Button>
          <Button type="submit" loading={accepting} disabled={respond.isPending || gate.query.isPending}>
            {!accepting && <Check />} Accept brief
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirmDecline}
        onOpenChange={setConfirmDecline}
        title="Decline this brief?"
        description={`${brandName} will be notified and can send the brief to another creator. You can’t undo this.`}
        confirmLabel="Decline brief"
        destructive
        loading={declining}
        onConfirm={() => void handleSubmit((v) => respond.mutate({ accept: false, note: v.note }))()}
      />
      <FeatureGateDialog gate={gate} />
    </section>
  )
}
