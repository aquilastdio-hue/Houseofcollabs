import * as React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from './states'
import { Pagination } from './pagination'

export type Column<T> = {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
  headerClassName?: string
  /** Hide on small screens (row still visible in the mobile card layout). */
  hideOnMobile?: boolean
  /** Label shown in the mobile card layout. */
  mobileLabel?: string
}

/**
 * Responsive table: a real <table> from `lg` up, stacked cards below.
 * Tablets get cards: these tables run 8-9 columns, which needed ~1200px and
 * forced sideways scrolling inside the card on iPad portrait.
 * Handles loading / error / empty states and server-side pagination.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  onRowClick,
  pagination,
  className,
  mobilePrimary,
}: {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  empty?: React.ReactNode
  onRowClick?: (row: T) => void
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void; label?: string }
  className?: string
  /** Column key rendered as the card title on mobile. */
  mobilePrimary?: string
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  const isEmpty = !loading && (rows?.length ?? 0) === 0
  if (isEmpty) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>
  const primary = columns.find((c) => c.key === mobilePrimary) ?? columns[0]!

  return (
    <div className={cn('space-y-4', className)}>
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-card lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle/60">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn('px-4 py-3 text-xs font-semibold whitespace-nowrap text-muted', c.headerClassName)}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      {columns.map((c) => (
                        <td key={c.key} className="px-4 py-3.5">
                          <Skeleton className="h-4 w-full max-w-40" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows!.map((row) => (
                    <tr
                      key={rowKey(row)}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn('border-b border-line transition-colors last:border-0', onRowClick && 'cursor-pointer hover:bg-subtle/60')}
                    >
                      {columns.map((c) => (
                        <td key={c.key} className={cn('px-4 py-3.5 align-middle', c.className)}>
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="space-y-3 lg:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="rounded-card border border-line bg-surface p-4">
                <Skeleton className="mb-3 h-5 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </li>
            ))
          : rows!.map((row) => (
              <li key={rowKey(row)}>
                <div
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                  className={cn('rounded-card border border-line bg-surface p-4 shadow-card', onRowClick && 'focus-ring cursor-pointer active:bg-subtle')}
                >
                  <div className="mb-3 font-medium">{primary.cell(row)}</div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    {columns
                      .filter((c) => c.key !== primary.key)
                      .map((c) => (
                        <div key={c.key} className="min-w-0">
                          <dt className="text-xs text-faint">{c.mobileLabel ?? (typeof c.header === 'string' ? c.header : c.key)}</dt>
                          <dd className="mt-0.5 min-w-0 truncate">{c.cell(row)}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              </li>
            ))}
      </ul>

      {pagination && !loading && <Pagination {...pagination} />}
    </div>
  )
}
