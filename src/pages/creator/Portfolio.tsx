import { Link } from 'react-router'
import { ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { PortfolioManager } from '@/components/creator-studio/portfolio-manager'
import { CreatorSetupRequired } from '@/components/creator-studio/parts'
import { ResumeBanner, useRequirements } from '@/components/creator-studio/feature-gate'

export default function Portfolio() {
  const { creator } = useAuth()
  const requirements = useRequirements()
  return (
    <>
      <Seo title="Portfolio" noindex />
      <PageHeader
        title="Portfolio"
        description="Photos, videos and links that show brands what working with you looks like."
        actions={
          creator?.status === 'published' ? (
            <Button asChild variant="secondary">
              <Link to={`/creators/${creator.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> View on storefront
              </Link>
            </Button>
          ) : undefined
        }
      />
      <ResumeBanner satisfied={(requirements.data?.portfolio.visible ?? 0) > 0} />
      {creator ? (
        <Card className="p-5 sm:p-8">
          <PortfolioManager
            creator={creator}
            title="Your work"
            description="Drag files in or add links to Instagram and YouTube posts. Use the menu on each piece to edit, reorder or delete it."
          />
        </Card>
      ) : (
        <CreatorSetupRequired />
      )}
    </>
  )
}
