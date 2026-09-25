import { useParams } from 'react-router'
import { useCreatorBySlug } from '@/hooks/use-creators'
import { CreatorProfileScreen } from '@/components/marketplace/creator-profile-view'

export default function CreatorStorefront() {
  const { slug } = useParams()
  const query = useCreatorBySlug(slug)
  return (
    <div className="container-page py-6 sm:py-10">
      <CreatorProfileScreen mode="public" query={query} />
    </div>
  )
}
