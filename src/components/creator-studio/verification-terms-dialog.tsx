import * as React from 'react'
import { Link } from 'react-router'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePlatformTerms } from '@/components/marketing/platform-terms'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { LEGAL_PROSE } from '@/pages/public/legal'
import { VERIFICATION_TERMS_DATE, verificationTerms } from '@/pages/public/legal/verification-terms'

/**
 * The Creator Verification Terms (the /verification-terms page) in a popup.
 * "I agree" unlocks once the creator has scrolled to the end, or straight
 * away if the whole text fits without scrolling.
 */
export function VerificationTermsDialog({
  open,
  onOpenChange,
  onAgree,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAgree: () => void
}) {
  const { terms } = usePlatformTerms()
  const doc = verificationTerms(terms)
  const scroller = React.useRef<HTMLDivElement | null>(null)
  const [atEnd, setAtEnd] = React.useState(false)

  const check = React.useCallback(() => {
    const el = scroller.current
    if (el) setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 16)
  }, [])
  // Measured once the dialog has laid out; each opening starts from the top.
  const attach = React.useCallback(
    (el: HTMLDivElement | null) => {
      scroller.current = el
      if (el) requestAnimationFrame(check)
    },
    [check],
  )
  React.useEffect(() => {
    if (open) setAtEnd(false)
  }, [open])

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={doc.title}
      description={`Version of ${VERIFICATION_TERMS_DATE}. Read to the end to agree.`}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/verification-terms" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            Open as a page <ExternalLink className="size-3.5" aria-hidden />
          </Link>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {!atEnd && <p className="text-xs text-muted sm:mr-2">Scroll to the end to agree</p>}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!atEnd}
              onClick={() => {
                onAgree()
                onOpenChange(false)
              }}
            >
              I agree
            </Button>
          </div>
        </div>
      }
    >
      <div
        ref={attach}
        onScroll={check}
        tabIndex={0}
        role="document"
        aria-label={doc.title}
        className="focus-ring max-h-[55vh] space-y-6 overflow-y-auto rounded-control border border-line bg-subtle/40 p-4 sm:p-5"
      >
        <div className={LEGAL_PROSE}>{doc.intro}</div>
        {doc.sections.map((section, i) => (
          <section key={section.id} aria-labelledby={`vt-${section.id}`}>
            <h3 id={`vt-${section.id}`} className="font-display text-lg font-semibold tracking-tight text-ink">
              <span className="mr-1.5 text-faint tabular-nums">{i + 1}.</span>
              {section.title}
            </h3>
            <div className={cn(LEGAL_PROSE, 'mt-2')}>{section.body}</div>
          </section>
        ))}
      </div>
    </Modal>
  )
}
