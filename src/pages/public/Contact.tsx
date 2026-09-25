import { Link } from 'react-router'
import { ArrowUpRight, Clock3, Handshake, LifeBuoy, MapPin, ScrollText, type LucideIcon } from 'lucide-react'
import { site } from '@/config/site'
import { Seo } from '@/components/shared/seo'
import { ContactForm } from '@/components/marketing/contact-form'
import { Accent, DotGrid, Eyebrow, Glow, IconChip, TextLink, stagger, type Tone } from '@/components/marketing/primitives'

const RESPONSE_TIMES = [
  { label: 'General questions', value: '1–2 business days' },
  { label: 'Order problems', value: 'Open a dispute from the order page for the fastest review' },
  { label: 'Grievances', value: 'Acknowledged within 24 hours, resolved within 15 days' },
]

const HELP_LINKS = [
  { label: 'Creator guidelines', href: '/creator-guidelines' },
  { label: 'Brand guidelines', href: '/brand-guidelines' },
  { label: 'Refund policy', href: '/refund-policy' },
  { label: 'Payout policy', href: '/payout-policy' },
  { label: 'Privacy policy', href: '/privacy' },
  { label: 'Terms of service', href: '/terms' },
]

function InfoCard({ icon, tone, title, children }: { icon: LucideIcon; tone: Tone; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <IconChip icon={icon} tone={tone} size="sm" />
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-4 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  )
}

export default function Contact() {
  return (
    <>
      <Seo
        title="Contact"
        description={`Get in touch with the ${site.name} team for brand enquiries, creator support, payments and payouts, partnerships or press.`}
      />

      <section aria-labelledby="contact-title" className="relative isolate overflow-hidden">
        <DotGrid className="-z-10 opacity-60" />
        <Glow tone="brand" className="-top-40 -right-24 -z-10 size-[30rem]" />
        <div className="container-page pt-12 pb-10 sm:pt-16 lg:pt-20">
          <Eyebrow className="animate-fade-up">Contact</Eyebrow>
          <h1 id="contact-title" className="mt-5 max-w-3xl animate-fade-up font-display text-display-xl font-semibold" style={stagger(1)}>
            Questions? <Accent>We’re listening.</Accent>
          </h1>
          <p className="mt-5 max-w-2xl animate-fade-up text-lg leading-relaxed text-muted" style={stagger(2)}>
            Planning a campaign, setting up your storefront or tracking down a payout — send us a note and the right person on our team will reply.
          </p>
        </div>
      </section>

      <div className="container-page grid grid-cols-1 gap-6 pb-section lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-8">
        <div className="animate-fade-up" style={stagger(3)}>
          <ContactForm />
        </div>

        <aside aria-label="Other ways to reach us" className="flex flex-col gap-4 animate-fade-up" style={stagger(4)}>
          <InfoCard icon={LifeBuoy} tone="brand" title="Email support">
            <p>For help with your account, orders or storefront:</p>
            <p className="mt-1.5">
              <TextLink to={`mailto:${site.supportEmail}`} className="break-all">
                {site.supportEmail}
              </TextLink>
            </p>
          </InfoCard>

          <InfoCard icon={Handshake} tone="lilac" title="Partnerships & press">
            <p>Agencies, platforms, events and media:</p>
            <p className="mt-1.5">
              <TextLink to={`mailto:${site.partnershipsEmail}`} className="break-all">
                {site.partnershipsEmail}
              </TextLink>
            </p>
          </InfoCard>

          <InfoCard icon={Clock3} tone="sky" title="Response times">
            <dl className="space-y-3">
              {RESPONSE_TIMES.map((item) => (
                <div key={item.label}>
                  <dt className="font-medium text-ink">{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </InfoCard>

          <InfoCard icon={MapPin} tone="peach" title="Office">
            <address className="not-italic">
              {site.name} Technologies
              <br />
              {site.address}
            </address>
          </InfoCard>

          <InfoCard icon={ScrollText} tone="mint" title="Policies & guidelines">
            <ul className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {HELP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="focus-ring group inline-flex items-center gap-1 rounded-sm font-medium text-ink-soft transition-colors hover:text-ink"
                  >
                    {link.label}
                    <ArrowUpRight
                      className="size-3.5 text-faint transition-[color,translate] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </InfoCard>
        </aside>
      </div>
    </>
  )
}
