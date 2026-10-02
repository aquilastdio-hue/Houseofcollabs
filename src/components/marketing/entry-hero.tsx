import { Link } from 'react-router'
import { site } from '@/config/site'
import { Button } from '@/components/ui/button'
import { DotGrid, Glow, stagger } from './primitives'

/**
 * The first thing a visitor sees: the wordmark, then the two ways in. Sized to
 * fill the viewport so the marketing page below always starts past the fold,
 * with the content centred in whatever height is left over.
 *
 * The padding is symmetric on purpose: `justify-center` centres the content
 * box, so uneven pt/pb would push the block off-centre by half the difference.
 * It is kept small enough that the tallest content still fits inside one
 * viewport — otherwise the section would grow and the next one would peek.
 *
 * Deliberately identical for everyone — signed in or not — so the landing page
 * always reads as the front door rather than a workspace shortcut.
 *
 * Each button goes straight to that side's page, which sits behind
 * `RequireAuth`: a signed-out visitor is sent to /login?redirect=… and lands
 * back on their choice once they're in, while someone already signed in skips
 * the login step entirely. Both currently show a coming-soon screen.
 *
 * New members without an account start at /get-started instead, which takes an
 * application without needing one.
 */
export function EntryHero() {
  return (
    <section
      aria-labelledby="entry-title"
      className="relative isolate flex min-h-[calc(100dvh-var(--header-height))] flex-col overflow-hidden bg-canvas"
    >
      <DotGrid className="-z-10 opacity-50" />
      <Glow tone="brand" className="-top-64 -left-56 -z-10 size-[30rem] opacity-70" />
      <Glow tone="lilac" className="-top-52 -right-56 -z-10 size-[28rem] opacity-60" />

      <div className="container-page flex flex-1 flex-col items-center justify-center py-6 text-center sm:py-8">
        {/* A label, not a heading. This was an <h1>, which gave the homepage
            two of them — this one and the hero statement below it, which is
            the visible line the page should actually be ranked on.
            `aria-labelledby` is happy pointing at any element, so the section
            keeps its accessible name and the page keeps a single h1. */}
        <p id="entry-title" className="sr-only">
          {site.name} — creators, brands, culture
        </p>

        {/* The supplied artwork is black on an opaque white canvas with wide
            built-in margins. The aspect box crops the dead space; `multiply`
            drops the white out against the section background.

            The blend must sit on this wrapper, not on the <img>: `animate-fade-up`
            makes the wrapper a stacking context, which would trap a blend applied
            to a descendant and leave the white showing as a box. */}
        <div className="animate-fade-up aspect-[1536/560] w-[min(100%,36rem)] overflow-hidden mix-blend-multiply sm:w-[44rem] lg:w-[52rem]">
          <img
            src="/house-of-collabs-logo.webp"
            alt={site.name}
            width={1536}
            height={1024}
            fetchPriority="high"
            className="size-full object-cover [object-position:50%_56%]"
          />
        </div>

        <p className="mt-1 max-w-xl animate-fade-up text-base text-muted sm:text-lg" style={stagger(1)}>
          A modern company connecting brands with the creators and cultural movements that matter.
        </p>

        <div className="mt-9 flex w-full max-w-sm animate-fade-up flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:gap-4" style={stagger(2)}>
          {/* Straight into the form for that side — no account needed to apply,
              so there is nothing to sign up for first. */}
          <Button asChild size="xl" className="tracking-[0.08em] uppercase sm:min-w-56">
            <Link to="/get-started?role=brand">Brands</Link>
          </Button>
          <Button asChild size="xl" variant="ink" className="tracking-[0.08em] uppercase sm:min-w-56">
            <Link to="/get-started?role=creator">Creators</Link>
          </Button>
        </div>

        <p className="mt-7 animate-fade-up text-sm text-muted" style={stagger(3)}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-ink underline-offset-2 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </section>
  )
}
