import { Link } from 'react-router'
import { useCategories } from '@/hooks/use-catalog'
import { Skeleton } from '@/components/ui/skeleton'
import { Seo } from '@/components/shared/seo'
import { MarketplaceView } from '@/components/marketplace/marketplace-view'

export default function Discover() {
  const categories = useCategories()

  return (
    <>
      <Seo
        title="Discover creators"
        description="Browse Indian creators by niche, city, budget and delivery time. Compare fixed prices and hire for UGC videos, reels, reviews and more."
      />
      <section className="border-b border-line bg-grain">
        <div className="container-page pt-10 pb-9 sm:pt-14 sm:pb-12">
          <p className="eyebrow text-muted">Creator marketplace</p>
          <h1 className="mt-3 max-w-3xl font-display text-display-lg font-semibold">
            Find creators your customers <span className="font-serif font-normal italic">already</span> listen to
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-soft">
            Every creator lists fixed prices, delivery times and revisions upfront — search in plain words or filter to the rupee.
          </p>
          {categories.isPending && (
            <div className="mt-6 flex flex-wrap gap-2" aria-hidden>
              {['w-20', 'w-28', 'w-24', 'w-32', 'w-20', 'w-24'].map((w, i) => (
                <Skeleton key={i} className={`h-8 rounded-pill ${w}`} />
              ))}
            </div>
          )}
          {categories.data && categories.data.length > 0 && (
            <nav aria-label="Browse by category" className="mt-6">
              <ul className="flex flex-wrap gap-2">
                {categories.data.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/categories/${c.slug}`}
                      className="focus-ring inline-flex h-8 items-center rounded-pill border border-line bg-surface/80 px-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </section>
      <div className="container-page py-8 sm:py-10">
        <MarketplaceView mode="public" />
      </div>
    </>
  )
}
