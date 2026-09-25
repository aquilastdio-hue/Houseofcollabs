import { cn } from '@/lib/utils'
import { LogoMark } from '@/components/shared/logo'
import { Eyebrow, NightBackdrop } from './primitives'

/** Dark closing call-to-action panel (sits on the canvas, above the footer). */
export function CtaPanel({
  eyebrow,
  title,
  description,
  actions,
  footnote,
  id = 'cta',
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions: React.ReactNode
  footnote?: React.ReactNode
  id?: string
  className?: string
}) {
  const titleId = `${id}-title`
  return (
    <section aria-labelledby={titleId} className={cn('py-section', className)}>
      <div className="container-page">
        <div className="relative isolate overflow-hidden rounded-hero bg-night px-6 py-16 text-center text-white shadow-float sm:px-12 sm:py-20 lg:py-24">
          <NightBackdrop />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(ellipse_at_top,var(--color-brand)_0%,transparent_60%)] opacity-15"
          />
          <LogoMark inverted className="pointer-events-none absolute -right-16 -bottom-16 size-72 opacity-[0.06] sm:size-96" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5">
            {eyebrow && <Eyebrow inverse>{eyebrow}</Eyebrow>}
            <h2 id={titleId} className="font-display text-display-xl font-semibold text-white">
              {title}
            </h2>
            {description && <p className="max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">{description}</p>}
            <div className="mt-3 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">{actions}</div>
            {footnote && <p className="text-sm text-white/50">{footnote}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
