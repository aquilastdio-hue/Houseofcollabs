import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Building2, Sparkles } from 'lucide-react'
import { site } from '@/config/site'
import { Seo } from '@/components/shared/seo'
import { Button } from '@/components/ui/button'
import { RadioCard, RadioGroup } from '@/components/ui/radio-group'
import type { ApplicationRole } from '@/services/applications.service'
import { ApplicationForm } from '@/components/applications/application-form'

/**
 * The front door for new people: choose brand or creator, press Continue, fill
 * in the matching form. No account and no OAuth — the submission goes straight
 * to the admin panel for review.
 *
 * Existing members still sign in at /login; this flow doesn't touch auth.
 */
export default function GetStarted() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const requested = params.get('role')
  const chosen: ApplicationRole | null = requested === 'brand' || requested === 'creator' ? requested : null
  const [role, setRole] = React.useState<ApplicationRole | ''>('')

  if (chosen) {
    return (
      <>
        <Seo title={chosen === 'brand' ? 'Apply as a brand' : 'Apply as a creator'} noindex />
        <ApplicationForm role={chosen} />
      </>
    )
  }

  return (
    <>
      <Seo title="Create your profile" description={`Join ${site.name} as a brand or a creator.`} />
      <div className="container-page flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center py-12">
        <div className="w-full max-w-lg">
          <p className="eyebrow text-muted">Create your profile</p>
          <h1 className="mt-2 font-display text-display-md font-semibold tracking-tight">How will you use {site.name}?</h1>
          <p className="mt-2 text-muted">Tell us which side you’re on and we’ll ask for the right details.</p>

          <RadioGroup value={role} onValueChange={(v) => setRole(v as ApplicationRole)} className="mt-8" aria-label="Account type">
            <RadioCard value="brand" title="I’m a brand" description="Discover creators, send briefs and order content." icon={<Building2 />} />
            <RadioCard value="creator" title="I’m a creator" description="Build a storefront, sell content services and get paid." icon={<Sparkles />} />
          </RadioGroup>

          <Button className="mt-6" size="lg" block disabled={!role} onClick={() => role && navigate(`/get-started?role=${role}`)}>
            Continue
          </Button>

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-ink underline-offset-2 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
