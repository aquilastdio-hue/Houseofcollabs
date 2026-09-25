import { Download, ExternalLink, FileText, Film } from 'lucide-react'
import { formatBytes, formatDateTime } from '@/lib/format'
import { useSignedUrls } from '@/hooks/use-signed-url'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/states'
import type { OrderDeliverable, OrderRevision } from '@/types'

function FilePreview({ d, url }: { d: OrderDeliverable; url?: string }) {
  const mime = d.mime_type ?? ''
  if (!url) return <Skeleton className="aspect-video w-full" />
  if (mime.startsWith('image/')) return <img src={url} alt={d.file_name ?? 'Deliverable'} className="aspect-video w-full rounded-control bg-subtle object-contain" loading="lazy" />
  if (mime.startsWith('video/')) return <video src={url} controls preload="metadata" className="aspect-video w-full rounded-control bg-night" />
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-control bg-subtle text-muted">
      <FileText className="size-8" />
    </div>
  )
}

/** Deliverables grouped by delivery round; private files via signed URLs. */
export function DeliverablesList({ deliverables, revisions }: { deliverables: OrderDeliverable[]; revisions: OrderRevision[] }) {
  const urls = useSignedUrls('order-deliverables', deliverables.map((d) => d.storage_path))
  if (deliverables.length === 0) {
    return <EmptyState compact icon={<Film />} title="No deliveries yet" description="Files and links the creator delivers will appear here." />
  }
  const rounds = [...new Set(deliverables.map((d) => d.round))].sort((a, b) => b - a)
  return (
    <div className="space-y-6">
      {rounds.map((round) => {
        const items = deliverables.filter((d) => d.round === round)
        const revision = revisions.find((r) => r.id === items[0]?.revision_id)
        const note = items.find((d) => d.note)?.note
        return (
          <div key={round}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {round === 1 ? 'Original delivery' : `Revision ${revision?.revision_number ?? round - 1}`}
                {round === rounds[0] && <span className="ml-2 rounded-pill bg-brand px-2 py-0.5 text-xs font-semibold text-white">Latest</span>}
              </p>
              <p className="text-xs text-faint">{formatDateTime(items[0]!.created_at)}</p>
            </div>
            {note && <p className="mb-3 rounded-control bg-subtle p-3 text-sm text-ink-soft">“{note}”</p>}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((d) =>
                d.external_url ? (
                  <li key={d.id} className="flex items-center gap-3 rounded-control border border-line p-3">
                    <ExternalLink className="size-4 shrink-0 text-muted" />
                    <a href={d.external_url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium underline underline-offset-2">
                      {d.file_name && d.file_name !== d.external_url ? d.file_name : d.external_url}
                    </a>
                  </li>
                ) : (
                  <li key={d.id} className="overflow-hidden rounded-control border border-line p-2">
                    <FilePreview d={d} url={urls.data?.[d.storage_path!]} />
                    <div className="mt-2 flex items-center justify-between gap-2 px-1">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.file_name}</p>
                        <p className="text-xs text-faint">{formatBytes(d.size_bytes)}</p>
                      </div>
                      {urls.data?.[d.storage_path!] && (
                        <a
                          href={urls.data[d.storage_path!]}
                          download={d.file_name ?? true}
                          target="_blank"
                          rel="noreferrer"
                          className="focus-ring flex size-8 items-center justify-center rounded-full hover:bg-subtle"
                          aria-label={`Download ${d.file_name}`}
                        >
                          <Download className="size-4" />
                        </a>
                      )}
                    </div>
                  </li>
                ),
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export function RevisionsList({ revisions, revisionsAllowed }: { revisions: OrderRevision[]; revisionsAllowed: number }) {
  const attachmentPaths = revisions.flatMap((r) => ((r.attachments as { path: string }[] | null) ?? []).map((a) => a.path))
  const urls = useSignedUrls('order-deliverables', attachmentPaths)
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {revisions.length} of {revisionsAllowed} revision{revisionsAllowed === 1 ? '' : 's'} used
      </p>
      {[...revisions].reverse().map((r) => (
        <div key={r.id} className="rounded-control border border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Revision {r.revision_number}</p>
            <span className="text-xs text-faint">{formatDateTime(r.created_at)}</span>
          </div>
          <p className="mt-1 text-sm">{r.reason}</p>
          {r.instructions && <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{r.instructions}</p>}
          {((r.attachments as { path: string; name: string }[] | null) ?? []).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {((r.attachments as { path: string; name: string }[]) ?? []).map((a) => (
                <li key={a.path}>
                  <a href={urls.data?.[a.path]} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">
            Status: <span className="font-medium text-ink">{r.status}</span>
            {r.submitted_at && ` · submitted ${formatDateTime(r.submitted_at)}`}
          </p>
        </div>
      ))}
    </div>
  )
}
