import { Link } from 'react-router'
import { ArrowRight, BadgeIndianRupee, Clapperboard, ShieldCheck, Smartphone, Tag, Timer } from 'lucide-react'
import { site } from '@/config/site'
import { Seo } from '@/components/shared/seo'
import { Button } from '@/components/ui/button'
import { BenefitCard, type Benefit } from '@/components/marketing/benefits'
import { CtaPanel } from '@/components/marketing/cta-panel'
import { Accent, DotGrid, Eyebrow, Reveal, SectionHeader, stagger } from '@/components/marketing/primitives'
import { HeroShowcase } from '@/components/marketing/hero-showcase'
import { LiveStats } from '@/components/marketing/live-stats'
import { MarketplaceView } from '@/components/marketplace/marketplace-view'

/**
 * The UGC landing page.
 *
 * "UGC" is the single thing most brands arrive looking for, and until now the
 * header sent them to the generic marketplace hero, which explains the platform
 * rather than the format. This page explains the format and then lists the
 * creators who sell it.
 *
 * The listing is the same `MarketplaceView` the rest of the site uses, pinned
 * to the UGC content type — so search, filters, paging and the empty state are
 * the ones already built, not a second implementation that drifts.
 *
 * Note it is pinned by *content type*, not by the `ugc` category: that category
 * currently has no creators assigned, while 21 creators sell a UGC service.
 * Content type is where the people actually are.
 */

const WHY_UGC: Benefit[] = [
  {
    icon: Smartphone,
    tone: 'brand',
    title: 'Shot like a recommendation',
    body: 'Filmed on a phone, in a real room, by someone who sounds like your customer — not a studio ad that announces itself as one.',
  },
  {
    icon: Clapperboard,
    tone: 'lilac',
    title: 'Made for the feed and the page',
    body: 'Vertical video you can run as a paid ad, drop on a product page, or post from your own account.',
  },
  {
    icon: Tag,
    tone: 'sky',
    title: 'Priced before you ask',
    body: 'Every creator lists what a UGC video costs, what is included and how long it takes. No rate cards, no quotes after the brief.',
  },
  {
    icon: Timer,
    tone: 'peach',
    title: 'Days, not weeks',
    body: 'Most UGC here is delivered within a few days, with the due date on the order from the moment you place it.',
  },
  {
    icon: ShieldCheck,
    tone: 'mint',
    title: 'Paid on approval',
    body: 'Your payment is held securely and released once you have approved the work, with revisions agreed upfront.',
  },
  {
    icon: BadgeIndianRupee,
    tone: 'rose',
    title: 'Usage rights in writing',
    body: 'A UGC order comes with 30-day usage on your own channels. Longer terms or paid advertising are an add-on, recorded on the order.',
  },
]

const FIXED = { contentType: 'ugc_video' } as const
/** The hero cards show the same people the listing does, not a general sample. */
const SHOWCASE_PARAMS = { contentType: 'ugc_video', sort: 'relevance', pageSize: 6 } as const

export default function UgcPage() {
  return (
    <>
      <Seo
        title="UGC creators in India"
        description="Hire UGC creators in India on House of Collabs. Browse creators who make user-generated content for ads and product pages, with fixed prices, delivery times and usage rights stated upfront."
      />

      {/* ---------------------------------------------------------------- hero */}
      <section aria-labelledby="ugc-title" className="relative isolate overflow-hidden border-b border-line">
        <DotGrid className="-z-10 opacity-60" />
        <div className="container-page pt-8 pb-14 sm:pt-10 lg:pb-20">
          {/* Two columns, like the home and about heroes. A single narrow
              column of text left most of a desktop screen empty and made the
              page open quietly; the cards beside it are real UGC creators, so
              the space is filled by the thing the page is selling. */}
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 xl:gap-16">
            <div>
              <div className="animate-fade-up">
                <Eyebrow>User-generated content</Eyebrow>
              </div>
              <h1 id="ugc-title" className="mt-4 animate-fade-up font-display text-display-xl font-semibold" style={stagger(1)}>
                Hire <Accent>UGC creators</Accent> in India
              </h1>
              <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-ink-soft" style={stagger(2)}>
                UGC is content a creator films for your brand in their own voice and their own space — the kind of video that looks like a
                recommendation from a real person rather than an advert. You use it as your own: in paid social, on a product page, or posted
                from your account.
              </p>
              <p className="mt-4 max-w-xl animate-fade-up leading-relaxed text-muted" style={stagger(3)}>
                It is not the same as an influencer post. You are buying the footage, not their audience — so a UGC creator is chosen on how
                well they make the thing, not on follower count.
              </p>
              <div className="mt-8 flex animate-fade-up flex-col gap-3 sm:flex-row" style={stagger(4)}>
                <Button asChild size="xl">
                  <a href="#ugc-creators">
                    Browse UGC creators <ArrowRight />
                  </a>
                </Button>
                <Button asChild size="xl" variant="secondary">
                  <Link to="/get-started?role=creator">Sell UGC on {site.name}</Link>
                </Button>
              </div>
              <LiveStats className="mt-10 animate-fade-up border-t border-line pt-8" keys={['creators', 'cities', 'categories']} />
            </div>
            <HeroShowcase params={SHOWCASE_PARAMS} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- why brands buy */}
      <section aria-labelledby="ugc-why-title" className="section-blend py-section">
        <div className="container-page">
          <SectionHeader
            align="center"
            titleId="ugc-why-title"
            eyebrow="Why brands order it"
            title={
              <>
                Content that sounds like a <Accent>customer</Accent>
              </>
            }
            description="What a UGC order on House of Collabs gives you, and what is agreed before any money moves."
          />
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_UGC.map((benefit, i) => (
              <Reveal key={benefit.title} delay={i * 60} className="h-full">
                <BenefitCard benefit={benefit} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- listing */}
      <section aria-labelledby="ugc-creators-title" id="ugc-creators" className="py-section">
        <div className="container-page">
          <SectionHeader
            titleId="ugc-creators-title"
            eyebrow="Available now"
            title={
              <>
                Every creator here sells <Accent>UGC</Accent>
              </>
            }
            description="Filtered to creators offering a UGC package. Narrow it further by city, budget, delivery time or language."
          />
          <div className="mt-10">
            <MarketplaceView mode="public" fixed={FIXED} />
          </div>
        </div>
      </section>

      <CtaPanel
        id="ugc-cta"
        eyebrow="Ready when you are"
        title={
          <>
            Your next ad is a <Accent>creator away</Accent>
          </>
        }
        description="Compare UGC creators for free, or open a storefront and sell UGC to brands across India."
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
