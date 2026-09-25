import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ExternalLink, FileText, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDate, formatDateTime, titleCase } from '@/lib/format'
import { getCreatorSetup, listCreatorVerifications, reviewVerification, verificationDocumentUrl, type AdminVerification } from '@/services/admin.service'
import { VERIFICATION_META } from '@/components/creator-studio/verification-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/states'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DetailCard } from './detail'
import { useAdminMutation } from './use-admin-mutation'
import type { VerificationStatus } from '@/services/creators.service'

const setupKeys = {
  detail: (id: string) => [...qk.admin.all, 'creator-setup', id] as const,
  verifications: (id: string) => [...qk.admin.all, 'creator-verifications', id] as const,
}

function Row({ label, done, value }: { label: string; done: boolean; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5 text-sm">
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full',
            done ? 'bg-success-soft text-success-ink' : 'bg-subtle text-faint',
          )}
          aria-hidden
        >
          {done ? <Check className="size-3" strokeWidth={3} /> : <Minus className="size-3" />}
        </span>
        <span className="truncate">{label}</span>
        <span className="sr-only">{done ? ' — set up' : ' — not set up'}</span>
      </span>
      <span className="shrink-0 text-sm text-muted tabular-nums">{value}</span>
    </div>
  )
}

/**
 * What this creator has provided since signup. Signup itself is deliberately
 * short, so these are collected later, feature by feature — this is where an
 * admin sees how far along they are.
 */
export function CreatorSetupCard({ creatorId }: { creatorId: string }) {
  const query = useQuery({ queryKey: setupKeys.detail(creatorId), queryFn: () => getCreatorSetup(creatorId) })

  if (query.isPending) return <Skeleton className="h-64 rounded-card" />
  if (query.isError) return <ErrorState compact error={query.error} title="Couldn’t load setup status" onRetry={() => void query.refetch()} />

  const s = query.data
  const verification: VerificationStatus | null = s.verified ? 'approved' : (s.verification?.status ?? null)
  const introVideo = s.completion?.items?.find((i) => i.key === 'intro_video')?.done ?? false

  return (
    <DetailCard title="Setup status" description="Collected progressively, after signup.">
      <div className="divide-y divide-line">
        <Row label="Public profile" done={s.status === 'published'} value={titleCase(String(s.status).replace('_', ' '))} />
        <Row
          label="Pricing & services"
          done={(s.services?.active ?? 0) > 0}
          value={`${s.services?.active ?? 0} active${s.services?.total ? ` of ${s.services.total}` : ''}`}
        />
        <Row label="Add-ons" done={(s.addons?.active ?? 0) > 0} value={`${s.addons?.active ?? 0}`} />
        <Row label="Portfolio" done={(s.portfolio?.visible ?? 0) > 0} value={`${s.portfolio?.visible ?? 0} visible`} />
        <Row
          label="Intro video"
          done={introVideo}
          value={introVideo ? 'Uploaded' : 'Not uploaded'}
        />
        <Row
          label="Payout account"
          done={s.payout?.configured ?? false}
          value={s.payout?.configured ? titleCase(String(s.payout.method_type).replace('_', ' ')) : 'Not set up'}
        />
        <Row label="Social accounts" done={(s.analytics?.accounts ?? 0) > 0} value={`${s.analytics?.accounts ?? 0}`} />
        <Row
          label="Identity verification"
          done={verification === 'approved'}
          value={verification ? VERIFICATION_META[verification].label : 'Not requested'}
        />
      </div>
    </DetailCard>
  )
}

function DocumentLink({ path }: { path: string }) {
  const [busy, setBusy] = React.useState(false)
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const url = await verificationDocumentUrl(path)
          if (url) window.open(url, '_blank', 'noopener,noreferrer')
        } finally {
          setBusy(false)
        }
      }}
    >
      <FileText /> Open document
      <ExternalLink className="size-3.5" />
    </Button>
  )
}

