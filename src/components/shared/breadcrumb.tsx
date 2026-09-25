import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Breadcrumb({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4 text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link to={item.href} className="rounded transition-colors hover:text-ink focus-ring">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn(last && 'font-medium text-ink', 'max-w-[40ch] truncate')}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5 text-faint" aria-hidden />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
