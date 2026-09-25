import { Check, Clock3, Package, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDays, formatINR } from '@/lib/format'
import { CONTENT_TYPES, labelFor } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import type { CreatorService, ServiceAddon } from '@/types'

/**
 * Fixed-price package with inclusions and add-ons. `action` renders the CTA
 * (e.g. "Hire" on storefronts, "Edit" in the creator's editor).
 */
export function ServiceCard({
  service,
  addons = [],
  action,
  highlighted,
  className,
}: {
  service: Pick<CreatorService, 'id' | 'title' | 'description' | 'price' | 'delivery_days' | 'revisions_included' | 'includes' | 'content_type' | 'requires_shipping' | 'active'>
  addons?: Pick<ServiceAddon, 'id' | 'name' | 'price' | 'active' | 'description'>[]
  action?: React.ReactNode
  highlighted?: boolean
  className?: string
}) {
  const activeAddons = addons.filter((a) => a.active)
  return (
    <article
      className={cn(
        'flex flex-col rounded-card border bg-surface p-5 transition-[box-shadow,border-color] duration-300',
        highlighted ? 'border-ink shadow-card-hover' : 'border-line shadow-card hover:border-line-strong',
        !service.active && 'opacity-70',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone="neutral" size="sm" className="mb-2">
            {labelFor(CONTENT_TYPES, service.content_type)}
          </Badge>
          <h3 className="font-display text-lg font-semibold tracking-tight">{service.title}</h3>
        </div>
        <p className="shrink-0 font-display text-2xl font-semibold tabular-nums">{formatINR(service.price)}</p>
      </div>
      {service.description && <p className="mt-2 text-sm leading-relaxed text-muted">{service.description}</p>}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-4 text-muted" /> {formatDays(service.delivery_days)} delivery
        </span>
        <span className="inline-flex items-center gap-1.5">
          <RefreshCcw className="size-4 text-muted" /> {service.revisions_included} revision{service.revisions_included === 1 ? '' : 's'}
        </span>
        {service.requires_shipping && (
          <span className="inline-flex items-center gap-1.5">
            <Package className="size-4 text-muted" /> Needs your product
          </span>
        )}
      </div>

      {service.includes.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {service.includes.map((inc) => (
            <li key={inc} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand">
                <Check className="size-3 text-ink" strokeWidth={3} />
              </span>
              {inc}
            </li>
          ))}
        </ul>
      )}

      {activeAddons.length > 0 && (
        <div className="mt-4 rounded-control bg-subtle p-3">
          <p className="mb-2 text-xs font-semibold text-muted">Add-ons</p>
          <ul className="space-y-1.5 text-sm">
            {activeAddons.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{a.name}</span>
                <span className="shrink-0 font-medium tabular-nums">+{formatINR(a.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {action && <div className="mt-5 pt-1">{action}</div>}
    </article>
  )
}
