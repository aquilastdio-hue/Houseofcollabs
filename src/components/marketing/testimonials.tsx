import { Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { site } from '@/config/site'
import { Avatar } from '@/components/ui/avatar'
import { Accent, Reveal, SectionHeader } from './primitives'

/**
 * Illustrative stories. The people are fictional (and labelled as such on the
 * page); roles are deliberately generic and no real companies are named.
 */
const STORIES = [
  {
    quote: 'We briefed six creators for our Diwali gifting drop on a Monday and had every video approved by Friday. Not one spreadsheet was harmed.',
    name: 'Ananya R.',
    role: 'Growth lead, D2C skincare brand',
    featured: true,
  },
  {
    quote: 'Seeing the price, the delivery date and the number of revisions before paying changed how we plan campaigns. Budget approvals take minutes now.',
    name: 'Kabir M.',
    role: 'Founder, home-fragrance startup',
  },
  {
    quote: 'I used to spend evenings chasing payments. Now I deliver, the brand approves, and the money shows up in my balance.',
    name: 'Meera S.',
    role: 'UGC creator, Pune',
  },
  {
    quote: 'Our regional campaigns finally sound regional. We found Tamil and Marathi creators in one afternoon instead of one month.',
    name: 'Rohan D.',
    role: 'Brand manager, packaged-foods company',
  },
  {
    quote: 'Offering raw footage and ad usage as add-ons was the unlock. Brands pick what they need and I never have to negotiate it on a call.',
    name: 'Farhan A.',
    role: 'Tech reviewer, Hyderabad',
  },
  {
    quote: 'Brief, files and feedback sit in one thread. My team finally stopped asking which WhatsApp group the final cut was in.',
    name: 'Priya K.',
    role: 'Marketing head, D2C apparel label',
  },
]

export function TestimonialsSection() {
  return (
    <section aria-labelledby="testimonials-title" className="py-section">
      <div className="container-page">
        <SectionHeader
          align="center"
          titleId="testimonials-title"
          eyebrow="Stories from both sides"
          title={
            <>
              Less chasing, <Accent>more creating</Accent>
            </>
          }
          description={`The kinds of teams and creators ${site.name} is built for. These are illustrative stories — names and details are fictional.`}
        />
        <ul className="mt-14 columns-1 gap-4 md:columns-2 lg:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid">
          {STORIES.map((story, i) => (
            <Reveal as="li" key={story.name} delay={(i % 3) * 90}>
              <figure
                className={cn(
                  'flex flex-col gap-6 rounded-card border p-6 sm:p-7',
                  story.featured ? 'border-brand-strong/50 bg-brand-gradient text-white shadow-brand' : 'border-line bg-surface shadow-card',
                )}
              >
                <Quote aria-hidden className={cn('size-7', story.featured ? 'text-white' : 'text-brand-strong')} fill="currentColor" strokeWidth={0} />
                <blockquote className={cn('font-display leading-snug tracking-tight', story.featured ? 'text-xl sm:text-2xl' : 'text-lg')}>
                  <p>“{story.quote}”</p>
                </blockquote>
                <figcaption className="flex items-center gap-3">
                  <Avatar name={story.name} size="md" />
                  <span>
                    <span className="block text-sm font-semibold">{story.name}</span>
                    <span className={cn('block text-xs', story.featured ? 'text-white/70' : 'text-muted')}>{story.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
