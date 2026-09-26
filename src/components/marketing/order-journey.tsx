import {
  CircleCheck,
  Clapperboard,
  Handshake,
  ReceiptIndianRupee,
  RefreshCcw,
  Send,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { site } from '@/config/site'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { autoApproveText, responseWindowText, usePlatformTerms, type PlatformTerms } from './platform-terms'
import { Accent, Reveal, SectionHeader } from './primitives'

type JourneyStep = {
  key: string
  status: string
  tone: BadgeTone
  actor: 'Brand' | 'Creator' | 'Platform'
  icon: LucideIcon
  title: string
  body: string
  optional?: boolean
}

function buildSteps(t: PlatformTerms): JourneyStep[] {
  return [
    {
      key: 'placed',
      status: 'Order placed',
      tone: 'info',
      actor: 'Brand',
      icon: ReceiptIndianRupee,
      title: 'Checkout & payment',
      body: 'You pay through Razorpay. The money is held securely — nothing reaches the creator yet.',
    },
    {
      key: 'accepted',
      status: 'Accepted',
      tone: 'info',
      actor: 'Creator',
      icon: Handshake,
      title: 'Creator accepts',
      body: `The creator reviews your brief and accepts within ${responseWindowText(t)}. If they decline or don’t respond, you’re refunded in full.`,
    },
    {
      key: 'shipped',
      status: 'Product shipped',
      tone: 'warning',
      actor: 'Brand',
      icon: Truck,
      title: 'Ship your product',
      body: 'Only for services that need your product: the creator shares an address in the order and you ship it with tracking.',
      optional: true,
    },
    {
      key: 'in_progress',
      status: 'In progress',
      tone: 'lilac',
      actor: 'Creator',
      icon: Clapperboard,
      title: 'Content gets made',
      body: 'Scripting, shooting and editing happen against the due date shown on the order.',
    },
    {
      key: 'delivered',
      status: 'Delivered',
      tone: 'brand',
      actor: 'Creator',
      icon: Send,
      title: 'Files delivered',
      body: 'Final files are uploaded to the order, ready for you to review and download.',
    },
    {
      key: 'review',
      status: 'Revision or approval',
      tone: 'warning',
      actor: 'Brand',
      icon: RefreshCcw,
      title: 'You review',
      body: `Ask for changes within the included revisions, or approve. Orders with no response are auto-approved after ${autoApproveText(t)}.`,
    },
    {
      key: 'completed',
      status: 'Completed',
      tone: 'success',
      actor: 'Platform',
      icon: CircleCheck,
      title: 'Order closes',
      body: 'The order is marked complete and you can leave a public review for the creator.',
    },
    {
      key: 'paid',
      status: 'Creator paid',
      tone: 'success',
      actor: 'Creator',
      icon: Wallet,
      title: 'Earnings released',
      body: 'The creator’s earning, after the platform fee, moves to their balance for payout to UPI or bank.',
    },
  ]
}

export function OrderJourneySection() {
  const { terms } = usePlatformTerms()
  const steps = buildSteps(terms)

  return (
    <section aria-labelledby="order-journey-title" className="py-section">
      <div className="container-page">
        <SectionHeader
          titleId="order-journey-title"
          eyebrow="The order workflow"
          title={
            <>
              Every order follows <Accent>the same clear path</Accent>
            </>
          }
          description={`Both sides always know what happens next, who acts next and where the money is. Here’s the life of a ${site.name} order.`}
        />

        <ol className="mt-14 grid grid-cols-1 gap-x-4 gap-y-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => {
            const Icon = step.icon
            const last = i === steps.length - 1
            return (
              <Reveal as="li" key={step.key} delay={(i % 4) * 80} className="flex flex-col">
                <div aria-hidden className="relative mb-4 flex h-3 items-center">
                  <span
                    className={cn(
                      'relative z-10 size-3 rounded-full',
                      step.optional ? 'border-2 border-line-strong bg-canvas' : last ? 'bg-brand ring-4 ring-brand/25' : 'bg-ink/35',
                    )}
                  />
                  {!last && (
                    <span
                      className={cn(
                        'absolute top-1/2 left-3 -right-4 max-md:hidden',
                        (i + 1) % 2 === 0 && 'md:max-lg:hidden',
                        (i + 1) % 4 === 0 && 'lg:hidden',
                        step.optional ? 'border-t border-dashed border-line-strong' : 'h-px bg-line-strong',
                      )}
                    />
                  )}
                </div>
                <article
                  className={cn(
                    // The optional step stays dashed and unfilled, so it still
                    // reads as "only sometimes" now that the contrast is lower.
                    'flex flex-1 flex-col rounded-card border p-5 transition-colors duration-300',
                    step.optional ? 'border-dashed border-line-strong bg-transparent' : 'border-line bg-surface shadow-card hover:border-line-strong',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={step.tone} size="sm" dot>
                      {step.status}
                    </Badge>
                    <span className="text-xs font-medium text-faint">
                      {step.optional ? `${step.actor} · optional` : step.actor}
                    </span>
                  </div>
                  <h3 className="mt-4 flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                    <Icon aria-hidden className="size-4.5 text-brand" />
                    <span>
                      <span className="sr-only">Step {i + 1}: </span>
                      {step.title}
                    </span>
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </article>
              </Reveal>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
