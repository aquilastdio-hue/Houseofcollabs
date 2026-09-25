import { Check, X } from 'lucide-react'
import { site } from '@/config/site'
import { Badge } from '@/components/ui/badge'
import { Accent, NightBackdrop, Reveal, SectionHeader } from './primitives'

const ROWS = [
  {
    stage: 'Finding creators',
    before: 'Scrolling hashtags, cold-DMing accounts and hoping someone replies this week.',
    after: 'Search storefronts by category, city, language, budget and delivery time.',
  },
  {
    stage: 'Pricing',
    before: 'Rate cards arrive as screenshots, and every quote comes with different terms.',
    after: 'Fixed prices, add-ons and revision counts are listed before you order.',
  },
  {
    stage: 'Briefing',
    before: 'Scope is agreed across calls, chats and a PDF forwarded three times.',
    after: 'The brief travels with the order, so both sides work from the same page.',
  },
  {
    stage: 'Tracking',
    before: 'Deadlines live in a spreadsheet that nobody remembered to update.',
    after: 'Every order has a status, a due date and a timeline of updates.',
  },
  {
    stage: 'Payment',
    before: 'Advance transfers on trust, followed by weeks of invoice reminders.',
    after: 'Pay once at checkout. The creator is paid when you approve the delivery.',
  },
]

const MESSY_NOTES = [
  { text: 'what’s your rate for 1 reel?', className: '-rotate-3' },
  { text: 'sent the brief on the other group', className: 'rotate-2' },
  { text: 'invoice_final_v3.pdf', className: '-rotate-1' },
  { text: 'any update on the video??', className: 'rotate-3' },
]

const CLEAN_FLOW = ['Ordered', 'Accepted', 'Delivered', 'Approved', 'Paid']

export function WorkflowCompareSection() {
  return (
    <section aria-labelledby="workflow-compare-title" className="border-y border-line bg-surface py-section">
      <div className="container-page">
        <SectionHeader
          align="center"
          titleId="workflow-compare-title"
          eyebrow="Before and after"
          title={
            <>
              The creator workflow, <Accent>rebuilt</Accent>
            </>
          }
          description="Most creator collaborations in India still run on DMs, screenshots and trust. Here’s what changes when the whole thing lives in one place."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Reveal className="h-full">
            <article className="flex h-full flex-col rounded-panel border border-dashed border-line-strong bg-canvas p-6 sm:p-9">
              <header>
                <Badge tone="outline" size="lg">
                  The usual way
                </Badge>
                <h3 className="mt-4 font-display text-display-sm font-semibold text-ink-soft">DMs, spreadsheets and guesswork</h3>
              </header>
              <div aria-hidden className="mt-6 flex flex-wrap gap-2">
                {MESSY_NOTES.map((note) => (
                  <span key={note.text} className={`rounded-control border border-line bg-surface px-3 py-1.5 text-xs text-muted shadow-card ${note.className}`}>
                    {note.text}
                  </span>
                ))}
              </div>
              <ul className="mt-7 space-y-4">
                {ROWS.map((row) => (
                  <li key={row.stage} className="flex gap-3.5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted-surface text-muted">
                      <X className="size-3.5" strokeWidth={2.5} aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink-soft">{row.stage}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted">{row.before}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>

          <Reveal className="h-full" delay={120}>
            <article className="relative flex h-full flex-col overflow-hidden rounded-panel bg-night p-6 text-white shadow-float sm:p-9">
              <NightBackdrop variant="soft" />
              <div className="relative">
                <header>
                  <Badge tone="brand" size="lg">
                    With {site.name}
                  </Badge>
                  <h3 className="mt-4 font-display text-display-sm font-semibold">One flow, from search to payout</h3>
                </header>
                <ol aria-hidden className="mt-6 flex flex-wrap items-center gap-1.5">
                  {CLEAN_FLOW.map((step, i) => (
                    <li key={step} className="flex items-center gap-1.5">
                      <span className="rounded-pill bg-white/10 px-3 py-1.5 text-xs font-medium text-white">{step}</span>
                      {i < CLEAN_FLOW.length - 1 && <span className="h-px w-3 bg-brand/60" />}
                    </li>
                  ))}
                </ol>
                <ul className="mt-7 space-y-4">
                  {ROWS.map((row) => (
                    <li key={row.stage} className="flex gap-3.5">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{row.stage}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-white/70">{row.after}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
