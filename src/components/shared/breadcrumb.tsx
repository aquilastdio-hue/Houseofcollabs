import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { siteUrl } from '@/config/site'

export function Breadcrumb({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  // The visible trail already says where the page sits; this states the same
  // thing in the form Google reads, which is what turns a result's URL line
  // into a breadcrumb. Only linked crumbs get an `item` — the current page is
  // the last entry and should not link to itself.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href && i < items.length - 1 ? { item: siteUrl(item.href) } : {}),
    })),
  }
  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4 text-sm', className)}>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
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
