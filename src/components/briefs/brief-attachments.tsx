import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, File, FileArchive, FileImage, FileSpreadsheet, FileText, FileVideo, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { fileExtension } from '@/lib/utils'
import { formatBytes, formatDate } from '@/lib/format'
import { toAppError } from '@/lib/errors'
import { qk } from '@/lib/query-keys'
import { useSignedUrls } from '@/hooks/use-signed-url'
import { briefAttachmentUrl, deleteBriefAttachment, uploadBriefAttachment, type BriefDetail } from '@/services/briefs.service'
import type { BriefAttachment } from '@/types'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { FileUploader } from '@/components/shared/file-uploader'

function AttachmentIcon({ mime, name }: { mime: string | null; name: string }) {
  const ext = fileExtension(name)
  const cls = 'size-4'
  if (mime?.startsWith('image/')) return <FileImage className={cls} />
  if (mime?.startsWith('video/')) return <FileVideo className={cls} />
  if (ext === 'zip') return <FileArchive className={cls} />
  if (['xls', 'xlsx'].includes(ext)) return <FileSpreadsheet className={cls} />
  if (['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx'].includes(ext)) return <FileText className={cls} />
  return <File className={cls} />
}

/** Private brief files: open via signed URL, download with the original name. */
export function BriefAttachmentList({
  attachments,
  onRemove,
}: {
  attachments: BriefAttachment[]
  onRemove?: (attachment: BriefAttachment) => void
}) {
  const urls = useSignedUrls(
    'brief-attachments',
    attachments.map((a) => a.storage_path),
  )
  const [downloading, setDownloading] = React.useState<string | null>(null)

  const download = async (att: BriefAttachment) => {
    setDownloading(att.id)
    try {
      const url = await briefAttachmentUrl(att.storage_path, att.file_name)
      const link = document.createElement('a')
      link.href = url
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (e) {
      toast.error(toAppError(e).message)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {attachments.map((att) => {
        const url = urls.data?.[att.storage_path]
        const isImage = !!att.mime_type?.startsWith('image/')
        return (
          <li key={att.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-control bg-subtle text-muted">
              {isImage && url ? (
                <img src={url} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                <AttachmentIcon mime={att.mime_type} name={att.file_name} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring block truncate rounded text-sm font-medium underline-offset-4 hover:underline"
                  title={`Open ${att.file_name}`}
                >
                  {att.file_name}
                </a>
              ) : (
                <p className="truncate text-sm font-medium">{att.file_name}</p>
              )}
              <p className="text-xs text-muted">
                {[att.size_bytes != null ? formatBytes(att.size_bytes) : null, `Added ${formatDate(att.created_at)}`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Download ${att.file_name}`}
              disabled={downloading === att.id}
              onClick={() => void download(att)}
            >
              {downloading === att.id ? <Spinner className="size-4" label="Preparing download" /> : <Download />}
            </Button>
            {onRemove && (
              <Button type="button" variant="danger-ghost" size="icon-sm" aria-label={`Remove ${att.file_name}`} onClick={() => onRemove(att)}>
                <Trash2 />
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Editor attachments: existing files (removable with confirmation) plus the
 * drag-and-drop uploader. Files uploaded in this session stay in the
 * uploader's list (× there removes them again) instead of being listed twice.
 */
export function BriefAttachmentsManager({ brief, userId }: { brief: BriefDetail; userId: string }) {
  const qc = useQueryClient()
  const [sessionIds, setSessionIds] = React.useState<string[]>([])
  const [confirm, setConfirm] = React.useState<BriefAttachment | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.briefs.detail(brief.id) })
    void qc.invalidateQueries({ queryKey: ['briefs', 'list'] })
  }

  const remove = useMutation({
    mutationFn: (att: BriefAttachment) => deleteBriefAttachment(att),
    onSuccess: (_d, att) => toast.success(`Removed ${att.file_name}`),
    onSettled: refresh,
  })

  const existing = [...brief.brief_attachments]
    .filter((a) => !sessionIds.includes(a.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <div className="space-y-4">
      {existing.length > 0 && <BriefAttachmentList attachments={existing} onRemove={setConfirm} />}
      <FileUploader<BriefAttachment>
        bucket="brief-attachments"
        upload={(file) => uploadBriefAttachment(brief.id, userId, file)}
        onUploaded={(att) => {
          setSessionIds((ids) => [...ids, att.id])
          refresh()
        }}
        onRemove={(item) => {
          const att = item.status === 'done' ? item.result : undefined
          if (!att) return
          remove.mutate(att, { onError: () => setSessionIds((ids) => ids.filter((id) => id !== att.id)) })
        }}
        label="Drag files here or browse"
        hint="Mood boards, product sheets, guidelines or sample videos · up to 25 MB each"
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Remove this attachment?"
        description={confirm ? `“${confirm.file_name}” will be deleted for everyone who can see this brief.` : undefined}
        confirmLabel="Remove file"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (confirm) remove.mutate(confirm, { onSuccess: () => setConfirm(null) })
        }}
      />
    </div>
  )
}
