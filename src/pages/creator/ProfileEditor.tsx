import { Link, useSearchParams } from 'react-router'
import { ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { Seo } from '@/components/shared/seo'
import { BasicInfoForm } from '@/components/creator-studio/basic-info-form'
import { CreatorInfoForm } from '@/components/creator-studio/creator-info-form'
import { SocialAccountsEditor } from '@/components/creator-studio/social-accounts-editor'
import { IntroVideoForm } from '@/components/creator-studio/intro-video-form'
import { CompletionCard } from '@/components/creator-studio/completion-card'
import { ProfileStatusCard } from '@/components/creator-studio/profile-status-card'
import { StorefrontUrlForm } from '@/components/creator-studio/storefront-url-form'
import { CreatorSetupRequired } from '@/components/creator-studio/parts'
import { ResumeBanner, useRequirements } from '@/components/creator-studio/feature-gate'
import { VerificationCard } from '@/components/creator-studio/verification-card'

const TABS = [
  { value: 'basic', label: 'Basic info' },
  { value: 'creator', label: 'Creator info' },
  { value: 'social', label: 'Social accounts' },
] as const

type TabValue = (typeof TABS)[number]['value']

function isTab(value: string | null): value is TabValue {
  return TABS.some((t) => t.value === value)
}

export default function ProfileEditor() {
  const { creator } = useAuth()
  const requirements = useRequirements()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabValue = isTab(requested) ? requested : 'basic'

  const header = (
    <PageHeader
      title="Storefront profile"
      description="Everything brands see on your public storefront — keep it fresh to win more orders."
      actions={
        creator?.status === 'published' ? (
          <Button asChild variant="secondary">
            <Link to={`/creators/${creator.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> View public storefront
            </Link>
          </Button>
        ) : undefined
      }
    />
  )

  if (!creator) {
    return (
      <>
        <Seo title="Storefront profile" noindex />
        {header}
        <CreatorSetupRequired />
      </>
    )
  }

  return (
    <>
      <Seo title="Storefront profile" noindex />
      {header}
      <ResumeBanner satisfied={requirements.data?.completion?.can_publish ?? false} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:grid-rows-[auto_1fr] xl:items-start">
        <ProfileStatusCard creator={creator} className="xl:col-start-2 xl:row-start-1" />

        <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <Tabs
            value={tab}
            onValueChange={(value) =>
              setParams(
                (prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('tab', value)
                  return next
                },
                { replace: true },
              )
            }
          >
            <TabsList variant="underline" aria-label="Profile sections">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="basic" forceMount className="mt-6 data-[state=inactive]:hidden">
              <Card className="p-5 sm:p-8">
                <BasicInfoForm />
              </Card>
            </TabsContent>
            <TabsContent value="creator" forceMount className="mt-6 data-[state=inactive]:hidden">
              <Card className="p-5 sm:p-8">
                <CreatorInfoForm creator={creator} />
              </Card>
            </TabsContent>
            <TabsContent value="social" forceMount className="mt-6 data-[state=inactive]:hidden">
              <Card className="space-y-10 p-5 sm:p-8">
                <SocialAccountsEditor creator={creator} />
                <IntroVideoForm creator={creator} />
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="min-w-0 space-y-6 xl:col-start-2 xl:row-start-2">
          <CompletionCard stacked />
          <VerificationCard />
          <Card className="p-5 sm:p-6">
            <StorefrontUrlForm creator={creator} />
          </Card>
        </div>
      </div>
    </>
  )
}
