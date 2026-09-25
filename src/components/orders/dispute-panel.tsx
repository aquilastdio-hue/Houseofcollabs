import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gavel, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { addDisputeMessage, listDisputeMessages } from '@/services/orders.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState } from '@/components/shared/states'
import type { Dispute } from '@/types'

const STATUS_LABEL: Record<Dispute['status'], string> = {
  created: 'Opened',
  under_review: 'Under review',
  waiting_for_brand: 'Waiting for brand',
  waiting_for_creator: 'Waiting for creator',
  resolved: 'Resolved',
  refunded: 'Refunded',
  rejected: 'Closed',
}

export function DisputePanel({ dispute, perspective }: { dispute: Dispute; perspective: 'brand' | 'creator' | 'admin' }) {
  const qc = useQueryClient()
  const key = ['dispute-messages', dispute.id]
  const messages = useQuery({ queryKey: key, queryFn: () => listDisputeMessages(dispute.id) })
  const [body, setBody] = React.useState('')
  const open = ['created', 'under_review', 'waiting_for_brand', 'waiting_for_creator'].includes(dispute.status)
  const send = useMutation({
    mutationFn: () => addDisputeMessage(dispute.id, body.trim()),
    onSuccess: () => {
      setBody('')
      void qc.invalidateQueries({ queryKey: key })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-control bg-danger-soft/50 p-4">
        <div className="flex gap-3">
          <Gavel className="mt-0.5 size-5 text-danger" />
          <div>
            <p className="font-medium">{dispute.reason}</p>
            {dispute.description && <p className="mt-1 text-sm whitespace-pre-wrap text-ink-soft">{dispute.description}</p>}
            <p className="mt-1 text-xs text-muted">
              Opened by the {dispute.raised_by_role} · {formatDateTime(dispute.created_at)}
            </p>
          </div>
        </div>
        <Badge tone={open ? 'warning' : 'neutral'}>{STATUS_LABEL[dispute.status]}</Badge>
      </div>
      {dispute.resolution && (
        <p className="rounded-control border border-line p-3 text-sm">
          <span className="font-medium">Resolution:</span> {dispute.resolution}
        </p>
      )}

      <div className="space-y-3" aria-live="polite">
        {messages.isPending ? (
          <Skeleton className="h-16" />
        ) : messages.isError ? (
          <ErrorState compact error={messages.error} onRetry={() => void messages.refetch()} />
        ) : messages.data.length === 0 ? (
          <p className="text-sm text-muted">No messages yet. Share evidence and context for our team here.</p>
        ) : (
          messages.data.map((m) => {
            const mine = m.sender_role === perspective
            return (
              <div key={m.id} className={cn('max-w-[85%] rounded-card px-4 py-3 text-sm', mine ? 'ml-auto bg-ink text-white' : m.sender_role === 'admin' ? 'bg-brand-soft' : 'bg-subtle')}>
                <p className={cn('mb-1 text-xs font-semibold', mine ? 'text-brand' : 'text-muted')}>
                  {m.sender_role === 'admin' ? 'House of Collabs team' : m.sender_role === 'brand' ? 'Brand' : 'Creator'}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn('mt-1 text-[0.6875rem]', mine ? 'text-white/60' : 'text-faint')}>{formatDateTime(m.created_at)}</p>
              </div>
            )
          })
        )}
      </div>

      {open && (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            if (body.trim()) send.mutate()
          }}
        >
          <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder="Add a message to the dispute…" aria-label="Dispute message" />
          <Button type="submit" loading={send.isPending} disabled={!body.trim()}>
            <Send /> Send
          </Button>
        </form>
      )}
    </div>
  )
}
