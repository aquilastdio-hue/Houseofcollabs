import * as React from 'react'
import { Link } from 'react-router'
import { BadgeCheck, X } from 'lucide-react'
import { cn, range } from '@/lib/utils'
import { formatCompact, formatDays, formatINR, formatLocation } from '@/lib/format'
import type { CreatorProfile } from '@/services/creators.service'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SmartImage } from '@/components/shared/smart-image'
import { RatingLabel } from '@/components/shared/star-rating'
import { firstName, profileCategories, profileLanguages, visiblePortfolio, visibleServices } from './profile-utils'

const rowHeader =
  'sticky left-0 z-10 w-28 min-w-28 border-r border-b border-line bg-surface p-4 text-left align-top text-xs font-medium text-muted sm:w-40 sm:min-w-40 sm:text-sm'
const cell = 'min-w-56 border-b border-line p-4 align-top'

/** Best value among ≥2 comparable numbers; null when nothing stands out (all equal / too few). */
function bestOf(values: (number | null)[], direction: 'min' | 'max') {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (nums.length < 2) return null
  const target = direction === 'min' ? Math.min(...nums) : Math.max(...nums)
  return nums.every((n) => n === target) ? null : target
}

function Highlight({ best, children }: { best: boolean; children: React.ReactNode }) {
  if (!best) return <span className="font-medium text-ink">{children}</span>
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-brand px-2.5 py-0.5 font-semibold text-white">
      {children}
      <span className="sr-only"> (best in this comparison)</span>
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className={rowHeader}>
        {label}
      </th>
      {children}
    </tr>
  )
}

const Muted = () => <span className="text-faint">—</span>

/**
 * Side-by-side comparison: sticky label column, one column per creator,
 * horizontal scroll on small screens. Best values get a lime pill.
 */
