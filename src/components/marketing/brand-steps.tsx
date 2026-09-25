import { Check, ClipboardList, GitCompareArrows, PackageCheck, Route, Search, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Accent, IconChip, Reveal, SectionHeader, type Tone } from './primitives'

type DetailedStep = { icon: LucideIcon; tone: Tone; title: string; body: string; points: string[] }

const STEPS: DetailedStep[] = [
  {
    icon: Search,
    tone: 'brand',
    title: 'Search',
    body: 'Filter storefronts the way campaigns are actually planned — by category, city, language, audience size, budget and delivery time.',
    points: ['Filters that map to your brief', 'Save creators to shortlists as you browse'],
  },
  {
    icon: GitCompareArrows,
    tone: 'lilac',
    title: 'Compare',
    body: 'Put storefronts side by side and weigh starting prices, turnaround, revisions, ratings and past work. Message a creator if you want to check fit first.',
    points: ['Compare up to four creators at once', 'Chat before you commit'],
  },
  {
    icon: ClipboardList,
    tone: 'sky',
    title: 'Order',
    body: 'Choose a service, add any extras, attach your brief and pay once through Razorpay. The total is fixed the moment you check out.',
    points: ['Brief and reference files travel with the order', 'UPI, cards and net banking'],
  },
  {
    icon: Route,
    tone: 'peach',
    title: 'Track',
    body: 'Once the creator accepts, the order shows a live status and due date. If the service needs your product, ship it with a tracking number from the order page.',
    points: ['Status, due date and full history', 'Updates in your inbox and notifications'],
  },
  {
    icon: PackageCheck,
    tone: 'mint',
    title: 'Receive',
    body: 'Download the delivered files, request changes within the included revisions, and approve when you’re happy. Approval completes the order and pays the creator.',
    points: ['Revisions within the agreed rounds', 'Disputes reviewed by our team if something goes wrong'],
  },
]

export function BrandStepsSection() {
  return (
    <section aria-labelledby="brand-steps-title" className="border-y border-line bg-surface py-section">
      <div className="container-page grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:gap-20">
        <div className="lg:sticky lg:top-[calc(var(--header-height)+3rem)] lg:self-start">
          <SectionHeader
            titleId="brand-steps-title"
            eyebrow="How ordering works"
            title={
              <>
                Search, compare, order, track, <Accent>receive</Accent>
              </>
            }
            description="Five steps that replace the DMs, the spreadsheets and the advance payments. You stay in control of each one."
          />
        </div>
        <ol className="relative space-y-4 before:absolute before:top-6 before:bottom-6 before:left-[1.625rem] before:w-px before:bg-line-strong sm:before:left-[2.125rem]">
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step.title} delay={i * 70} className="relative flex gap-4 sm:gap-6">
              <span
                className={cn(
                  'relative z-10 mt-2 flex size-13 shrink-0 items-center justify-center rounded-full border font-display text-base font-semibold tabular-nums sm:size-[4.25rem] sm:text-lg',
                  i === STEPS.length - 1 ? 'border-ink bg-brand text-white' : 'border-line bg-canvas text-ink',
                )}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <article className="flex-1 rounded-card border border-line bg-canvas/60 p-5 transition-colors duration-300 hover:border-line-strong sm:p-6">
                <div className="flex items-center gap-3">
                  <IconChip icon={step.icon} tone={step.tone} size="sm" />
                  <h3 className="font-display text-xl font-semibold tracking-tight">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{step.body}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {step.points.map((point) => (
                    <li key={point} className="inline-flex items-center gap-1.5 rounded-pill bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-line">
                      <Check className="size-3.5 text-mint" strokeWidth={3} aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
