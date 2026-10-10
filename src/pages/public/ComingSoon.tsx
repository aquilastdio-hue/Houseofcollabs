import { Link } from 'react-router'
import { ArrowLeft, Building2, Mail, Sparkles } from 'lucide-react'
import { site } from '@/config/site'
import { useAuth } from '@/contexts/auth-context'
import { Seo } from '@/components/shared/seo'
import { Button } from '@/components/ui/button'
import { DotGrid, Glow, stagger } from '@/components/marketing/primitives'

type Side = 'brand' | 'creator'

const COPY: Record<Side, { eyebrow: string; blurb: string; icon: typeof Building2 }> = {
  brand: {
    eyebrow: 'Collabs',
    blurb: 'The brand side is nearly ready — discovering creators, sending briefs and commissioning content, all in one place.',
    icon: Building2,
  },
  creator: {
    eyebrow: 'Creators',
    blurb: 'The creator side is nearly ready — your storefront, your rates and the brands booking you, all in one place.',
    icon: Sparkles,
  },
}

/**
 * What a signed-in visitor sees after choosing Collabs or Creators on the
 * landing page. Both routes sit behind `RequireAuth`, so reaching this means
 * they've logged in.
 *
 * The real side-specific content replaces this later — the routes and the gate
 * around them stay as they are, so nothing upstream has to change.
 */
export default function ComingSoon({ side = 'brand' }: { side?: Side }) {
  const { profile } = useAuth()
  const copy = COPY[side]
  const Icon = copy.icon
  const firstName = profile?.full_name?.trim().split(/\s+/)[0]

  return (
    <>
      <Seo title={`${side === 'brand' ? 'Collabs' : 'Creators'} — coming soon`} noindex />

      <section
        aria-labelledby="coming-soon-title"
        className="relative isolate flex min-h-[calc(100dvh-var(--header-height))] flex-col items-center justify-center overflow-hidden bg-canvas text-center"
      >
        <DotGrid className="-z-10 opacity-50" />
        <Glow tone="brand" className="-top-56 -left-48 -z-10 size-120 opacity-70" />
        <Glow tone="lilac" className="-top-44 -right-48 -z-10 size-112 opacity-60" />

        <div className="container-page flex flex-col items-center py-16">
          <span
            className="animate-fade-up flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-brand [&_svg]:size-6"
            aria-hidden
          >
            <Icon />
          </span>

          <p className="eyebrow mt-6 animate-fade-up text-brand-ink" style={stagger(1)}>
            {copy.eyebrow}
          </p>
          <h1 id="coming-soon-title" className="mt-3 animate-fade-up font-display text-display-lg font-semibold tracking-tight" style={stagger(2)}>
            Coming soon
          </h1>
          <p className="mt-4 max-w-md animate-fade-up text-base text-muted sm:text-lg" style={stagger(3)}>
            {firstName ? `Thanks for signing in, ${firstName}. ` : ''}
            {copy.blurb} We’ll email you
            {profile?.email ? <span className="font-medium text-ink"> at {profile.email}</span> : null} the moment it opens.
          </p>

          <div className="mt-9 flex w-full max-w-sm animate-fade-up flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row" style={stagger(4)}>
            <Button asChild size="lg" variant="secondary">
              <Link to="/">
                <ArrowLeft /> Back to {site.name}
              </Link>
            </Button>
            <Button asChild size="lg" variant="ink">
              <Link to="/contact">
                <Mail /> Talk to us
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
