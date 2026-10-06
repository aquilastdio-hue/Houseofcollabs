import * as React from 'react'
import { useNavigate } from 'react-router'
import { Ban, ShieldCheck, Trash2 } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { accountAction, type AccountAction } from '@/services/admin.service'
import { adminLists } from './admin-keys'
import { useAdminMutation } from './use-admin-mutation'
import { DetailCard } from './detail'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

/**
 * Suspend, revoke and delete, for a creator or a brand.
 *
 * These reach Supabase Auth, not just `profiles.status`. Flipping the status
 * alone blocks writes and shows the suspended screen, but the person can still
 * sign in; suspending here bans the auth user, so they cannot.
 *
 * Deleting is permanent and is allowed to fail. Orders, earnings and payout
 * requests reference creators and brands with ON DELETE RESTRICT, so Postgres
 * refuses to remove anyone who has traded — the server turns that into an
 * explanation rather than a constraint error, and there is deliberately no way
 * to force it.
 */
export function AccountActionsPanel({
  profileId,
  name,
  status,
  /** Where to go once the account no longer exists. */
  afterDelete,
}: {
  profileId: string
  name: string
  status: string
  afterDelete: string
}) {
  const [pending, setPending] = React.useState<AccountAction | null>(null)
  const navigate = useNavigate()
  const suspended = status === 'suspended'

  const run = useAdminMutation((v: { action: AccountAction; reason: string }) => accountAction(profileId, v.action, v.reason), {
    invalidate: [qk.admin.all, adminLists.creators, adminLists.brands, qk.admin.stats],
    success: (_d, v) =>
      v.action === 'suspend'
        ? `${name} can no longer sign in`
        : v.action === 'reactivate'
          ? `${name} can sign in again`
          : `${name}’s account was deleted`,
    onSuccess: (_d, v) => {
      setPending(null)
      // The record is gone — staying on its page would 404 on the next fetch.
      if (v.action === 'delete') void navigate(afterDelete, { replace: true })
    },
  })

  const COPY: Record<AccountAction, { title: string; description: string; confirm: string; destructive?: boolean; reasonLabel?: string }> = {
    suspend: {
      title: `Suspend ${name}?`,
      description:
        'They are signed out and cannot log back in. Their profile disappears from the marketplace, but every record — orders, earnings, messages — is kept exactly as it is. Reversible at any time.',
      confirm: 'Suspend account',
      destructive: true,
      reasonLabel: 'Reason (sent to them, and recorded)',
    },
    reactivate: {
      title: `Revoke the suspension on ${name}?`,
      description: 'They can sign in again and pick up exactly where they left off. Nothing was lost while they were suspended.',
      confirm: 'Revoke suspension',
      reasonLabel: 'Note (optional, recorded in the audit log)',
    },
    delete: {
      title: `Permanently delete ${name}?`,
      description:
        'This cannot be undone. Their login, profile and storefront are erased. If they have ever had an order, earning or payout, the deletion will be refused — those records are part of the platform’s financial history, and you should suspend instead.',
      confirm: 'Delete permanently',
      destructive: true,
      reasonLabel: 'Reason (recorded in the audit log)',
    },
  }

  const action = pending
  const copy = action ? COPY[action] : null

  return (
    <DetailCard title="Account access" description="These take effect at sign-in, not just in the app. Every action is logged.">
      <div className="grid gap-2">
        {suspended ? (
          <Button size="sm" block className="justify-start" onClick={() => setPending('reactivate')}>
            <ShieldCheck /> Revoke suspension
          </Button>
        ) : (
          <Button size="sm" block variant="secondary" className="justify-start" onClick={() => setPending('suspend')}>
            <Ban /> Suspend account
          </Button>
        )}
        <Button size="sm" block variant="danger-ghost" className="justify-start" onClick={() => setPending('delete')}>
          <Trash2 /> Delete permanently
        </Button>
        <p className="px-1 text-xs text-muted">
          {suspended
            ? 'Suspended — they cannot sign in.'
            : 'Suspending keeps everything; deleting keeps nothing and is refused for accounts with orders.'}
        </p>
      </div>

      {action && copy && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          title={copy.title}
          description={copy.description}
          confirmLabel={copy.confirm}
          destructive={copy.destructive}
          loading={run.isPending}
          reasonLabel={copy.reasonLabel}
          reasonRequired={action !== 'reactivate'}
          onConfirm={(reason) => run.mutate({ action, reason })}
        />
      )}
    </DetailCard>
  )
}
