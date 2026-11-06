import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link2, RefreshCw, Sheet } from 'lucide-react'
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { creatorsLiveLinkUrl, getCreatorsLiveLink, setCreatorsLiveLink } from '@/services/account-csv.service'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/states'
import { Notice } from './form-dialog'
import { CopyButton } from './detail'

/**
 * Admin → Creators → More → Live link: one address that always returns the
 * current creators spreadsheet (the same columns as Export CSV), for a Google
 * Sheet (=IMPORTDATA) or an Excel workbook (Data → From Web) that stays up to
 * date by itself. Off until an admin turns it on; anyone with the link can read
 * it, so it can be replaced or turned off at any time (migration 0046).
 */
export function CreatorsLiveLinkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const link = useQuery({ queryKey: qk.admin.creatorsLiveLink, queryFn: getCreatorsLiveLink, enabled: open })
  const [confirm, setConfirm] = React.useState<'new' | 'off' | null>(null)
  const change = useMutation({
    mutationFn: setCreatorsLiveLink,
    onSuccess: (data, on) => {
      queryClient.setQueryData(qk.admin.creatorsLiveLink, data)
      setConfirm(null)
      toast.success(on ? 'Live link ready. Copy it into your sheet.' : 'Live link turned off. Sheets using it stop updating.')
    },
  })

  const url = link.data ? creatorsLiveLinkUrl(link.data.key) : ''
  const formula = `=IMPORTDATA("${url}")`
  // Google keeps an IMPORTDATA result for about an hour. Rewriting the formula with a
  // new "&t=" each time the sheet opens makes it fetch afresh; the feed ignores "t".
  const script = [
    `const LINK = '${url}'`,
    '',
    '// Runs each time the sheet is opened by someone who can edit it.',
    'function onOpen() {',
    '  refreshCreators()',
    "  SpreadsheetApp.getUi().createMenu('House of Collabs').addItem('Refresh creators now', 'refreshCreators').addToUi()",
    '}',
    '',
    'function refreshCreators() {',
    "  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]",
    "  sheet.getRange('A1').setFormula('=IMPORTDATA(\"' + LINK + '&t=' + Date.now() + '\")')",
    '}',
  ].join('\n')

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        title="Live link for Excel and Google Sheets"
        description="One link that always opens the latest creators list, with the same columns as Export CSV. No more downloading a new file."
        footer={
          link.data ? (
            <div className="flex w-full flex-wrap justify-between gap-2">
              <Button variant="danger-ghost" onClick={() => setConfirm('off')}>
                Turn off
              </Button>
              <Button variant="secondary" onClick={() => setConfirm('new')}>
                <RefreshCw /> Make a new link
              </Button>
            </div>
          ) : undefined
        }
      >
        {link.isPending ? (
          <Skeleton className="h-40 rounded-card" />
        ) : link.isError ? (
          <ErrorState error={link.error} onRetry={() => void link.refetch()} compact />
        ) : !link.data ? (
          <div className="space-y-4">
            <Notice tone="warning">
              Anyone who has the link can see every creator’s email and WhatsApp number. Share it only inside the team. You can replace it or turn it off at any
              time.
            </Notice>
            <Button loading={change.isPending} onClick={() => change.mutate(true)}>
              {!change.isPending && <Link2 />} Create live link
            </Button>
          </div>
        ) : (
          <div className="space-y-5 text-sm">
            <div>
              <p className="mb-1.5 font-medium">Your link</p>
              <div className="flex items-center gap-2">
                <Input value={url} readOnly aria-label="Live link" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <CopyButton value={url} label="Copy link" />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Opened in any browser, it downloads the latest list as a file that opens in Excel, Numbers or Google Sheets.
              </p>
              <p className="mt-1 text-xs text-muted">
                Made {formatDateTime(link.data.created_at)} ·{' '}
                {link.data.uses > 0 ? `opened ${formatNumber(link.data.uses)} time${link.data.uses === 1 ? '' : 's'}, last ${formatRelative(link.data.last_used_at)}` : 'not opened yet'}
              </p>
            </div>

            <div className="rounded-control border border-line p-4">
              <p className="flex items-center gap-2 font-medium">
                <Sheet className="size-4" aria-hidden /> Google Sheets
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">
                <li>Open a new Google Sheet.</li>
                <li className="break-all">
                  Click cell A1 and paste this formula: <code className="rounded bg-subtle px-1 py-0.5 font-mono text-xs">{formula}</code>{' '}
                  <CopyButton value={formula} label="Copy formula" />
                </li>
                <li>Press Enter. The whole list appears. On its own, Google refreshes it about every hour.</li>
                <li>
                  To get the latest data <b>every time the sheet opens</b>: <b>Extensions → Apps Script</b>, delete what’s there, paste this script{' '}
                  <CopyButton value={script} label="Copy script" />, click Save, then reopen the sheet and allow it once. It also adds a{' '}
                  <b>House of Collabs → Refresh creators now</b> menu.
                </li>
              </ol>
              <p className="mt-2 text-xs text-muted">
                Google only runs the script for people who can edit the sheet; people with view access see the data as of the last refresh.
              </p>
              <p className="mt-2 text-xs text-muted">
                Tip: share <b>this Google Sheet</b> (Share button) rather than the link above. Anyone you add opens it straight in Google Sheets, on a laptop or
                phone, and you can remove people one at a time.
              </p>
            </div>

            <div className="rounded-control border border-line p-4">
              <p className="flex items-center gap-2 font-medium">
                <Sheet className="size-4" aria-hidden /> Excel
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">
                <li>
                  Go to <b>Data → From Web</b> (in some versions <b>Data → Get Data → From Other Sources → From Web</b>).
                </li>
                <li>Paste the link, click OK, then Load.</li>
                <li>
                  To get the latest data <b>every time the file opens</b>: <b>Data → Queries &amp; Connections</b>, right-click the query →{' '}
                  <b>Properties</b> → tick <b>Refresh data when opening the file</b> (and, if you like, <b>Refresh every 60 minutes</b>). Any time
                  in between: <b>Data → Refresh All</b>.
                </li>
              </ol>
            </div>

            <Notice tone="warning">
              Anyone who has this link can see every creator’s email and WhatsApp number. Share it only inside the team. If it gets out, make a new link: the
              old one stops working at once.
            </Notice>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'off' ? 'Turn off the live link?' : 'Make a new live link?'}
        description={
          confirm === 'off'
            ? 'The current link stops working at once, and every sheet using it stops updating. You can create a new one later.'
            : 'The current link stops working at once. Every sheet using it needs the new link pasted in.'
        }
        confirmLabel={confirm === 'off' ? 'Turn off' : 'Make a new link'}
        destructive={confirm === 'off'}
        loading={change.isPending}
        onConfirm={() => change.mutate(confirm === 'new')}
      />
    </>
  )
}
