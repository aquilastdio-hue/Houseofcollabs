import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { CreatorSettingsNav } from '@/components/creator-studio/settings-nav'
import { SocialAccountsEditor } from '@/components/creator-studio/social-accounts-editor'
import { CreatorSetupRequired } from '@/components/creator-studio/parts'
import { ResumeBanner, useRequirements } from '@/components/creator-studio/feature-gate'

export default function SocialSettings() {
  const { creator } = useAuth()
  const requirements = useRequirements()
  return (
    <>
      <Seo title="Social accounts" noindex />
      <PageHeader title="Settings" description="Connect the accounts you post on so brands can see your reach." />
      <CreatorSettingsNav />
      <div className="max-w-3xl">
        <ResumeBanner satisfied={(requirements.data?.analytics.accounts ?? 0) > 0} />
        {creator ? (
          <Card className="p-5 sm:p-8">
            <SocialAccountsEditor creator={creator} />
          </Card>
        ) : (
          <CreatorSetupRequired />
        )}
      </div>
    </>
  )
}
