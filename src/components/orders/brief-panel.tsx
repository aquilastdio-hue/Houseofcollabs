import { ExternalLink, FileText, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatINR } from '@/lib/format'
import { toAppError } from '@/lib/errors'
import { briefAttachmentUrl } from '@/services/briefs.service'
import { Badge } from '@/components/ui/badge'
import type { BriefAttachment, Json } from '@/types'

type Snapshot = {
  title?: string
  campaign_objective?: string | null
  product_name?: string | null
  product_description?: string | null
  product_url?: string | null
  content_type?: string | null
  deliverables?: string | null
  target_audience?: string | null
  tone?: string | null
  reference_links?: string[]
  talking_points?: string[]
  do_not_say?: string[]
  deadline?: string | null
  budget?: number | null
  usage_rights?: string | null
  platform?: string | null
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-faint">{label}</dt>
      <dd className="mt-0.5 text-sm whitespace-pre-wrap text-ink-soft">{children}</dd>
    </div>
  )
}

/** Brief as agreed at checkout (snapshot) + live attachments + extra requirements. */
export function BriefPanel({ snapshot, requirements, attachments = [] }: { snapshot: Json | null; requirements: string | null; attachments?: BriefAttachment[] }) {
  const b = (snapshot ?? {}) as Snapshot
  const hasBrief = !!b.title
  if (!hasBrief && !requirements) {
    return <p className="text-sm text-muted">No brief was attached to this order. Use messages to align on details.</p>
  }
  return (
    <div className="space-y-5">
      {hasBrief && (
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted" />
          <p className="font-display text-lg font-semibold">{b.title}</p>
        </div>
      )}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {b.campaign_objective && <Row label="Objective">{b.campaign_objective}</Row>}
        {requirements && <Row label="Requirements">{requirements}</Row>}
        {(b.product_name || b.product_description) && (
          <Row label="Product">
            {b.product_name}
            {b.product_description && <span className="block text-muted">{b.product_description}</span>}
            {b.product_url && (
              <a href={b.product_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-ink underline underline-offset-2">
                Product page <ExternalLink className="size-3" />
              </a>
            )}
          </Row>
        )}
        {b.deliverables && <Row label="Deliverables">{b.deliverables}</Row>}
        {b.target_audience && <Row label="Target audience">{b.target_audience}</Row>}
        {b.tone && <Row label="Tone">{b.tone}</Row>}
        {b.platform && <Row label="Platform">{b.platform}</Row>}
        {b.usage_rights && <Row label="Usage rights">{b.usage_rights}</Row>}
        {b.deadline && <Row label="Deadline">{formatDate(b.deadline)}</Row>}
        {b.budget != null && <Row label="Budget">{formatINR(b.budget)}</Row>}
      </dl>
      {!!b.talking_points?.length && (
        <div>
          <p className="mb-2 text-xs font-medium text-faint">Mandatory talking points</p>
          <ul className="space-y-1.5">
            {b.talking_points.map((t) => (
              <li key={t} className="flex gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink" /> {t}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!b.do_not_say?.length && (
        <div>
          <p className="mb-2 text-xs font-medium text-faint">Please don’t say</p>
          <div className="flex flex-wrap gap-1.5">
            {b.do_not_say.map((t) => (
              <Badge key={t} tone="danger" size="sm">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {!!b.reference_links?.length && (
        <div>
          <p className="mb-2 text-xs font-medium text-faint">References</p>
          <ul className="space-y-1">
            {b.reference_links.map((l) => (
              <li key={l}>
                <a href={l} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-sm underline underline-offset-2">
                  {l} <ExternalLink className="size-3 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {attachments.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-faint">Attachments</p>
          <ul className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="focus-ring inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 text-sm hover:border-line-strong"
                  onClick={async () => {
                    try {
                      window.open(await briefAttachmentUrl(a.storage_path, a.file_name), '_blank', 'noopener')
                    } catch (e) {
                      toast.error(toAppError(e).message)
                    }
                  }}
                >
                  <Paperclip className="size-3.5" /> {a.file_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
