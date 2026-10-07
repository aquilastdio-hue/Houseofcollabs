import { Link } from 'react-router'
import { ArrowRight, Building2, Sparkles } from 'lucide-react'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { Card } from '@/components/ui/card'
import { BRAND_FORM_PREVIEW, CREATOR_FORM_PREVIEW } from './forms/form-catalog'

const OPTIONS = [
  {
    to: '/admin/forms/creators',
    icon: Sparkles,
    title: 'Creators',
    form: CREATOR_FORM_PREVIEW,
  },
  {
    to: '/admin/forms/brands',
    icon: Building2,
    title: 'Brands',
    form: BRAND_FORM_PREVIEW,
  },
] as const

export default function Forms() {
  return (
    <>
      <Seo title="Forms" />
      <PageHeader
        eyebrow="Platform"
        title="Forms"
        description="Preview the onboarding questions applicants answer — page by page, in the same order they appear on Get started."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map(({ to, icon: Icon, title, form }) => (
          <Link key={to} to={to} className="focus-ring group block rounded-card">
            <Card className="h-full p-6 transition-colors group-hover:border-brand-strong/40 group-hover:bg-brand-soft/20">
              <span className="flex size-10 items-center justify-center rounded-control bg-brand-soft text-brand-strong">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-1.5 text-sm text-muted">{form.description}</p>
              <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                {form.pages.length} pages
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
