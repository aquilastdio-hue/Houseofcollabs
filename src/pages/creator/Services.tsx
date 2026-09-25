import * as React from 'react'
import { IndianRupee, Lightbulb } from 'lucide-react'
import { formatINR, formatPercent } from '@/lib/format'
import { useAuth } from '@/contexts/auth-context'
import { usePublicSettings } from '@/hooks/use-catalog'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/states'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { ServicesEditor } from '@/components/creator-studio/services-editor'
import { CreatorSetupRequired } from '@/components/creator-studio/parts'
import { ResumeBanner, useRequirements } from '@/components/creator-studio/feature-gate'
import { estimateEarning, parseAmount, useFeePercent } from '@/components/creator-studio/earning-estimate'

const TIPS = [
  'Price per deliverable, not per hour — brands compare packages side by side.',
  'Offer two or three services at different price points, like a single video and a three-video bundle.',
  'Keep your base price competitive and sell extras — 24-hour delivery, raw footage, usage rights — as add-ons.',
  'Be realistic with delivery times. On-time delivery protects your rating.',
  'Include at least one revision. Brands expect a round of feedback.',
]

function EarningsCalculator() {
  const settings = usePublicSettings()
  const fee = useFeePercent()
  const [price, setPrice] = React.useState('2500')
  const amount = parseAmount(price)
  const valid = Number.isFinite(amount) && amount > 0
  const net = valid && fee != null ? estimateEarning(amount, fee) : 0
  const cut = Math.round((amount - net) * 100) / 100

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-semibold tracking-tight">What you earn</h2>
      {settings.isPending ? (
        <div className="mt-3 space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      ) : settings.isError ? (
        <ErrorState compact className="mt-3" error={settings.error} title="Couldn’t load the platform fee" onRetry={() => void settings.refetch()} />
      ) : fee == null ? (
        <p className="mt-2 text-sm text-muted">A platform fee is deducted from each order. You’ll see the exact split on every order.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            House of Collabs keeps {formatPercent(fee)} of each order, including add-ons. The rest is yours.
          </p>
          <Field label="Try a price" htmlFor="pricing-calculator" className="mt-4">
            <Input
              id="pricing-calculator"
              inputMode="decimal"
              autoComplete="off"
              leftIcon={<IndianRupee />}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <div className="mt-4 rounded-card bg-night p-4 text-white" aria-live="polite">
            <p className="text-sm text-white/70">You earn</p>
            <p className="font-display text-3xl font-semibold tabular-nums">{valid ? formatINR(net) : '—'}</p>
            {valid && (
              <p className="mt-1 text-sm text-white/70">
                of {formatINR(amount)} · {formatINR(cut)} platform fee
              </p>
            )}
          </div>
          <p className="mt-3 text-xs text-faint">Estimate only. The exact split is calculated on each order.</p>
        </>
      )}
    </Card>
  )
}

function PricingTips() {
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
        <Lightbulb className="size-5 text-brand-ink" aria-hidden /> Pricing tips
      </h2>
      <ul className="mt-3 space-y-3">
        {TIPS.map((tip) => (
          <li key={tip} className="flex gap-2.5 text-sm text-ink-soft">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-strong" aria-hidden />
            {tip}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function Services() {
  const { creator } = useAuth()
  const requirements = useRequirements()
  return (
    <>
      <Seo title="Services" noindex />
      <PageHeader title="Services" description="Fixed-price packages with clear delivery times, revisions and add-ons." />
      <ResumeBanner satisfied={(requirements.data?.services.active ?? 0) > 0} />
      {creator ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <div className="min-w-0">
            <ServicesEditor creator={creator} gridClassName="2xl:grid-cols-2" />
          </div>
          <aside className="space-y-4 xl:sticky xl:top-24" aria-label="Pricing help">
            <EarningsCalculator />
            <PricingTips />
          </aside>
        </div>
      ) : (
        <CreatorSetupRequired />
      )}
    </>
  )
}
