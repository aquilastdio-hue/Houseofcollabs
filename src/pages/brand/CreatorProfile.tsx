import { useParams } from 'react-router'
import { useCreatorById } from '@/hooks/use-creators'
import { CreatorProfileScreen } from '@/components/marketplace/creator-profile-view'

export default function CreatorProfile() {
  const { id } = useParams()
  const query = useCreatorById(id)
  return <CreatorProfileScreen mode="brand" query={query} />
}
