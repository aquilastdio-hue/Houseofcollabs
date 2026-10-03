import { Link } from 'react-router'
import { ArrowRight, Boxes, Handshake, HeartHandshake, PiggyBank, Repeat, Sparkles } from 'lucide-react'
import { site } from '@/config/site'
import { Seo } from '@/components/shared/seo'
import { Button } from '@/components/ui/button'
import { BenefitCard, type Benefit } from '@/components/marketing/benefits'
import { CtaPanel } from '@/components/marketing/cta-panel'
import { HeroShowcase } from '@/components/marketing/hero-showcase'
import { Accent, DotGrid, Eyebrow, Reveal, SectionHeader, stagger } from '@/components/marketing/primitives'
import { MarketplaceView } from '@/components/marketplace/marketplace-view'

/**
 * The barter landing page.
 *
 * Page 4 of the sign-up has always asked whether a creator takes barter, but
 * the answer sat in the application and nothing could read it. Migration 0057
 * put it on the creator row and added a search filter, which is what lets this
 * page list real people rather than describe an idea.
 *
 * The listing is the same `MarketplaceView` used everywhere else, pinned to
 * that filter, so search, paging and the empty state are the ones already
 * built.
 *
 * Every creator here answered "selectively" — nobody has said they will take
 * any barter offer going. The copy says so rather than implying otherwise.
 */

const WHY_BARTER: Benefit[] = [
  {
    icon: PiggyBank,
    tone: 'brand',
    title: 'Budget goes further',
    body: 'A product you already make costs you less than its retail price. For a young brand that is the difference between one collaboration and several.',
  },
  {
    icon: HeartHandshake,
    tone: 'lilac',
    title: 'The creator actually uses it',
    body: 'Someone who accepted your product in exchange for the work has a reason to try it properly. It shows in the content.',
  },
  {
    icon: Repeat,
    tone: 'sky',
    title: 'A low-risk first collaboration',
    body: 'A sensible way to find out whether a creator suits your brand before committing a paid budget to them.',
  },
  {
    icon: Boxes,
    tone: 'peach',
    title: 'Good for launches and samples',
    body: 'New lines, seasonal drops and limited runs are easier to place as product than to price as a campaign.',
  },
  {
    icon: Handshake,
    tone: 'mint',
    title: 'Agreed in writing, like any order',
    body: 'Scope, deliverables, usage rights and the deadline are recorded on the brief — barter changes what is exchanged, not how clearly it is agreed.',
  },
  {
    icon: Sparkles,
    tone: 'rose',
    title: 'Often where a long partnership starts',
    body: 'A barter collaboration that goes well is the easiest introduction to a paid one later.',
  },
]

const FIXED = { barter: true } as const
/** The hero cards show the same people the listing does. */
const SHOWCASE_PARAMS = { barter: true, sort: 'relevance', pageSize: 6 } as const

export default function BarterPage() {
  return (
    <>
      <Seo
        title="Barter collaborations with creators in India"
        description="Browse creators on House of Collabs who accept barter collaborations — content in exchange for product rather than a fee, with scope, deliverables and usage rights agreed upfront."
      />

      {/* ---------------------------------------------------------------- hero */}
      <section aria-labelledby="barter-title" className="relative isolate overflow-hidden border-b border-line">
        <DotGrid className="-z-10 opacity-60" />
        <div className="container-page pt-8 pb-14 sm:pt-10 lg:pb-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 xl:gap-16">
            <div>
              <div className="animate-fade-up">
                <Eyebrow>Barter collaborations</Eyebrow>
              </div>
              <h1 id="barter-title" className="mt-4 animate-fade-up font-display text-display-xl font-semibold" style={stagger(1)}>
                Collaborate with <Accent>product</Accent>, not a fee
              </h1>
              <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-ink-soft" style={stagger(2)}>
                A barter collaboration swaps money for what you make: you send the creator your product, and they make content for you in return.
                Everything else works the way a paid order does — the deliverables, the deadline and the usage rights are agreed before anyone
                starts.
              </p>
              <p className="mt-4 max-w-xl animate-fade-up leading-relaxed text-muted" style={stagger(3)}>
                Every creator listed here takes barter <em>selectively</em>, so treat it as an offer to consider rather than a given. Lead with
                the product, the brief and what you would like back.
              </p>
              <div className="mt-8 flex animate-fade-up flex-col gap-3 sm:flex-row" style={stagger(4)}>
                <Button asChild size="xl">
                  <a href="#barter-creators">
                    See who accepts barter <ArrowRight />
                  </a>
                </Button>
                <Button asChild size="xl" variant="secondary">
                  <Link to="/get-started?role=creator">Offer barter as a creator</Link>
                </Button>
              </div>
            </div>
            <HeroShowcase params={SHOWCASE_PARAMS} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- why it works */}
      <section aria-labelledby="barter-why-title" className="section-blend py-section">
        <div className="container-page">
          <SectionHeader
            align="center"
            titleId="barter-why-title"
            eyebrow="Why it works"
            title={
              <>
                What a brand gets out of <Accent>barter</Accent>
              </>
            }
            description="Where swapping product for content makes more sense than paying a fee — and what stays the same either way."
          />
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_BARTER.map((benefit, i) => (
              <Reveal key={benefit.title} delay={i * 60} className="h-full">
                <BenefitCard benefit={benefit} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- listing */}
      <section aria-labelledby="barter-creators-title" id="barter-creators" className="py-section">
        <div className="container-page">
          <SectionHeader
            titleId="barter-creators-title"
            eyebrow="Open to barter"
            title={
              <>
                Creators who said <Accent>yes</Accent> to barter
              </>
            }
            description="They told us so during sign-up. Narrow the list further by city, category, audience size or delivery time."
          />
          <div className="mt-10">
            <MarketplaceView mode="public" fixed={FIXED} />
          </div>
        </div>
      </section>

      <CtaPanel
        id="barter-cta"
        eyebrow="Ready when you are"
        title={
          <>
            Send a brief, not an <Accent>invoice</Accent>
          </>
        }
        description={`Browse creators for free, or open a storefront on ${site.name} and choose which collaborations you take.`}
        actions={
          <>
            <Button asChild variant="accent" size="xl">
              <Link to="/discover">
                Browse all creators <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="xl">
              <Link to="/get-started?role=creator">Open a storefront</Link>
            </Button>
          </>
        }
      />
    </>
  )
}