function VerificationRow({ row, creatorId }: { row: AdminVerification; creatorId: string }) {
  const [decision, setDecision] = React.useState<'approved' | 'rejected' | 'more_info' | null>(null)
  const meta = VERIFICATION_META[row.status as VerificationStatus]
  const open = row.status === 'pending' || row.status === 'more_info'

  const review = useAdminMutation((vars: { status: 'approved' | 'rejected' | 'more_info'; reason?: string }) => reviewVerification(row.id, vars.status, vars.reason), {
    invalidate: [setupKeys.verifications(creatorId), setupKeys.detail(creatorId), qk.admin.creator(creatorId), qk.admin.all],
    success: (_d, v) => (v.status === 'approved' ? 'Creator verified' : v.status === 'rejected' ? 'Verification rejected' : 'Asked for more information'),
    onSuccess: () => setDecision(null),
  })

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{row.legal_name}</p>
          <p className="text-xs text-muted">Submitted {formatDateTime(row.submitted_at)}</p>
        </div>
        <Badge tone={meta.tone} size="sm" dot>
          {meta.label}
        </Badge>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {row.document_type && (
          <div className="flex gap-2">
            <dt className="text-muted">Document</dt>
            <dd>
              {titleCase(row.document_type.replace('_', ' '))}
              {row.document_number_last4 ? ` ····${row.document_number_last4}` : ''}
            </dd>
          </div>
        )}
        {row.date_of_birth && (
          <div className="flex gap-2">
            <dt className="text-muted">Born</dt>
            <dd>{formatDate(row.date_of_birth)}</dd>
          </div>
        )}
        {(row.address_line || row.city) && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="text-muted">Address</dt>
            <dd className="min-w-0">{[row.address_line, row.city, row.state, row.postal_code].filter(Boolean).join(', ')}</dd>
          </div>
        )}
      </dl>

      {row.note && <p className="rounded-control bg-subtle px-3 py-2 text-sm whitespace-pre-line">{row.note}</p>}
      {row.review_note && (
        <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning">
          <span className="font-medium">Our note:</span> {row.review_note}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {row.document_path && <DocumentLink path={row.document_path} />}
        {open && (
          <>
            <Button type="button" size="sm" loading={review.isPending && review.variables?.status === 'approved'} onClick={() => review.mutate({ status: 'approved' })}>
              Approve
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setDecision('more_info')}>
              Ask for more
            </Button>
            <Button type="button" size="sm" variant="danger-ghost" onClick={() => setDecision('rejected')}>
              Reject
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={decision === 'rejected' || decision === 'more_info'}
        onOpenChange={(o) => !o && setDecision(null)}
        title={decision === 'rejected' ? 'Reject this verification?' : 'Ask for more information?'}
        description={
          decision === 'rejected'
            ? 'The creator is notified and can submit again. Tell them what was wrong.'
            : 'The creator is notified and can add what’s missing to the same request.'
        }
        confirmLabel={decision === 'rejected' ? 'Reject' : 'Send request'}
        destructive={decision === 'rejected'}
        reasonRequired
        reasonLabel="Note to the creator"
        loading={review.isPending}
        onConfirm={(reason) => review.mutate({ status: decision!, reason })}
      />
    </li>
  )
}

export function CreatorVerificationsCard({ creatorId }: { creatorId: string }) {
  const query = useQuery({ queryKey: setupKeys.verifications(creatorId), queryFn: () => listCreatorVerifications(creatorId) })

  if (query.isPending) return <Skeleton className="h-40 rounded-card" />
  if (query.isError) return <ErrorState compact error={query.error} title="Couldn’t load verifications" onRetry={() => void query.refetch()} />
  if (query.data.length === 0) return null

  return (
    <DetailCard title="Identity verification" description="Requested by the creator. We keep only the last four characters of any document number.">
      <ul className="divide-y divide-line">
        {query.data.map((row) => (
          <VerificationRow key={row.id} row={row} creatorId={creatorId} />
        ))}
      </ul>
    </DetailCard>
  )
}
