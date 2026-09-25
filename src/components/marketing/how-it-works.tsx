import { Link } from 'react-router'
import { ArrowRight, ClipboardList, GitCompareArrows, PackageCheck, Route, Search, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Accent, Reveal, SectionHeader } from './primitives'

export type Step = { icon: LucideIcon; title: string; body: string }

export const BRAND_STEPS: Step[] = [
  {
    icon: Search,
    title: 'Search',
    body: 'Filter creators by category, city, language, audience size, budget and delivery time.',
  },
  {
    icon: GitCompareArrows,
    title: 'Compare',
    body: 'Shortlist storefronts and weigh prices, turnaround, reviews and past work side by side.',
  },
  {
    icon: ClipboardList,
    title: 'Order & brief',
    body: 'Pick a service, add extras, attach your brief and pay securely in a single checkout.',
  },
  {
    icon: Route,
    title: 'Track',
    body: 'Follow the order from acceptance to delivery, with every update landing in your inbox.',
  },
  {
    icon: PackageCheck,
    title: 'Receive & approve',
    body: 'Review the content, request a revision if needed, then approve to release payment.',
  },
]

/** Numbered five-step rail: a connected row on desktop, cards on smaller screens. */
export function StepRail({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol
      className={cn(
        'relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0',
        'lg:before:absolute lg:before:top-7 lg:before:right-[calc(20%-1.75rem)] lg:before:left-7 lg:before:h-px lg:before:bg-line-strong',
        className,
      )}
    >
      {steps.map((step, i) => {
        const last = i === steps.length - 1
        const Icon = step.icon
        return (
          <Reveal
            as="li"
            key={step.title}
            delay={i * 90}
            className="relative rounded-card border border-line bg-surface p-5 shadow-card lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:pr-8 lg:shadow-none"
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border font-display text-lg font-semibold tabular-nums',
                  last ? 'border-ink bg-brand text-white' : 'border-line bg-surface text-ink shadow-card',
                )}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <Icon aria-hidden className="size-5 text-muted lg:hidden" />
            </div>
            <h3 className="mt-5 flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
              <Icon aria-hidden className="hidden size-5 text-muted lg:block" />
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </Reveal>
        )
      })}
    </ol>
  )
}

export function HowItWorksSection() {
  return (
    <section aria-labelledby="how-it-works-title" className="py-section">
      <div className="container-page">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
          <SectionHeader
            titleId="how-it-works-title"
            eyebrow="How it works for brands"
            title={
              <>
                From search to approved content in <Accent>five steps</Accent>
              </>
            }
          />
          <p className="max-w-md text-base leading-relaxed text-muted lg:justify-self-end">
            Order a single unboxing or a full festive campaign’s worth of reels. The steps are the same, and you stay in control of each one.
          </p>
        </div>
        <StepRail steps={BRAND_STEPS} className="mt-14" />
        <div className="mt-12 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/discover">
              Find creators <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link to="/get-started?role=brand">Create a brand account</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
