import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import type { BriefDetail } from '@/services/briefs.service'

type Step = {
  key: string
  label: string
  state: 'done' | 'current' | 'upcoming'
  at?: string | null
  note?: string | null
  tone?: 'success' | 'danger'
}

type TimelineBrief = Pick<BriefDetail, 'status' | 'created_at' | 'sent_at' | 'responded_at' | 'response_note' | 'creator'>

export function buildBriefTimeline(brief: TimelineBrief, perspective: 'brand' | 'creator'): Step[] {
  const s = brief.status
  const name = brief.creator?.display_name ?? 'the creator'
  const mine = perspective === 'creator'
  const steps: Step[] = [{ key: 'created', label: 'Brief created', at: brief.created_at, state: 'done' }]

  if (brief.sent_at) steps.push({ key: 'sent', label: mine ? 'Sent to you' : `Sent to ${name}`, at: brief.sent_at, state: 'done' })
  else if (s === 'draft') steps.push({ key: 'sent', label: 'Send to a creator', state: 'current' })

  if (s === 'draft') steps.push({ key: 'response', label: 'Creator responds', state: 'upcoming' })
  if (s === 'sent') steps.push({ key: 'response', label: mine ? 'Waiting for your response' : `Waiting for ${name} to respond`, state: 'current' })
  if (s === 'accepted' || (s === 'completed' && brief.responded_at)) {
    steps.push({
      key: 'response',
      label: mine ? 'You accepted' : `Accepted by ${name}`,
      at: brief.responded_at,
      note: brief.response_note,
      state: 'done',
      tone: 'success',
    })
  }
  if (s === 'rejected') {
    steps.push({
      key: 'response',
      label: mine ? 'You declined' : `Declined by ${name}`,
      at: brief.responded_at,
      note: brief.response_note,
      state: 'done',
      tone: 'danger',
    })
    if (!mine) steps.push({ key: 'resend', label: 'Send to another creator', state: 'current' })
  }

  if (s === 'completed') steps.push({ key: 'completed', label: 'Collaboration completed', state: 'done', tone: 'success' })
  else if (s !== 'rejected') steps.push({ key: 'completed', label: 'Collaboration completed', state: 'upcoming' })
  return steps
}

const STATE_LABEL = { done: 'Done', current: 'Current step', upcoming: 'Upcoming' } as const

/** Vertical progress list: created → sent → response → completed. */
export function BriefTimeline({ brief, perspective }: { brief: TimelineBrief; perspective: 'brand' | 'creator' }) {
  const steps = buildBriefTimeline(brief, perspective)
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={step.state === 'current' ? 'step' : undefined}>
          {i < steps.length - 1 && <span aria-hidden className="absolute top-7 bottom-1 left-3 w-px -translate-x-1/2 bg-line" />}
          <span
            aria-hidden
            className={cn(
              'relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2',
              step.state === 'upcoming' && 'border-line bg-surface',
              step.state === 'current' && 'border-ink bg-brand',
              step.state === 'done' && (step.tone === 'danger' ? 'border-danger bg-danger text-white' : 'border-ink bg-ink text-brand'),
            )}
          >
            {step.state === 'done' && (step.tone === 'danger' ? <X className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />)}
            {step.state === 'current' && <span className="size-2 rounded-full bg-ink" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm font-medium', step.state === 'upcoming' && 'text-faint')}>
              {step.label}
              <span className="sr-only"> — {STATE_LABEL[step.state]}</span>
            </p>
            {step.at && (
              <p className="text-xs text-muted">
                <time dateTime={step.at}>{formatDateTime(step.at)}</time>
              </p>
            )}
            {step.note && (
              <blockquote className="mt-2 rounded-control bg-subtle px-3 py-2 text-sm whitespace-pre-line text-ink-soft">“{step.note}”</blockquote>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
