import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { CategoryManager } from '@/components/admin/category-manager'
import { CreatorTypeManager } from '@/components/admin/creator-type-manager'

export default function Categories() {
  return (
    <>
      <Seo title="Categories" noindex />
      <PageHeader
        eyebrow="Marketplace"
        title="Categories & creator types"
        description="The taxonomy behind discovery: niches creators tag themselves with, and the audience-size labels brands filter by."
      />
      <div className="space-y-8">
        <CategoryManager />
        <CreatorTypeManager />
      </div>
    </>
  )
}
