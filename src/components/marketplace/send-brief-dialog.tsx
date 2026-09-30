import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FilePlus, FileText, Send } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { formatINR, formatRelative } from '@/lib/format'
import { range } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { listBriefs, sendBrief } from '@/services/briefs.service'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioCard, RadioGroup } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/shared/states'

const sendSchema = z.object({ briefId: z.string().min(1, 'Choose a brief to send.') })
type SendValues = z.infer<typeof sendSchema>

type CreatorRef = { id: string; display_name: string }

/** Brands send one of their draft (or previously declined) briefs to this creator. */
export function SendBriefDialog({ creator, open, onOpenChange }: { creator: CreatorRef; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { brand } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const brandId = brand?.id

  const briefs = useQuery({
    queryKey: qk.briefs.list({ scope: 'brand', ownerId: brandId, status: ['draft', 'rejected'] }),
    queryFn: async () => {
      const [drafts, declined] = await Promise.all([
        listBriefs({ scope: 'brand', ownerId: brandId!, status: 'draft', pageSize: 50 }),
        listBriefs({ scope: 'brand', ownerId: brandId!, status: 'rejected', pageSize: 50 }),
      ])
      return [...drafts.items, ...declined.items].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    },
    enabled: open && !!brandId,
  })

  const form = useForm<SendValues>({ resolver: zodResolver(sendSchema), defaultValues: { briefId: '' } })
  const { errors } = form.formState

  React.useEffect(() => {
    if (!open) form.reset({ briefId: '' })
  }, [open, form])

  const send = useMutation({
    mutationFn: (briefId: string) => sendBrief(briefId, creator.id),
    onSuccess: (brief) => {
      void qc.invalidateQueries({ queryKey: qk.briefs.all })
      toast.success(`Brief sent to ${creator.display_name}`, {
        description: 'You’ll be notified when they accept or decline.',
        action: { label: 'View brief', onClick: () => navigate(`/brand/briefs/${brief.id}`) },
      })
      onOpenChange(false)
    },
  })

  const onSubmit = form.handleSubmit((values) => send.mutate(values.briefId))
  const items = briefs.data ?? []

  let body: React.ReactNode
  if (!brandId) {
    body = <EmptyState compact icon={<FileText />} title="Finish your brand profile first" description="Briefs are sent from your brand account." />
  } else if (briefs.isPending) {
    body = (
      <div className="space-y-2" aria-busy>
        {range(3).map((i) => (
          <Skeleton key={i} className="h-18 rounded-card" />
        ))}
      </div>
    )
  } else if (briefs.isError) {
    body = <ErrorState compact error={briefs.error} onRetry={() => void briefs.refetch()} />
  } else if (items.length === 0) {
    body = (
      <EmptyState
        compact
        icon={<FilePlus />}
        title="No briefs ready to send"
        description="Write a brief with your product, deliverables and timeline — then send it from here."
        action={
          <Button asChild size="sm">
            <Link to="/brand/briefs/new">Write a brief</Link>
          </Button>
        }
      />
    )
  } else {
    body = (
      <Controller
        control={form.control}
        name="briefId"
        render={({ field }) => (
          <div>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              aria-label="Your briefs"
              aria-invalid={!!errors.briefId}
              aria-describedby={errors.briefId ? 'send-brief-error' : undefined}
            >
              {items.map((brief) => (
                <RadioCard
                  key={brief.id}
                  value={brief.id}
                  icon={<FileText />}
                  title={brief.title}
                  description={[
                    brief.status === 'rejected' ? `Declined${brief.creator ? ` by ${brief.creator.display_name}` : ''}` : 'Draft',
                    brief.budget != null ? `Budget ${formatINR(brief.budget)}` : null,
                    `Updated ${formatRelative(brief.updated_at)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
            </RadioGroup>
            {errors.briefId && (
              <p id="send-brief-error" role="alert" className="mt-2 text-xs font-medium text-danger">
                {errors.briefId.message}
              </p>
            )}
          </div>
        )}
      />
    )
  }

  const canSubmit = !!brandId && items.length > 0

  return (
    <Dialog open={open} onOpenChange={(next) => !send.isPending && onOpenChange(next)}>
      <DialogContent size="md">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Send a brief to {creator.display_name}</DialogTitle>
            <DialogDescription>Pick one of your drafts. They’ll get it in their inbox and can accept or decline.</DialogDescription>
          </DialogHeader>
          <DialogBody>{body}</DialogBody>
          <DialogFooter className={canSubmit ? 'sm:justify-between' : undefined}>
            {canSubmit && (
              <Button asChild variant="ghost">
                <Link to="/brand/briefs/new">
                  <FilePlus /> New brief
                </Link>
              </Button>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={send.isPending}>
                {canSubmit ? 'Cancel' : 'Close'}
              </Button>
              {canSubmit && (
                <Button type="submit" loading={send.isPending}>
                  {!send.isPending && <Send />} Send brief
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SendBriefButton({
  creator,
  variant = 'secondary',
  size,
  block,
  className,
}: {
  creator: CreatorRef
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  block?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant={variant} size={size} block={block} className={className} onClick={() => setOpen(true)}>
        <Send /> Send a brief
      </Button>
      <SendBriefDialog creator={creator} open={open} onOpenChange={setOpen} />
    </>
  )
}