export function CompareTable({ creators, onRemove }: { creators: CreatorProfile[]; onRemove: (id: string) => void }) {
  const prices = creators.map((c) => (c.starting_price != null ? Number(c.starting_price) : null))
  const deliveries = creators.map((c) => c.fastest_delivery_days)
  const followers = creators.map((c) => c.followers_count)
  const ratings = creators.map((c) => (c.review_count > 0 ? Number(c.rating) : null))
  const best = {
    price: bestOf(prices, 'min'),
    delivery: bestOf(deliveries, 'min'),
    followers: bestOf(followers, 'max'),
    rating: bestOf(ratings, 'max'),
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Comparison of {creators.length} creators</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(rowHeader, 'align-bottom')}>
              <span className="sr-only">Detail</span>
            </th>
            {creators.map((c) => (
              <th key={c.id} scope="col" className={cn(cell, 'text-left font-normal')}>
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/brand/creators/${c.id}`} className="focus-ring group flex min-w-0 items-center gap-3 rounded-control">
                    <Avatar src={c.profile_image_url} name={c.display_name} size="lg" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 font-display text-base font-semibold text-ink group-hover:underline">
                        <span className="truncate">{c.display_name}</span>
                        {c.verified && <BadgeCheck role="img" aria-label="Verified" className="size-4 shrink-0 fill-brand text-ink" />}
                      </span>
                      <span className="block truncate text-xs text-muted">{c.available ? 'Available now' : 'Busy'}</span>
                    </span>
                  </Link>
                  <Button variant="ghost" size="icon-xs" aria-label={`Remove ${c.display_name} from comparison`} onClick={() => onRemove(c.id)}>
                    <X />
                  </Button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>*]:border-b-0">
          <Row label="Category">
            {creators.map((c) => {
              const [primary, ...rest] = profileCategories(c)
              return (
                <td key={c.id} className={cell}>
                  {primary ? (
                    <span className="font-medium text-ink">
                      {primary.name}
                      {rest.length > 0 && <span className="font-normal text-muted"> +{rest.length}</span>}
                    </span>
                  ) : (
                    <Muted />
                  )}
                </td>
              )
            })}
          </Row>
          <Row label="Location">
            {creators.map((c) => (
              <td key={c.id} className={cn(cell, 'text-ink-soft')}>
                {formatLocation(c.city, c.state)}
              </td>
            ))}
          </Row>
          <Row label="Followers">
            {creators.map((c) => (
              <td key={c.id} className={cn(cell, 'tabular-nums')}>
                <Highlight best={best.followers !== null && c.followers_count === best.followers}>{formatCompact(c.followers_count)}</Highlight>
              </td>
            ))}
          </Row>
          <Row label="Starting price">
            {creators.map((c, i) => (
              <td key={c.id} className={cn(cell, 'tabular-nums')}>
                {prices[i] !== null ? <Highlight best={best.price !== null && prices[i] === best.price}>{formatINR(prices[i])}</Highlight> : <Muted />}
              </td>
            ))}
          </Row>
          <Row label="Fastest delivery">
            {creators.map((c) => (
              <td key={c.id} className={cell}>
                {c.fastest_delivery_days != null ? (
                  <Highlight best={best.delivery !== null && c.fastest_delivery_days === best.delivery}>{formatDays(c.fastest_delivery_days)}</Highlight>
                ) : (
                  <Muted />
                )}
              </td>
            ))}
          </Row>
          <Row label="Languages">
            {creators.map((c) => {
              const languages = profileLanguages(c)
              return (
                <td key={c.id} className={cn(cell, 'text-ink-soft')}>
                  {languages.length > 0 ? languages.join(', ') : <Muted />}
                </td>
              )
            })}
          </Row>
          <Row label="Rating">
            {creators.map((c, i) => (
              <td key={c.id} className={cell}>
                {ratings[i] !== null ? (
                  <Highlight best={best.rating !== null && ratings[i] === best.rating}>
                    <RatingLabel rating={Number(c.rating)} count={c.review_count} />
                  </Highlight>
                ) : (
                  <span className="text-muted">New</span>
                )}
              </td>
            ))}
          </Row>
          <Row label="Services">
            {creators.map((c) => {
              const services = visibleServices(c, false)
              return (
                <td key={c.id} className={cell}>
                  {services.length > 0 ? (
                    <ul className="space-y-1.5">
                      {services.slice(0, 4).map((s) => (
                        <li key={s.id} className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-ink-soft" title={s.title}>
                            {s.title}
                          </span>
                          <span className="shrink-0 font-medium text-ink tabular-nums">{formatINR(s.price)}</span>
                        </li>
                      ))}
                      {services.length > 4 && <li className="text-xs text-muted">+{services.length - 4} more</li>}
                    </ul>
                  ) : (
                    <Muted />
                  )}
                </td>
              )
            })}
          </Row>
          <Row label="Revisions">
            {creators.map((c) => {
              const counts = visibleServices(c, false).map((s) => s.revisions_included)
              const min = counts.length ? Math.min(...counts) : null
              const max = counts.length ? Math.max(...counts) : null
              return (
                <td key={c.id} className={cn(cell, 'text-ink-soft')}>
                  {min === null || max === null ? <Muted /> : `${min === max ? min : `${min}–${max}`} revision${max === 1 ? '' : 's'}`}
                </td>
              )
            })}
          </Row>
          <Row label="Portfolio">
            {creators.map((c) => {
              const items = visiblePortfolio(c).slice(0, 3)
              return (
                <td key={c.id} className={cell}>
                  {items.length > 0 ? (
                    <Link to={`/brand/creators/${c.id}#portfolio`} className="focus-ring flex gap-2 rounded-control" aria-label={`View ${c.display_name}’s portfolio`}>
                      {items.map((p) => (
                        <SmartImage key={p.id} src={p.type === 'image' ? p.media_url : p.thumbnail_url} alt="" className="size-16 shrink-0 rounded-control" />
                      ))}
                    </Link>
                  ) : (
                    <Muted />
                  )}
                </td>
              )
            })}
          </Row>
          <Row label="Hire">
            {creators.map((c) => (
              <td key={c.id} className={cell}>
                <Button asChild size="sm" block>
                  <Link to={`/brand/creators/${c.id}#services`}>Hire {firstName(c.display_name)}</Link>
                </Button>
              </td>
            ))}
          </Row>
        </tbody>
      </table>
    </div>
  )
}

export function CompareTableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card" aria-busy>
      <p role="status" className="sr-only">
        Loading comparison…
      </p>
      <div className="flex gap-4">
        <div className="w-28 shrink-0 space-y-6 pt-20 sm:w-40">
          {range(8).map((i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
        {range(columns).map((i) => (
          <div key={i} className="min-w-56 flex-1 space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            {range(8).map((j) => (
              <Skeleton key={j} className="h-4 w-3/4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
