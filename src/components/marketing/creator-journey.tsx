import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Clapperboard,
  Images,
  Inbox,
  Send,
  Sparkles,
  Tag,
  UserRoundPen,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { responseWindowText, usePlatformTerms, type PlatformTerms } from './platform-terms'
import { ANCHOR_OFFSET, Accent, NightBackdrop, Reveal, SectionHeader } from './primitives'

type JourneyStep = { icon: LucideIcon; title: string; body: string }

function buildSteps(t: PlatformTerms): JourneyStep[] {
  return [
    { icon: UserRoundPen, title: 'Create profile', body: 'Sign up free and add your photo, bio, city, categories and the languages you create in.' },
    { icon: Images, title: 'Showcase work', body: 'Upload your best videos and photos, or link to posts you’re proud of.' },
    { icon: Tag, title: 'Set pricing', body: 'Create fixed-price services with delivery times, included revisions and optional add-ons.' },
    { icon: Sparkles, title: 'Get discovered', body: 'Brands find you through search, categories and filters that match their brief.' },
    { icon: Inbox, title: 'Receive order', body: `A paid order arrives with the brief attached. Accept it within ${responseWindowText(t)}.` },
    { icon: Clapperboard, title: 'Create content', body: 'Script, shoot and edit on your own schedule, against the due date on the order.' },
    { icon: Send, title: 'Deliver', body: 'Upload the final files and handle any revisions within the rounds you agreed.' },
    { icon: Wallet, title: 'Earn', body: 'Once the brand approves, your earning lands in your balance, ready to withdraw.' },
  ]
}

/** Snake layout on desktop: row one runs left→right, row two right→left. */
const DESKTOP_CELLS = [
  'lg:col-start-1 lg:row-start-1',
  'lg:col-start-2 lg:row-start-1',
  'lg:col-start-3 lg:row-start-1',
  'lg:col-start-4 lg:row-start-1',
  'lg:col-start-4 lg:row-start-2',
  'lg:col-start-3 lg:row-start-2',
  'lg:col-start-2 lg:row-start-2',
  'lg:col-start-1 lg:row-start-2',
]

function Connector({ index }: { index: number }) {
  const base = 'absolute z-10 hidden size-6 items-center justify-center rounded-full bg-brand text-white lg:flex [&_svg]:size-3.5'
  if (index < 3) {
    return (
      <span aria-hidden className={cn(base, 'top-1/2 -right-[1.75rem] -translate-y-1/2')}>
        <ArrowRight strokeWidth={2.5} />
      </span>
    )
  }
  if (index === 3) {
    return (
      <span aria-hidden className={cn(base, '-bottom-[2.25rem] left-1/2 -translate-x-1/2')}>
        <ArrowDown strokeWidth={2.5} />
      </span>
    )
  }
  if (index < 7) {
    return (
      <span aria-hidden className={cn(base, 'top-1/2 -left-[1.75rem] -translate-y-1/2')}>
        <ArrowLeft strokeWidth={2.5} />
      </span>
    )
  }
  return null
}

export function CreatorJourneySection({ id = 'journey' }: { id?: string }) {
  const { terms } = usePlatformTerms()
  const steps = buildSteps(terms)

  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('relative overflow-hidden bg-night py-section text-white', ANCHOR_OFFSET)}>
      <NightBackdrop />
      <div className="container-page relative">
        <SectionHeader
          inverse
          titleId={`${id}-title`}
          eyebrow="The creator journey"
          title={
            <>
              From first profile to <Accent>first payout</Accent>
            </>
          }
          description="Eight steps, one place. You focus on the content — the storefront, the order and the money move along on their own."
        />

        <ol className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-12">
          {steps.map((step, i) => {
            const Icon = step.icon
            const last = i === steps.length - 1
            return (
              <Reveal as="li" key={step.title} delay={(i % 4) * 80} className={cn('relative flex gap-4 lg:block', DESKTOP_CELLS[i])}>
                {!last && <span aria-hidden className="absolute top-12 -bottom-4 left-[1.375rem] w-px bg-white/15 lg:hidden" />}
                <span
                  className={cn(
                    'relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold tabular-nums lg:hidden',
                    last ? 'bg-brand text-white' : 'border border-night-line bg-night-soft text-brand',
                  )}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <article
                  className={cn(
                    'flex h-full flex-1 flex-col rounded-card border p-5 transition-colors duration-300',
                    last ? 'border-brand/40 bg-brand text-white' : 'border-night-line bg-night-soft/80 hover:border-white/20',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-10 items-center justify-center rounded-control',
                        last ? 'bg-ink text-brand' : 'bg-white/10 text-brand',
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className={cn('hidden font-display text-sm font-semibold tabular-nums lg:block', last ? 'text-ink/60' : 'text-white/40')}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className={cn('mt-1.5 text-sm leading-relaxed', last ? 'text-ink-soft' : 'text-white/65')}>{step.body}</p>
                </article>
                <Connector index={i} />
              </Reveal>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
