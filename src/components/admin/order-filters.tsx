import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { ORDER_STATUS_META } from '@/lib/order-state'
import { getBrand, getCreator } from '@/services/admin.service'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import type { OrderStatus } from '@/types'
import { FilterChip } from './filter-bar'
import { ORDER_STATUSES } from './order-presets'

/** Multi-select for exact order statuses (checkbox list in a popover). */
export function OrderStatusPicker({ id, value, onChange }: { id: string; value: OrderStatus[]; onChange: (next: OrderStatus[]) => void }) {
  const label =
    value.length === 0 ? 'Any status' : value.length === 1 ? ORDER_STATUS_META[value[0]!].label : `${value.length} statuses`
  const toggle = (s: OrderStatus, on: boolean) => onChange(on ? ORDER_STATUSES.filter((x) => x === s || value.includes(x)) : value.filter((x) => x !== s))
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            'focus-ring flex h-9 w-full items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 text-left text-sm transition-[border-color] hover:border-line-strong',
            value.length === 0 && 'text-faint',
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,26rem)] p-0">
        <fieldset className="p-3">
          <legend className="sr-only">Order statuses</legend>
          <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {ORDER_STATUSES.map((s) => (
              <label key={s} htmlFor={`${id}-${s}`} className="flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5 text-sm hover:bg-subtle">
                <Checkbox id={`${id}-${s}`} checked={value.includes(s)} onCheckedChange={(v) => toggle(s, v === true)} />
                {ORDER_STATUS_META[s].label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center justify-between border-t border-line px-3 py-2">
          <span className="text-xs text-muted">{value.length ? `${value.length} selected` : 'All statuses'}</span>
          <Button variant="ghost" size="xs" disabled={value.length === 0} onClick={() => onChange([])}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Chips for the brand / creator scoping filters, with names resolved from the ids. */
export function OrderPartyChips({ brandId, creatorId, onClearBrand, onClearCreator }: { brandId: string; creatorId: string; onClearBrand: () => void; onClearCreator: () => void }) {
  const brand = useQuery({ queryKey: qk.admin.brand(brandId), queryFn: () => getBrand(brandId), enabled: !!brandId, staleTime: 5 * 60_000 })
  const creator = useQuery({ queryKey: qk.admin.creator(creatorId), queryFn: () => getCreator(creatorId), enabled: !!creatorId, staleTime: 5 * 60_000 })
  if (!brandId && !creatorId) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {brandId && <FilterChip label={`Brand: ${brand.data?.brand_name ?? (brand.isPending ? '…' : 'Unknown brand')}`} onRemove={onClearBrand} />}
      {creatorId && <FilterChip label={`Creator: ${creator.data?.display_name ?? (creator.isPending ? '…' : 'Unknown creator')}`} onRemove={onClearCreator} />}
    </div>
  )
}
