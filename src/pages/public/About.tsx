import { Link } from 'react-router'
import {
  ArrowRight,
  BadgeCheck,
  BadgeIndianRupee,
  FileText,
  Images,
  MapPin,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import { site } from '@/config/site'
import { Seo } from '@/components/shared/seo'
import { Button } from '@/components/ui/button'
import { BenefitCard, type Benefit } from '@/components/marketing/benefits'
import { CtaPanel } from '@/components/marketing/cta-panel'
import { HeroShowcase } from '@/components/marketing/hero-showcase'
import { HowItWorksSection } from '@/components/marketing/how-it-works'
import { LiveStats } from '@/components/marketing/live-stats'
import { Accent, DotGrid, Eyebrow, IconChip, Reveal, SectionHeader, stagger } from '@/components/marketing/primitives'
import { WorkflowCompareSection } from '@/components/marketing/workflow-compare'

/**
 * About.
 *
 * Built from the site's own section vocabulary -- SectionHeader, BenefitCard,
 * IconChip, the blend bands -- so it reads as part of the marketing site
 * rather than a page bolted on beside it.
 *
 * Every claim below describes something the product actually does: hand review
 * before a storefront publishes, fixed prices, payment held until approval,
 * scope captured on the brief. An about page is where an invented detail is
 * most likely to be read as fact, so there is nothing here about the company
 * itself -- no founding story, no team, no numbers that aren't live.
 */

const PRINCIPLES: Benefit[] = [
  {
    icon: BadgeCheck,
    tone: 'brand',
    title: 'Every profile is read by a person',
    body: 'Applications are reviewed by hand before a storefront can go live. No automatic listings, no profiles that exist only to pad a directory.',
  },
  {
    icon: Tag,
    tone: 'lilac',
    title: 'Prices sit in the open',
    body: 'Every service shows its price, its delivery time and exactly what is included — before anyone asks for a rate card.',
  },
  {
    icon: ShieldCheck,
    tone: 'sky',
    title: 'Creators are paid for approved work',
    body: 'Payment is held securely from the moment an order is placed and released once the brand approves what was delivered.',
  },
  {
    icon: FileText,
    tone: 'peach',
    title: 'The deal is written down',
    body: 'Scope, deliverables, usage rights and deadlines live on the brief and the order — not in a chat thread nobody can find later.',
  },
  {
    icon: Images,
    tone: 'rose',
    title: 'Work comes before follower counts',
    body: 'A storefront leads with the content a creator has actually made. Reach matters, but it is one number beside the work, not the whole pitch.',
  },
  {
    icon: MapPin,
    tone: 'mint',
    title: 'Built for India',
    body: 'Rupee pricing, Indian cities and languages, UPI and bank payouts — the details that decide whether a collaboration is practical here.',
  },
]

const JOURNEY = [
  { title: 'A creator applies', body: 'Five short pages: who they are, where brands can find them, their best work, and what each deliverable costs.' },
  { title: 'We review it by hand', body: 'Someone reads the application and looks at the work before anything is published.' },
  { title: 'The storefront goes live', body: 'Approved creators get a profile with their content, services and prices, ready for brands to order from.' },
  { title: 'Brands order, creators get paid', body: 'A fixed-price order with a due date. The money is released when the work is approved.' },
]

export default function About() {
  return (
    <>
      <Seo
        title="About"
        description={`How ${site.name} works, who it is for, and what it does for brands and creators in India.`}
      />

      {/* ---------------------------------------------------------------- hero */}
      <section aria-labelledby="about-title" className="relative isolate overflow-hidden">
        {/* Dot grid only, no glow. The home hero carries a note about this:
            a tinted glow bleeds past the section edge and draws a line between
            the hero and everything under it, which is the seam the blend
            bands exist to avoid. */}
        <DotGrid className="-z-10 opacity-70" />
        {/* Same two-column composition as the home hero, and the same showcase
            beside it. A single centred column of display type filled the whole
            screen with nothing to balance it — the live creator cards are what
            make this read as a designed page rather than a headline.

            One step down in type size: the sentence here is far longer than
            home's three short clauses, and at display-2xl it ran to five lines
            in the narrower column. */}
        <div className="container-page grid grid-cols-1 items-center gap-12 pt-10 pb-16 sm:pt-14 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-10 lg:pt-16 lg:pb-24 xl:gap-16">
          <div>
            <div className="animate-fade-up">
              <Eyebrow>About us</Eyebrow>
            </div>
            <h1 id="about-title" className="mt-5 animate-fade-up font-display text-display-xl font-semibold text-ink" style={stagger(1)}>
              Connecting brands with the creators and <Accent>cultural movements</Accent> that matter.
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-muted" style={stagger(2)}>
              {site.description}
            </p>
            <div className="mt-9 flex animate-fade-up flex-col gap-3 sm:flex-row" style={stagger(3)}>
              <Button asChild size="xl">
                <Link to="/discover">
                  Browse creators <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="xl" variant="secondary">
                <Link to="/get-started?role=creator">Open a storefront</Link>
              </Button>
            </div>
            <LiveStats className="mt-10 animate-fade-up border-t border-line pt-8" keys={['creators', 'cities', 'categories']} />
          </div>
          <HeroShowcase />
        </div>
      </section>

      {/* ------------------------------------------------------------ the why */}
      <section aria-labelledby="about-why-title" className="section-blend py-section">
        <div className="container-page grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16">
          <div>
            <SectionHeader
              titleId="about-why-title"
              eyebrow="Why we built it"
              title={
                <>
                  Good work was getting lost in the <Accent>DMs</Accent>
                </>
              }
            />
            <div className="mt-6 space-y-5 text-base leading-relaxed text-ink-soft sm:text-lg">
              <p>
                Most creator collaborations in India still run on direct messages. A brand finds someone whose work they like, asks for a rate
                card, waits, negotiates in a thread, and hopes the brief survives the conversation. The creator carries the same uncertainty
                from the other side — unclear scope, moving deadlines and an invoice that gets paid whenever it gets paid.
              </p>
              <p>
                None of that is a talent problem. It is a plumbing problem. {site.name} puts the parts that keep going wrong — the price, the
                deliverables, the deadline and the payment — somewhere both sides can see them, agreed before the work starts rather than
                argued about after it.
              </p>
            </div>
          </div>

          <Reveal>
            <aside className="rounded-panel border border-line bg-surface p-7 shadow-card sm:p-8">
              <IconChip icon={BadgeIndianRupee} tone="brand" size="lg" />
              <h3 className="mt-5 font-display text-display-sm font-semibold tracking-tight">What a brand gets</h3>
              <ul className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
                {[
                  'A price and a delivery time before you commit to anything.',
                  'Storefronts that show real work, not a follower count and a hope.',
                  'One order record with the brief, the files, the status and the invoice.',
                  'Money held securely until you have approved what came back.',
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------- principles */}
      <section aria-labelledby="about-principles-title" className="py-section">
        <div className="container-page">
          <SectionHeader
            align="center"
            titleId="about-principles-title"
            eyebrow="What we stand for"
            title={
              <>
                Six things we <Accent>refuse</Accent> to leave vague
              </>
            }
            description="Every one of these is a decision built into the product, not a value on a wall."
          />
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((principle, i) => (
              <Reveal key={principle.title} delay={i * 60} className="h-full">
                <BenefitCard benefit={principle} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <HowItWorksSection />

      {/* -------------------------------------------------------- creator path */}
      <section aria-labelledby="about-journey-title" className="section-blend py-section">
        <div className="container-page">
          <SectionHeader
            align="center"
            titleId="about-journey-title"
            eyebrow="How a creator joins"
            title={
              <>
                Reviewed by a person, <Accent>every time</Accent>
              </>
            }
            description="A storefront only goes live once someone here has read the application and looked at the work."
          />
          <ol className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map((step, i) => (
              <Reveal key={step.title} as="li" delay={i * 70} className="h-full">
                <article className="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-6 shadow-card transition-[box-shadow,transform,border-color] duration-300 ease-spring hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-hover">
                  <span aria-hidden className="font-display text-display-sm font-semibold text-brand tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-display text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{step.body}</p>
                </article>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <WorkflowCompareSection />

      <CtaPanel
        id="about-cta"
        eyebrow="Ready when you are"
        title={
          <>
            Work with creators, <Accent>properly</Accent>
          </>
        }
        description="Browse creator storefronts for free, or open your own and let brands across India find you."
        actions={
          <>
            <Button asChild variant="accent" size="xl">
              <Link to="/discover">
                Find creators <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="xl">
              <Link to="/contact">Talk to us</Link>
            </Button>
          </>
        }
      />
    </>
  )
}
