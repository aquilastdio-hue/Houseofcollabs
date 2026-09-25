import { Link } from 'react-router'
import { Building2, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/states'

/**
 * Shown when the signed-in brand user has no loadable brand record (failed
 * request or unfinished onboarding). The layout guard normally prevents this.
 */
export function BrandMissing() {
  const { refresh } = useAuth()
  return (
    <EmptyState
      icon={<Building2 />}
      title="We couldn’t load your brand profile"
      description="Check your connection and try again. If you haven’t finished setting up your brand yet, complete onboarding first."
      action={
        <>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            <RefreshCw /> Try again
          </Button>
          <Button asChild size="sm">
            <Link to="/onboarding">Finish setup</Link>
          </Button>
        </>
      }
    />
  )
}
