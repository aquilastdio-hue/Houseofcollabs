import { Link } from 'react-router'
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Inbox,
  Landmark,
  ReceiptIndianRupee,
  RefreshCcw,
  ShieldCheck,
  Store,
  Tag,
  UserRoundSearch,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { site } from '@/config/site'
import { Button } from '@/components/ui/button'
import { Accent, IconChip, NightBackdrop, Reveal, SectionHeader, type Tone } from './primitives'

export type Benefit = { icon: LucideIcon; title: string; body: string; tone?: Tone }

export function BenefitCard({ benefit, className }: { benefit: Benefit; className?: string }) {
  return (
    <article
      className={cn(
        'flex h-full flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card transition-[box-shadow,transform,border-color] duration-300 ease-spring hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-hover',
        className,
      )}
    >
      <IconChip icon={benefit.icon} tone={benefit.tone ?? 'brand'} />
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">{benefit.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{benefit.body}</p>
      </div>
    </article>
  )
}

const BRAND_BENEFITS: Benefit[] = [
  {
    icon: BadgeCheck,
    tone: 'brand',
    title: 'Vetted creators',
    body: 'Look past follower counts. Storefronts show past work, languages, audience size, verified badges and reviews from brands who ordered before you.',
  },
  {
    icon: Tag,
    tone: 'lilac',
    title: 'Transparent, fixed prices',
    body: 'Every service lists its price and exactly what’s included. No rate-card screenshots, no surprise quotes after the brief.',
  },
  {
    icon: Clock3,
    tone: 'sky',
    title: 'Timelines you can plan around',
    body: 'See the delivery time before you order. Each order then carries a due date and a live status you can check anytime.',
  },
  {
    icon: ShieldCheck,
    tone: 'mint',
    title: 'Payment released on approval',
    body: 'Pay securely through Razorpay at checkout. The creator’s earning is released only after you approve the delivery.',
  },
  {
    icon: RefreshCcw,
    tone: 'peach',
    title: 'Revisions included',
    body: 'Services come with a set number of revision rounds, so the feedback loop is agreed before any work begins.',
  },
  {
    icon: Inbox,
    tone: 'rose',
    title: 'Everything in one inbox',
    body: 'Briefs, files, feedback and order updates live in one thread per creator — instead of five apps and a spreadsheet.',
  },
]

const CREATOR_BENEFITS: Benefit[] = [
  {
    icon: Store,
    title: 'A storefront that sells for you',
    body: 'Your portfolio, services and reviews on one shareable page that keeps working while you create.',
  },
  {
    icon: Tag,
    title: 'Your prices, your add-ons',
    body: 'Set a fixed price for each service and offer extras like raw footage, faster delivery or ad usage rights.',
  },
  {
    icon: UserRoundSearch,
    title: 'Get discovered',
    body: 'Brands search by category, city, language, budget and turnaround — and land on your storefront.',
  },
  {
    icon: ShieldCheck,
    title: 'Payment secured upfront',
    body: 'Brands pay before you start. Once they approve your delivery, the earning is yours.',
  },
  {
    icon: Landmark,
    title: 'Payouts to UPI or bank',
    body: 'Withdraw your available balance straight to your UPI ID or bank account, with a reference for every transfer.',
  },
  {
    icon: ReceiptIndianRupee,
    title: 'No invoices to chase',
    body: 'No advance haggling, no reminder messages, no “we’ll pay next week”. The order takes care of it.',
  },
]

export function BrandBenefitsSection() {
  return (
    <section aria-labelledby="brand-benefits-title" className="py-section">
      <div className="container-page grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)] lg:gap-16">
        <div className="lg:sticky lg:top-[calc(var(--header-height)+3rem)] lg:self-start">
          <SectionHeader
            titleId="brand-benefits-title"
            eyebrow={`Why brands use ${site.name}`}
            title={
              <>
                Hire creators <Accent>without</Accent> the back-and-forth
              </>
            }
            description="Everything you need to judge a creator is on their storefront. Everything that happens after you order is tracked in one place."
            action={
              <Button asChild variant="secondary" size="lg">
                <Link to="/get-started?role=brand">
                  Start hiring creators <ArrowRight />
                </Link>
              </Button>
            }
          />
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {BRAND_BENEFITS.map((benefit, i) => (
            <Reveal as="li" key={benefit.title} delay={(i % 2) * 80}>
              <BenefitCard benefit={benefit} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function CreatorBenefitsSection() {
  return (
    <section aria-labelledby="creator-benefits-title" className="relative overflow-hidden bg-night py-section text-white">
      <NightBackdrop />
      <div className="container-page relative">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            inverse
            titleId="creator-benefits-title"
            eyebrow={`Why creators use ${site.name}`}
            title={
              <>
                Your craft. <Accent>Your storefront.</Accent> Your prices.
              </>
            }
            description={`${site.name} turns what you already make into a business brands can buy from — without cold pitches or awkward money conversations.`}
          />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="accent" size="lg">
              <Link to="/get-started?role=creator">
                Get discovered as a creator <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="ghost-inverse" size="lg">
              <Link to="/discover">See live storefronts</Link>
            </Button>
          </div>
        </div>
        <ul className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-night-line bg-night-line sm:grid-cols-2 lg:grid-cols-3">
          {CREATOR_BENEFITS.map((benefit) => (
            <li key={benefit.title} className="group bg-night p-7 transition-colors duration-300 hover:bg-night-soft sm:p-8">
              <IconChip icon={benefit.icon} tone="night" className="transition-colors duration-300 group-hover:bg-brand group-hover:text-white" />
              <h3 className="mt-6 font-display text-xl font-semibold tracking-tight">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{benefit.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
