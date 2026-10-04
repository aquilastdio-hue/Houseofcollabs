import * as React from 'react'
import { Link } from 'react-router'
import { ArrowRight, BadgeCheck, CircleCheck, Hourglass, Landmark, RefreshCw, Send, Smartphone, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { site } from '@/config/site'
import { formatINR } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { feeText, holdText, minPayoutText, percentText, splitEarning, usePlatformTerms } from './platform-terms'
import { Accent, IconChip, Marker, Reveal, SectionHeader } from './primitives'

const EXAMPLE_ORDER = 2000
const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 25000]
const SLIDER = { min: 500, max: 50_000, step: 500 }

export function EarningsSection() {
  const { terms, query } = usePlatformTerms()
  const [amount, setAmount] = React.useState(EXAMPLE_ORDER)
  const fee = terms.feePercent
  const example = fee != null ? splitEarning(EXAMPLE_ORDER, fee) : null
  const split = fee != null ? splitEarning(amount, fee) : null

  return (
    <section aria-labelledby="earnings-title" className="py-section">
      <div className="container-page grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div>
          <SectionHeader
            titleId="earnings-title"
            eyebrow="Earnings"
            title={
              <>
                Know exactly <Accent>what you’ll earn</Accent>
              </>
            }
            description={`Brands pay the price you set, add-ons included. When the order completes, ${site.name} keeps its platform fee and the rest is yours — no listing fees, no subscriptions.`}
          />
          <div className="mt-8 font-display text-display-sm font-semibold tracking-tight text-ink" aria-live="polite">
            {query.isPending ? (
              <Skeleton className="h-7 w-full max-w-md" />
            ) : example ? (
              <p>
                On a {formatINR(EXAMPLE_ORDER)} order you earn <Marker>{formatINR(example.net)}</Marker> at a {feeText(terms)} fee.
              </p>
            ) : (
              <p>You keep the order total minus a small platform fee — shown in your dashboard before you accept any order.</p>
            )}
          </div>
          <ul className="mt-8 space-y-3 text-sm text-ink-soft">
            {[
              'Add-ons you sell count towards the order total',
              `Earnings become available ${holdText(terms)}`,
              'Every fee and payout is itemised on your Earnings page',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <Reveal>
          <div className="rounded-panel border border-line bg-surface p-6 shadow-float sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-display text-lg font-semibold">Earnings calculator</h3>
              <span className="rounded-pill bg-subtle px-2.5 py-1 text-xs font-medium text-muted">
                {fee != null ? `Live fee · ${percentText(fee)}` : 'Fee unavailable'}
              </span>
            </div>

            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-muted">Order value</span>
                <span className="font-display text-3xl font-semibold tracking-tight tabular-nums">{formatINR(amount)}</span>
              </div>
              <Slider
                className="mt-3"
                min={SLIDER.min}
                max={SLIDER.max}
                step={SLIDER.step}
                value={[amount]}
                onValueChange={(v) => setAmount(v[0] ?? EXAMPLE_ORDER)}
                thumbLabels={['Order value']}
              />
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Quick amounts">
                {QUICK_AMOUNTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={amount === value}
                    onClick={() => setAmount(value)}
                    className={cn(
                      'focus-ring rounded-pill px-3 py-1.5 text-xs font-medium tabular-nums transition-colors',
                      amount === value ? 'bg-ink text-white' : 'bg-subtle text-ink-soft hover:bg-muted-surface',
                    )}
                  >
                    {formatINR(value)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7 rounded-card bg-subtle p-5">
              {query.isPending ? (
                <div className="space-y-3" aria-hidden>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-8 w-1/2" />
                </div>
              ) : split && fee != null ? (
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Brand pays</dt>
                    <dd className="font-medium tabular-nums">{formatINR(amount)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Platform fee ({percentText(fee)})</dt>
                    <dd className="font-medium tabular-nums">−{formatINR(split.fee)}</dd>
                  </div>
                  <div className="flex items-end justify-between gap-3 border-t border-line-strong/60 pt-3">
                    <dt className="font-medium text-ink">You earn</dt>
                    <dd className="font-display text-3xl font-semibold tracking-tight tabular-nums">{formatINR(split.net)}</dd>
                  </div>
                </dl>
              ) : (
                <div className="flex flex-col items-start gap-3 text-sm text-muted" role="status">
                  We couldn’t load the current platform fee, so we can’t show a breakdown right now.
                  <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
                    <RefreshCw /> Try again
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-faint">
              For illustration. Your dashboard shows the exact earning for every order before you accept it.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

type PayoutStep = { icon: LucideIcon; title: string; body: string }

export function PayoutSection() {
  const { terms } = usePlatformTerms()
  const steps: PayoutStep[] = [
    { icon: BadgeCheck, title: 'Brand approves', body: 'Approval (or auto-approval) completes the order and records your earning.' },
    { icon: Hourglass, title: 'Balance becomes available', body: `Your earning becomes withdrawable ${holdText(terms)}.` },
    {
      icon: Wallet,
      title: 'Request a payout',
      body:
        terms.minPayout != null
          ? `Once your available balance reaches ${minPayoutText(terms)}, request a payout for the full amount.`
          : 'Once your available balance reaches the minimum payout amount, request a payout for the full amount.',
    },
    { icon: Send, title: 'Money on its way', body: 'Our team processes the transfer and adds the reference number to your payout history.' },
  ]

  return (
    <section aria-labelledby="payouts-title" className="section-blend py-section">
      <div className="container-page">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            titleId="payouts-title"
            eyebrow="Payouts"
            title={
              <>
                Paid out to your <Accent>UPI or bank</Accent>
              </>
            }
            description="No invoices, no reminders. Your balance fills up as orders complete, and you decide when to withdraw it."
          />
          <Button asChild variant="ghost" size="lg" className="shrink-0 self-start md:self-auto">
            <Link to="/payout-policy">
              Read the payout policy <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {steps.map((step, i) => (
              <Reveal as="li" key={step.title} delay={i * 70}>
                <article className="flex h-full flex-col gap-4 rounded-card border border-line bg-canvas p-5">
                  <div className="flex items-center justify-between">
                    <IconChip icon={step.icon} tone={i === steps.length - 1 ? 'ink' : 'brand'} size="sm" />
                    <span className="font-display text-sm font-semibold text-faint tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </ol>

          <div className="grid gap-4">
            <PayoutMethod
              icon={Smartphone}
              title="UPI"
              body="Add your UPI ID once — for example yourname@okbank — and every payout goes straight to it."
            />
            <PayoutMethod
              icon={Landmark}
              title="Bank transfer"
              body="Add your account number and IFSC. After saving, we only ever display the last four digits."
            />
            <p className="rounded-card border border-dashed border-line-strong p-4 text-sm leading-relaxed text-muted">
              Payout details are locked while a payout is being processed, and earnings from an order our team is reviewing stay on hold until it’s resolved.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function PayoutMethod({ icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <article className="flex items-start gap-4 rounded-card border border-line bg-canvas p-5">
      <IconChip icon={icon} tone="sky" size="sm" />
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </article>
  )
}
