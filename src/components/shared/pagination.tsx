import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'

function pages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, current, current - 1, current + 1])
  const list = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1]! > 1) out.push('…')
    out.push(p)
  })
  return out
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
  label = 'results',
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
  label?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav aria-label="Pagination" className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}>
      <p className="text-sm text-muted">
        Showing <span className="font-medium text-ink">{formatNumber(from)}–{formatNumber(to)}</span> of{' '}
        <span className="font-medium text-ink">{formatNumber(total)}</span> {label}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft />
          </Button>
          {pages(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1.5 text-sm text-faint">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'primary' : 'ghost'}
                size="icon-sm"
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  )
}
