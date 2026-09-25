import { Link, useLocation } from 'react-router'
import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { Seo } from '@/components/shared/seo'
import { Button } from '@/components/ui/button'
import { Accent, DotGrid, Glow } from '@/components/marketing/primitives'

const QUICK_LINKS = [
  { label: 'Discover creators', href: '/discover' },
  { label: 'Create your profile', href: '/get-started' },
  { label: 'Contact', href: '/contact' },
]

export default function NotFound() {
  const { pathname } = useLocation()

  return (
    <>
      <Seo title="Page not found" noindex />
      <section aria-labelledby="not-found-title" className="relative isolate overflow-hidden">
        <DotGrid className="-z-10 opacity-70" />
        <Glow tone="brand" className="top-10 left-1/2 -z-10 size-[28rem] -translate-x-1/2" />
        <div className="container-page flex min-h-[calc(100dvh-var(--header-height)-6rem)] flex-col items-center justify-center py-20 text-center">
          <p aria-hidden className="relative animate-scale-in font-display text-[clamp(6rem,4rem+12vw,12rem)] leading-none font-semibold tracking-[-0.06em] text-ink">
            4
            <span className="relative mx-[0.04em] inline-flex size-[0.78em] translate-y-[0.06em] items-center justify-center rounded-full bg-ink align-baseline">
              <span className="size-[0.46em] translate-x-[0.08em] -translate-y-[0.08em] rounded-full bg-brand" />
            </span>
            4
          </p>
          <h1 id="not-found-title" className="mt-8 max-w-2xl animate-fade-up font-display text-display-lg font-semibold" style={{ animationDelay: '120ms' }}>
            <span className="sr-only">Error 404. </span>
            This page stepped <Accent>out of the spotlight</Accent>
          </h1>
          <p className="mt-4 max-w-md animate-fade-up text-lg text-muted" style={{ animationDelay: '200ms' }}>
            We couldn’t find <span className="font-medium break-all text-ink">{pathname}</span>. It may have moved, or the link might be mistyped.
          </p>
          <div className="mt-9 flex w-full animate-fade-up flex-col justify-center gap-3 sm:w-auto sm:flex-row" style={{ animationDelay: '280ms' }}>
            <Button asChild size="lg">
              <Link to="/">
                <ArrowLeft /> Back to home
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/discover">
                <Search /> Discover creators
              </Link>
            </Button>
          </div>
          <nav aria-label="Popular pages" className="mt-12 animate-fade-up" style={{ animationDelay: '360ms' }}>
            <ul className="flex flex-wrap justify-center gap-2">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="focus-ring group inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                  >
                    {link.label}
                    <ArrowRight className="size-3.5 text-faint transition-transform duration-300 ease-spring group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </>
  )
}
