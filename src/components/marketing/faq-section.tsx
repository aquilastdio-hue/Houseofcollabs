import { Link } from 'react-router'
import { ArrowRight, MessageCircleQuestionMark } from 'lucide-react'
import { FAQ, type FaqItem } from '@/components/shared/faq'
import { Accent, SectionHeader } from './primitives'

export function FaqSection({
  items,
  eyebrow = 'Questions, answered',
  title = (
    <>
      Good questions, <Accent>straight answers</Accent>
    </>
  ),
  description,
  id = 'faq',
  className,
}: {
  items: FaqItem[]
  eyebrow?: string
  title?: React.ReactNode
  description?: React.ReactNode
  id?: string
  className?: string
}) {
  const titleId = `${id}-title`
  return (
    <section id={id} aria-labelledby={titleId} className={className ?? 'py-section'}>
      <div className="container-page grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] lg:gap-16">
        <div className="lg:sticky lg:top-[calc(var(--header-height)+3rem)] lg:self-start">
          <SectionHeader titleId={titleId} eyebrow={eyebrow} title={title} description={description} />
          <div className="mt-8 flex items-start gap-3 rounded-card border border-line bg-surface p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
              <MessageCircleQuestionMark className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium">Still unsure about something?</p>
              <p className="mt-0.5 text-sm text-muted">Our team replies within 1–2 business days.</p>
              <Link
                to="/contact"
                className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-ink"
              >
                Contact support <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
        <FAQ items={items} />
      </div>
    </section>
  )
}
