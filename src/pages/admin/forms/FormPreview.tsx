import * as React from 'react'
import { useForm } from 'react-hook-form'
import { ChevronLeft, ChevronRight, Expand, ExternalLink, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BrandApplicationStep } from '@/components/applications/brand-wizard'
import { CreatorApplicationStep } from '@/components/applications/creator-wizard'
import { BRAND_APPLICATION_DEFAULTS, type BrandApplicationValues } from '@/schemas/brand-application'
import { CREATOR_APPLICATION_DEFAULTS, type CreatorApplicationValues } from '@/schemas/creator-application'
import type { FormPageMeta, OnboardingFormPreview } from './form-catalog'

function PageCard({ page, onOpen }: { page: FormPageMeta; onOpen: () => void }) {
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={onOpen}
        className="focus-ring group flex h-full w-full flex-col gap-2 p-5 text-left transition-colors hover:bg-brand-soft/30"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow text-faint">Page {page.index}</p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors group-hover:border-brand-strong/40 group-hover:text-ink">
            <Expand className="size-3.5" aria-hidden />
            Fullscreen
          </span>
        </div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink group-hover:text-brand-strong">{page.title}</h2>
        <p className="line-clamp-2 text-sm text-muted">{page.blurb}</p>
        <p className="mt-auto pt-2 text-xs text-faint">Open fullscreen to see every question</p>
      </button>
    </Card>
  )
}

function CreatorLiveStep({ step }: { step: number }) {
  const form = useForm<CreatorApplicationValues>({
    defaultValues: CREATOR_APPLICATION_DEFAULTS,
    disabled: true,
  })
  return (
    <fieldset disabled className="pointer-events-none min-w-0">
      <CreatorApplicationStep step={step} form={form} />
    </fieldset>
  )
}

function BrandLiveStep({ step }: { step: number }) {
  const form = useForm<BrandApplicationValues>({
    defaultValues: BRAND_APPLICATION_DEFAULTS,
    disabled: true,
  })
  return (
    <fieldset disabled className="pointer-events-none min-w-0">
      <BrandApplicationStep step={step} form={form} />
    </fieldset>
  )
}

function FullscreenPage({
  page,
  open,
  onOpenChange,
  onPageChange,
  form,
}: {
  page: FormPageMeta | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPageChange: (page: FormPageMeta) => void
  form: OnboardingFormPreview
}) {
  if (!page) return null
  const pagePosition = form.pages.findIndex((candidate) => candidate.index === page.index)
  const previousPage = form.pages[pagePosition - 1]
  const nextPage = form.pages[pagePosition + 1]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        hideClose
        className="inset-0 h-dvh max-h-dvh w-screen max-w-none rounded-none sm:inset-0 sm:top-0 sm:left-0 sm:h-dvh sm:max-h-dvh sm:w-screen sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none"
      >
        <div className="flex h-full flex-col">
          <DialogHeader className="shrink-0 border-b border-line bg-surface pr-6!">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow text-faint">
                  {form.label} · Page {page.index}
                </p>
                <DialogTitle className="mt-1">{page.title}</DialogTitle>
                <DialogDescription className="mt-1.5">{page.blurb}</DialogDescription>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)} aria-label="Close fullscreen">
                <X className="size-4" />
                Close
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain bg-canvas px-4 py-6 sm:px-8">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,42rem)_minmax(0,1fr)] sm:gap-x-6">
              <div className="col-span-3 row-start-1 w-full sm:col-span-1 sm:col-start-2">
                <Card className="p-5 sm:p-8">
                  <p className="mb-5 text-sm text-muted">
                    Live preview of the onboarding form — same fields and order applicants see. Read-only.
                  </p>
                  {form.role === 'creator' ? (
                    <CreatorLiveStep step={page.index - 1} />
                  ) : (
                    <BrandLiveStep step={page.index - 1} />
                  )}
                </Card>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="col-start-1 row-start-2 justify-self-start sm:col-start-1 sm:row-start-1 sm:justify-self-center"
                disabled={!previousPage}
                onClick={() => previousPage && onPageChange(previousPage)}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="col-start-3 row-start-2 justify-self-end sm:col-start-3 sm:row-start-1 sm:justify-self-center"
                disabled={!nextPage}
                onClick={() => nextPage && onPageChange(nextPage)}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function FormPreview({ form }: { form: OnboardingFormPreview }) {
  const [active, setActive] = React.useState<FormPageMeta | null>(null)

  return (
    <>
      <Seo title={`${form.label} · Forms`} />
      <PageHeader
        eyebrow="Platform · Forms"
        title={form.label}
        description={form.description}
        actions={
          <Button asChild variant="secondary" size="sm">
            <a href={form.publicPath} target="_blank" rel="noreferrer">
              Open live form <ExternalLink className="size-3.5" />
            </a>
          </Button>
        }
      />

      <p className={cn('mb-5 text-sm text-muted')}>
        All {form.pages.length} pages in one grid. Fullscreen opens the real form page, so question changes in onboarding show up here automatically.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {form.pages.map((page) => (
          <PageCard key={page.index} page={page} onOpen={() => setActive(page)} />
        ))}
      </div>

      <FullscreenPage
        page={active}
        open={!!active}
        onOpenChange={(open) => {
          if (!open) setActive(null)
        }}
        onPageChange={setActive}
        form={form}
      />
    </>
  )
}
