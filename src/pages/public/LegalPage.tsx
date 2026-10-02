import * as React from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, CalendarDays, ChevronDown, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { site } from '@/config/site'
import { Seo } from '@/components/shared/seo'
import { Breadcrumb } from '@/components/shared/breadcrumb'
import { usePlatformTerms } from '@/components/marketing/platform-terms'
import { ANCHOR_OFFSET, DotGrid, Eyebrow } from '@/components/marketing/primitives'
import { LAST_UPDATED, LEGAL_DOCS, LEGAL_INDEX, isLegalDocKey, type LegalDocKey, type LegalSection } from './legal'

/** Readable long-form styling for policy bodies (no typography plugin needed). */
const PROSE = cn(
  'text-[0.975rem] leading-7 text-ink-soft',
  '[&_p]:mt-4 [&_p:first-child]:mt-0',
  '[&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-ink [&_h3:first-child]:mt-0',
  '[&_h3+p]:mt-2 [&_h3+ul]:mt-2',
  '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul:first-child]:mt-0',
  '[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol:first-child]:mt-0',
  '[&_li]:pl-1 [&_li::marker]:text-faint',
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_code]:rounded-md [&_code]:bg-subtle [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:text-ink',
  '[&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:decoration-ink/25 [&_a]:underline-offset-4 [&_a:hover]:decoration-ink',
)

/** Tracks which section currently sits in the reading band near the top of the viewport. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState(ids[0] ?? '')
  const key = ids.join('|')

  React.useEffect(() => {
    const elements = key
      .split('|')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') return
    const visible = new Map<string, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting)
        const current = elements.find((el) => visible.get(el.id))
        if (current) setActive(current.id)
      },
      { rootMargin: '-18% 0px -72% 0px' },
    )
    elements.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [key])

  return active
}

function TocList({ sections, active, onNavigate }: { sections: LegalSection[]; active: string; onNavigate?: () => void }) {
  return (
    <ol className="space-y-0.5 text-sm">
      {sections.map((section, i) => {
        const current = section.id === active
        return (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={onNavigate}
              aria-current={current ? 'location' : undefined}
              className={cn(
                'focus-ring flex gap-2.5 rounded-control border-l-2 py-1.5 pr-2 pl-3 leading-snug transition-colors',
                current ? 'border-ink bg-surface font-medium text-ink' : 'border-transparent text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              <span className="w-5 shrink-0 text-faint tabular-nums">{i + 1}.</span>
              <span>{section.title}</span>
            </a>
          </li>
        )
      })}
    </ol>
  )
}

export default function LegalPage({ doc }: { doc?: unknown }) {
  const docKey: LegalDocKey = isLegalDocKey(doc) ? doc : 'terms'
  const { terms } = usePlatformTerms()
  const legalDoc = LEGAL_DOCS[docKey](terms)
  const active = useActiveSection(legalDoc.sections.map((s) => s.id))
  const detailsRef = React.useRef<HTMLDetailsElement>(null)
  const related = LEGAL_INDEX.filter((item) => item.key !== docKey)
  const isGuidelines = legalDoc.kind === 'Guidelines'
  const question =
    legalDoc.kind === 'Terms' ? 'Questions about these terms?' : isGuidelines ? 'Questions about these guidelines?' : 'Questions about this policy?'

  return (
    <>
      <Seo title={legalDoc.title} description={legalDoc.summary} />

      <header className="relative isolate overflow-hidden border-b border-line">
        <DotGrid className="-z-10 opacity-50" />
        <div className="container-page pt-8 pb-12 sm:pt-10 lg:pb-16">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: isGuidelines ? 'Guidelines' : 'Legal' }, { label: legalDoc.title }]} />
          <Eyebrow className="mt-6">{isGuidelines ? `${site.name} guidelines` : `${site.name} legal`}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-display-xl font-semibold">{legalDoc.title}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{legalDoc.summary}</p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-soft">
            <CalendarDays className="size-4 text-muted" aria-hidden />
            Last updated <time dateTime="2026-10-02">{LAST_UPDATED}</time>
          </p>
        </div>
      </header>

      <div className="container-page grid grid-cols-1 gap-8 py-10 sm:py-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:py-16 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-20">
        {/* Table of contents */}
        <aside className="lg:order-1">
          <details ref={detailsRef} className="group rounded-card border border-line bg-surface lg:hidden">
            <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-card px-4 py-3.5 font-medium [&::-webkit-details-marker]:hidden">
              On this page
              <ChevronDown className="size-4 text-muted transition-transform duration-300 group-open:rotate-180" aria-hidden />
            </summary>
            <nav aria-label="On this page" className="border-t border-line p-2">
              <TocList
                sections={legalDoc.sections}
                active={active}
                onNavigate={() => {
                  if (detailsRef.current) detailsRef.current.open = false
                }}
              />
            </nav>
          </details>
          <nav aria-label="Table of contents" className="sticky top-[calc(var(--header-height)+2rem)] hidden max-h-[calc(100dvh-var(--header-height)-4rem)] overflow-y-auto pb-4 lg:block">
            <p className="eyebrow mb-3 pl-3 text-faint">On this page</p>
            <TocList sections={legalDoc.sections} active={active} />
          </nav>
        </aside>

        {/* Document */}
        <article className="min-w-0 lg:order-2">
          <div className={cn(PROSE, 'max-w-prose text-base sm:text-[1.0625rem] sm:leading-8')}>{legalDoc.intro}</div>

          <div className="mt-10 max-w-prose space-y-10">
            {legalDoc.sections.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className={cn('border-t border-line pt-10', ANCHOR_OFFSET)}
              >
                <h2 id={`${section.id}-title`} className="font-display text-2xl font-semibold tracking-tight text-ink">
                  <span className="mr-2 text-faint tabular-nums">{i + 1}.</span>
                  {section.title}
                </h2>
                <div className={cn(PROSE, 'mt-4')}>{section.body}</div>
              </section>
            ))}
          </div>

          <aside aria-label="Questions" className="mt-14 flex max-w-prose flex-col gap-4 rounded-panel bg-night p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="font-display text-xl font-semibold">{question}</p>
              <p className="mt-1 text-sm text-white/65">We reply within 1–2 business days.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`mailto:${site.supportEmail}`}
                className="focus-ring inline-flex h-10 items-center gap-2 rounded-pill bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
              >
                <Mail className="size-4" aria-hidden /> Email us
              </a>
              <Link
                to="/contact"
                className="focus-ring inline-flex h-10 items-center rounded-pill border border-white/20 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Contact form
              </Link>
            </div>
          </aside>

          <nav aria-labelledby="related-docs-title" className="mt-14">
            <h2 id="related-docs-title" className="eyebrow text-faint">
              Related documents
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {related.map((item) => (
                <li key={item.key}>
                  <Link
                    to={`/${item.key}`}
                    className="focus-ring group flex h-full flex-col gap-1 rounded-card border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-card"
                  >
                    <span className="flex items-center justify-between gap-2 font-display font-semibold">
                      {item.title}
                      <ArrowUpRight
                        className="size-4 text-faint transition-[color,translate] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
                        aria-hidden
                      />
                    </span>
                    <span className="text-sm text-muted">{item.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </div>
    </>
  )
}
