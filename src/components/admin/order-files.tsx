import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ExternalLink, FileText, Film, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatBytes } from '@/lib/format'
import { toAppError } from '@/lib/errors'
import { orderFileUrl, orderFileUrls } from '@/services/orders.service'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Attachment, Json } from '@/types'

/** Signed URLs (1 h) for private order files, cached ~50 min. Map: path → URL. */
export function useOrderFileUrls(paths: (string | null | undefined)[]) {
  const clean = [...new Set(paths.filter((p): p is string => !!p))].sort()
  return useQuery({
    queryKey: ['signed-urls', 'order-deliverables', clean],
    queryFn: () => orderFileUrls(clean),
    enabled: clean.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
  })
}

/** Attachment arrays stored as jsonb (revisions, deliverables). */
export function readAttachments(value: Json | null | undefined): Attachment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return []
    const r = v as Record<string, Json | undefined>
    if (typeof r.path !== 'string') return []
    return [
      {
        path: r.path,
        name: typeof r.name === 'string' && r.name ? r.name : r.path.split('/').pop() ?? 'File',
        mime: typeof r.mime === 'string' ? r.mime : undefined,
        size: typeof r.size === 'number' ? r.size : undefined,
      },
    ]
  })
}

function iconFor(mime?: string | null) {
  if (mime?.startsWith('image/')) return ImageIcon
  if (mime?.startsWith('video/')) return Film
  return FileText
}

/** One private file: open (signed URL) + download with its original name. */
export function OrderFileRow({ path, name, mime, size, url, loading }: { path: string; name: string; mime?: string | null; size?: number | null; url?: string; loading?: boolean }) {
  const [busy, setBusy] = React.useState(false)
  const Icon = iconFor(mime)
  const download = async () => {
    setBusy(true)
    try {
      const href = await orderFileUrl(path, name)
      window.location.assign(href)
    } catch (e) {
      toast.error(toAppError(e).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <li className="flex items-center gap-3 rounded-control border border-line bg-surface p-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-subtle text-muted">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={name}>
          {name}
        </p>
        <p className="text-xs text-faint">{[mime, size ? formatBytes(size) : null].filter(Boolean).join(' · ') || 'File'}</p>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-16 rounded-pill" />
      ) : url ? (
        <Button asChild variant="ghost" size="xs">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Open<span className="sr-only"> {name} (opens in a new tab)</span>
          </a>
        </Button>
      ) : (
        <span className="text-xs text-faint">Unavailable</span>
      )}
      <Button variant="ghost" size="icon-xs" onClick={download} loading={busy} aria-label={`Download ${name}`}>
        {!busy && <Download />}
      </Button>
    </li>
  )
}

/** List of jsonb attachments with signed links. */
export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  const urls = useOrderFileUrls(attachments.map((a) => a.path))
  if (attachments.length === 0) return null
  return (
    <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {attachments.map((a) => (
        <OrderFileRow key={a.path} path={a.path} name={a.name} mime={a.mime} size={a.size} url={urls.data?.[a.path]} loading={urls.isLoading} />
      ))}
    </ul>
  )
}
