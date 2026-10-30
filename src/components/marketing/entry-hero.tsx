import * as React from 'react'
import { Link } from 'react-router'
import { site } from '@/config/site'
import { Button } from '@/components/ui/button'
import { DotGrid, stagger } from './primitives'

/**
 * Pointer-following glow for the opening screen. Writes two CSS variables on
 * the section on each animation frame — no React state, so moving the mouse
 * never re-renders anything. Off on touch screens (there's no hover to
 * follow) and for anyone who asked their system for less motion.
 */
function useSpotlight(ref: React.RefObject<HTMLElement | null>) {
  const [on, setOn] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches || calm.matches) return
    let frame = 0
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect()
        el.style.setProperty('--spot-x', `${e.clientX - box.left}px`)
        el.style.setProperty('--spot-y', `${e.clientY - box.top}px`)
      })
    }
    const enter = () => setOn(true)
    const leave = () => setOn(false)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
    }
  }, [ref])
  return on
}

/**
 * The moving colour behind the wordmark: four soft clouds in the brand's
 * Instagram palette drifting on their own slow paths, an aurora turning behind
 * the logo, a pale veil that keeps the centre readable, film grain, and the
 * pointer glow. Each cloud is a radial gradient that fades to transparent by
 * itself, so nothing here needs a blur filter except the aurora — and that one
 * only rotates, which the compositor does without repainting.
 */
function AnimatedBackdrop({ spotlight }: { spotlight: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-[28vmax] -left-[22vmax] size-[70vmax] animate-drift-a rounded-full bg-[radial-gradient(circle_at_center,rgb(225_48_108/0.42),transparent_62%)]" />
      <div className="absolute -top-[30vmax] -right-[24vmax] size-[66vmax] animate-drift-b rounded-full bg-[radial-gradient(circle_at_center,rgb(131_58_180/0.36),transparent_62%)]" />
      <div className="absolute -bottom-[34vmax] left-[4vmax] size-[64vmax] animate-drift-c rounded-full bg-[radial-gradient(circle_at_center,rgb(252_175_69/0.34),transparent_60%)]" />
      <div className="absolute -right-[18vmax] -bottom-[30vmax] size-[58vmax] animate-drift-d rounded-full bg-[radial-gradient(circle_at_center,rgb(106_79_209/0.3),transparent_62%)]" />

      {/* Aurora halo, centred on the wordmark. Positioned with negative margins
          rather than a translate, because the spin animation owns `transform`. */}
      <div className="absolute top-[44%] left-1/2 -mt-[min(32vw,22rem)] -ml-[min(32vw,22rem)] size-[min(64vw,44rem)]">
        <div className="size-full animate-aurora rounded-full bg-[conic-gradient(from_0deg,var(--color-brand),var(--color-sun),var(--color-brand-strong),var(--color-brand-deep),var(--color-lilac),var(--color-brand))] opacity-30 blur-3xl" />
      </div>

      {/* Pale veil: the colour lives at the edges, the words sit on calm. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_58%_at_50%_46%,rgb(248_247_250/0.78),rgb(248_247_250/0.35)_55%,transparent_80%)]" />

      <div
        className={`absolute inset-0 bg-[radial-gradient(520px_circle_at_var(--spot-x,50%)_var(--spot-y,45%),rgb(225_48_108/0.16),transparent_65%)] transition-opacity duration-700 ${spotlight ? 'opacity-100' : 'opacity-0'}`}
      />

      <DotGrid className="opacity-30" />
      <div className="bg-grain absolute inset-0 opacity-60" />

      {/* Fade to the page colour at the bottom, so the section below starts on
          the same plain canvas instead of under a hard edge of colour. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_bottom,transparent,var(--color-canvas))]" />
    </div>
  )
}

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
 * The section reaches up behind the floating glass header (the negative top
 * margin) so the moving colour shows through it, and pads that height back so
 * the content still centres in the space below the bar.
 *
 * Deliberately identical for everyone — signed in or not — so the landing page
 * always reads as the front door rather than a workspace shortcut.
 *
 * Brands: self-serve signup at /onboarding?role=brand (instant account creation)
 * Creators: application form at /get-started?role=creator (requires admin approval)
 */
export function EntryHero() {
  const sectionRef = React.useRef<HTMLElement>(null)
  const spotlight = useSpotlight(sectionRef)

  return (
    <section
      ref={sectionRef}
      aria-labelledby="entry-title"
      className="relative isolate -mt-(--header-height) flex min-h-dvh flex-col overflow-hidden bg-canvas pt-(--header-height)"
    >
      <AnimatedBackdrop spotlight={spotlight} />

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
            drops the white out against whatever colour is moving behind it.

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

        <p className="mt-1 max-w-xl animate-fade-up text-base text-ink-soft sm:text-lg" style={stagger(1)}>
          A modern company connecting brands with the creators and{' '}
          <span className="animate-gradient-flow bg-[linear-gradient(110deg,var(--color-brand),var(--color-sun-strong),var(--color-brand-deep),var(--color-brand))] bg-clip-text font-semibold text-transparent [background-size:250%_100%]">
            cultural movements
          </span>{' '}
          that matter.
        </p>

        <div className="mt-9 flex w-full max-w-sm animate-fade-up flex-col gap-4 sm:w-auto sm:max-w-none sm:flex-row sm:items-center" style={stagger(2)}>
          {/* Brands: self-serve signup (instant account creation)
              Creators: application form (requires admin approval) */}

          {/* Brands: the gradient flows on its own, a soft glow breathes under
              it, and a light sheen crosses it every few seconds. */}
          <div className="relative isolate w-full sm:w-auto">
            <span aria-hidden className="absolute -inset-1.5 -z-10 animate-glow-breathe rounded-pill bg-brand-gradient opacity-70 blur-xl" />
            <Button
              asChild
              size="xl"
              className="w-full animate-gradient-flow overflow-hidden tracking-[0.08em] uppercase [background-size:220%_220%] sm:min-w-56"
            >
              <Link to="/onboarding?role=brand">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-sheen bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.4),transparent)]"
                />
                Brands
              </Link>
            </Button>
          </div>

          {/* Creators: ink, inside a ring of brand colour that keeps turning.
              The ring is a spinning conic gradient showing through a 1.5px gap. */}
          <div className="relative isolate w-full overflow-hidden rounded-pill p-[1.5px] shadow-card sm:w-auto">
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 -z-10 -mt-[22rem] -ml-[22rem] size-[44rem] animate-ring-spin bg-[conic-gradient(from_0deg,transparent_0deg,var(--color-brand)_60deg,var(--color-sun)_120deg,transparent_180deg,var(--color-brand-deep)_260deg,var(--color-lilac)_310deg,transparent_360deg)]"
            />
            <Button asChild size="xl" variant="ink" className="w-full tracking-[0.08em] uppercase shadow-none sm:min-w-56">
              <Link to="/get-started?role=creator">Creators</Link>
            </Button>
          </div>
        </div>

        <p className="mt-7 animate-fade-up text-sm text-ink-soft" style={stagger(3)}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-ink underline-offset-2 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </section>
  )
}
