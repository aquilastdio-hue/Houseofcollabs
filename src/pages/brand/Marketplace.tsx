import { Seo } from '@/components/shared/seo'
import { MarketplaceView } from '@/components/marketplace/marketplace-view'

export default function Marketplace() {
  return (
    <>
      <Seo title="Find creators" noindex />
      <MarketplaceView
        mode="brand"
        title="Find creators"
        description="Search by niche, city, budget and turnaround — then compare, shortlist and hire at fixed prices."
      />
    </>
  )
}
