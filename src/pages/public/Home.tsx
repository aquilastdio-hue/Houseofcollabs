import { Link } from 'react-router'
import { ArrowRight, BadgeIndianRupee, Clock3, ShieldCheck } from 'lucide-react'
import { site } from '@/config/site'
import { Seo } from '@/components/shared/seo'
import { Button } from '@/components/ui/button'
import { BrandMarquee } from '@/components/marketing/brand-marquee'
import { BrandBenefitsSection, CreatorBenefitsSection } from '@/components/marketing/benefits'
import { CategoryDiscoverySection } from '@/components/marketing/category-grid'
import { CtaPanel } from '@/components/marketing/cta-panel'
import { EntryHero } from '@/components/marketing/entry-hero'
import { FaqSection } from '@/components/marketing/faq-section'
import { homeFaqs } from '@/components/marketing/faqs'
import { HeroShowcase } from '@/components/marketing/hero-showcase'
import { HowItWorksSection } from '@/components/marketing/how-it-works'
import { LiveStats } from '@/components/marketing/live-stats'
import { MarketplacePreviewSection } from '@/components/marketing/marketplace-preview'
import { OrderJourneySection } from '@/components/marketing/order-journey'
import { usePlatformTerms } from '@/components/marketing/platform-terms'
import { Accent, DotGrid, Glow, TextLink, stagger } from '@/components/marketing/primitives'
import { TestimonialsSection } from '@/components/marketing/testimonials'
import { WorkflowCompareSection } from '@/components/marketing/workflow-compare'

const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'Payments secured by Razorpay' },
  { icon: BadgeIndianRupee, label: 'Fixed prices in rupees' },
  { icon: Clock3, label: 'Delivery dates upfront' },
]

export default function Home() {
  const { terms } = usePlatformTerms()

  return (
    <>
      <Seo />

      {/* 0 · Opening screen: wordmark, then the two ways in. Everything below
          is the existing marketing page, untouched. */}
      <EntryHero />

      {/* 1 · Hero */}
      <section aria-labelledby="home-hero-title" className="relative isolate overflow-hidden">
        <DotGrid className="-z-10 opacity-70" />
        <Glow tone="brand" className="-top-48 -right-40 -z-10 size-[36rem]" />
        <Glow tone="lilac" className="top-1/2 -left-56 -z-10 size-[30rem]" />
        <div className="container-page grid grid-cols-1 items-center gap-12 pt-10 pb-16 sm:pt-14 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-10 lg:pt-16 lg:pb-24 xl:gap-16">
          <div>
            <Link
              to="/get-started?role=creator"
              className="focus-ring group inline-flex animate-fade-up items-center gap-2 rounded-pill border border-line bg-surface/80 py-1 pr-3 pl-1 text-sm text-ink-soft shadow-card backdrop-blur transition-colors hover:border-line-strong"
            >
              <span className="rounded-pill bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">For creators</span>
              Open your storefront — it’s free
              <ArrowRight className="size-3.5 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <h1 id="home-hero-title" className="mt-7 animate-fade-up font-display text-display-2xl font-semibold text-ink" style={stagger(1)}>
              Hire creators. <Accent>Get content.</Accent> Skip the DMs.
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-muted sm:text-xl" style={stagger(2)}>
              {site.name} is the marketplace for creator content in India. Compare fixed-price services from UGC creators, influencers and photographers,
              order in a few clicks, and pay securely — creators are paid once you approve the work.
            </p>
            <div className="mt-9 flex animate-fade-up flex-col gap-3 sm:flex-row" style={stagger(3)}>
              <Button asChild size="xl">
                <Link to="/discover">
                  Find creators <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="xl" variant="secondary">
                <Link to="/get-started?role=creator">Get discovered as a creator</Link>
              </Button>
            </div>
            <ul className="mt-7 flex animate-fade-up flex-wrap gap-x-6 gap-y-2.5 text-sm text-muted" style={stagger(4)}>
              {TRUST_POINTS.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-2">
                  <Icon className="size-4 text-ink" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
            <LiveStats className="mt-10 animate-fade-up border-t border-line pt-8" />
          </div>
          <HeroShowcase />
        </div>
      </section>

      {/* 2 · Trusted brands */}
      <BrandMarquee />

      {/* 3 · Brand benefits */}
      <BrandBenefitsSection />

      {/* 4 · Creator benefits */}
      <CreatorBenefitsSection />

      {/* 5 · Marketplace preview */}
      <MarketplacePreviewSection />

      {/* 6 · Old vs new workflow */}
      <WorkflowCompareSection />

      {/* 7 · How it works */}
      <HowItWorksSection />

      {/* 8 · Creator discovery */}
      <CategoryDiscoverySection />

      {/* 9 · Order workflow */}
      <OrderJourneySection />

      {/* 10 · Testimonials */}
      <TestimonialsSection />

      {/* 11 · FAQ */}
      <FaqSection
        items={homeFaqs(terms)}
        description="Pricing, payments, revisions, payouts and usage rights — the things brands and creators ask us most."
        className="pb-section"
      />

      {/* 12 · Final CTA */}
      <CtaPanel
        id="home-cta"
        className="pt-0"
        eyebrow="Ready when you are"
        title={
          <>
            Your next campaign starts with a <Accent>search</Accent>
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
            <Button asChild variant="ghost-inverse" size="xl" className="border border-white/20">
              <Link to="/get-started?role=creator">Get discovered as a creator</Link>
            </Button>
          </>
        }
        footnote={
          <>
            Already on {site.name}?{' '}
            <TextLink to="/login" inverse>
              Log in
            </TextLink>
          </>
        }
      />
    </>
  )
}
