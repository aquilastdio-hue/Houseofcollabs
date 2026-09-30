import { Link, ScrollRestoration } from 'react-router'
import { FileText, Heart, Home, Package, Search, X } from 'lucide-react'
import { TopNavShell, type NavItem } from '@/components/layout/app-shell'
import { useCompare } from '@/contexts/compare-context'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

const items: NavItem[] = [
  { label: 'Creators', href: '/brand/creators', icon: Search },
  { label: 'Orders', href: '/brand/orders', icon: Package },
  { label: 'Briefs', href: '/brand/briefs', icon: FileText },
  { label: 'Wishlists', href: '/brand/wishlists', icon: Heart },
]

const mobileTabs: NavItem[] = [
  { label: 'Home', href: '/brand', icon: Home, end: true },
  { label: 'Creators', href: '/brand/creators', icon: Search },
  { label: 'Orders', href: '/brand/orders', icon: Package },
  { label: 'Briefs', href: '/brand/briefs', icon: FileText },
]

function CompareTray() {
  const { items: selected, remove, clear } = useCompare()
  if (selected.length === 0) return null
  return (
    <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
      <div className="flex max-w-full items-center gap-3 rounded-pill border border-night-line bg-night py-2 pr-2 pl-4 text-white shadow-float">
        <span className="hidden text-sm text-white/70 sm:inline">Compare</span>
        <ul className="flex -space-x-2">
          {selected.map((c) => (
            <li key={c.id} className="group relative">
              <Avatar src={c.image} name={c.name} size="sm" className="rounded-full ring-2 ring-night" />
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="absolute -top-1 -right-1 hidden size-4 items-center justify-center rounded-full bg-white text-ink group-hover:flex focus-visible:flex"
                aria-label={`Remove ${c.name}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="ghost-inverse" size="xs" onClick={clear}>
          Clear
        </Button>
        <Button asChild variant="accent" size="sm" disabled={selected.length < 2}>
          <Link to="/brand/compare">Compare {selected.length}</Link>
        </Button>
      </div>
    </div>
  )
}

export default function BrandLayout() {
  return (
    <>
      <TopNavShell
        items={items}
        mobileTabs={mobileTabs}
        homeHref="/brand"
        settingsHref="/brand/settings/profile"
        profileHref="/brand/settings/profile"
        notificationsHref="/brand/notifications"
      />
      <CompareTray />
      <ScrollRestoration />
    </>
  )
}
