import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Ellipsis, FileSpreadsheet, Upload } from 'lucide-react'
import { downloadCsv, toCsv } from '@/lib/csv'
import { toAppError } from '@/lib/errors'
import { formatNumber } from '@/lib/format'
import { istParts } from '@/lib/india-time'
import { qk } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  readImportFile,
  templateCsv,
  type AccountKind,
  type ImportProblem,
  type ImportRow,
} from '@/lib/account-import'
import { importAccounts, type ImportResult } from '@/services/account-csv.service'
import { useCategories } from '@/hooks/use-catalog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox'
import { Modal } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'

const NOUN: Record<AccountKind, [one: string, many: string]> = {
  creator: ['creator', 'creators'],
  brand: ['brand', 'brands'],
}
const count = (kind: AccountKind, n: number) => `${formatNumber(n)} ${NOUN[kind][n === 1 ? 0 : 1]}`
const today = () => istParts(new Date().toISOString()).date

/**
 * Admin → Creators / Brands, right of the filters: "More" → Export CSV (the
 * list as a spreadsheet) or Upload CSV (a spreadsheet of new people, each
 * added as an approved account).
 */
export function AccountCsvMenu({ kind, onExport }: { kind: AccountKind; onExport: () => Promise<{ csv: string; count: number }> }) {
  const [exporting, setExporting] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)

  async function runExport() {
    setExporting(true)
    try {
      const file = await onExport()
      downloadCsv(`house-of-collabs-${NOUN[kind][1]}-${today()}.csv`, file.csv)
      toast.success(`Downloaded ${count(kind, file.count)}. It opens in Google Sheets or Excel.`)
    } catch (e) {
      toast.error(toAppError(e).message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" loading={exporting}>
            {/* Icon only on phones, where it shares a row with the search and Filters. */}
            <Ellipsis /> <span className="max-sm:sr-only">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void runExport()}>
            <Download /> Export CSV
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setUploading(true)}>
            <Upload /> Upload CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UploadDialog kind={kind} open={uploading} onOpenChange={setUploading} />
    </>
  )
}

type Picked = {
  name: string
  rows: (ImportRow & { line: number })[]
  problems: ImportProblem[]
}

function UploadDialog({ kind, open, onOpenChange }: { kind: AccountKind; open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient()
  const input = React.useRef<HTMLInputElement>(null)
  const [picked, setPicked] = React.useState<Picked | null>(null)
  const [invite, setInvite] = React.useState(true)
  const [running, setRunning] = React.useState(false)
  const [done, setDone] = React.useState(0)
  const [results, setResults] = React.useState<ImportResult[] | null>(null)
  const [one, many] = NOUN[kind]
  const categories = useCategories()

  // Categories the file names that aren't on the list. They don't stop anyone
  // being added; the creator just starts without them and picks their own.
  const unmatched = React.useMemo(() => {
    if (kind !== 'creator' || !picked || !categories.data) return []
    const known = new Set(categories.data.map((c) => c.name.trim().toLowerCase()))
    return [...new Set(picked.rows.flatMap((r) => r.categories ?? []).filter((c) => !known.has(c.toLowerCase())))]
  }, [kind, picked, categories.data])

  function close(next: boolean) {
    if (running) return // closing mid-way would lose track of what's been added
    onOpenChange(next)
    if (!next) {
      setPicked(null)
      setResults(null)
      setDone(0)
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return
    if (input.current) input.current.value = ''
    if (file.size > 5 * 1024 * 1024) return toast.error('That file is over 5 MB. Split it into smaller files.')
    setPicked({ name: file.name, ...readImportFile(await file.text(), kind) })
  }

  async function start() {
    if (!picked?.rows.length) return
    setRunning(true)
    setDone(0)
    try {
      setResults(await importAccounts(kind, picked.rows, invite, setDone))
      void qc.invalidateQueries({ queryKey: qk.admin.all })
    } catch (e) {
      toast.error(toAppError(e).message)
    } finally {
      setRunning(false)
    }
  }

  const total = picked?.rows.length ?? 0
  const created = results?.filter((r) => r.status === 'created') ?? []
  const notAdded = results?.filter((r) => r.status !== 'created') ?? []
  const notEmailed = created.filter((r) => invite && !r.emailed)

  const footer = results ? (
    <>
      <Button
        variant="secondary"
        onClick={() =>
          downloadCsv(
            `house-of-collabs-${many}-upload-report-${today()}.csv`,
            toCsv(
              ['Line', 'Email', 'Result', 'Note'],
              results.map((r) => [r.line, r.email, r.status, r.message ?? '']),
            ),
          )
        }
      >
        <FileSpreadsheet /> Download report
      </Button>
      <Button onClick={() => close(false)}>Done</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={() => close(false)} disabled={running}>
        Cancel
      </Button>
      <Button onClick={() => void start()} disabled={!total} loading={running}>
        Add {count(kind, total)}
      </Button>
    </>
  )

  return (
    <Modal
      open={open}
      onOpenChange={close}
      size="lg"
      title={`Upload ${many}`}
      description={`Each row becomes an approved ${one} account straight away, with no application to review.${kind === 'creator' ? ' Their storefront goes live on the marketplace.' : ''}`}
      footer={footer}
    >
      {results ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Added" value={created.length} tone="text-success" />
            <Stat label="Not added" value={notAdded.length} tone={notAdded.length ? 'text-danger' : undefined} />
            {invite && <Stat label="Set-password emails sent" value={created.length - notEmailed.length} />}
          </div>
          {[...notAdded, ...notEmailed].length > 0 && <ResultList rows={[...notAdded, ...notEmailed].sort((a, b) => a.line - b.line)} />}
        </div>
      ) : running ? (
        <div className="space-y-3 py-4">
          <p className="text-sm font-medium">
            Adding {formatNumber(done)} of {count(kind, total)}…
          </p>
          <Progress value={(done / total) * 100} tone="brand" />
          <p className="text-xs text-muted">Keep this window open until it finishes.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2 text-sm">
            <p className="text-ink-soft">A CSV with these columns. Only the starred ones are needed, and other columns are ignored:</p>
            <div className="flex flex-wrap gap-1.5">
              {IMPORT_COLUMNS[kind].map((c) => (
                <Badge key={c.key} size="sm" tone={c.required ? 'brand-soft' : 'outline'}>
                  {c.header}
                  {c.required && ' *'}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted">
              From Google Sheets: File → Download → Comma-separated values (.csv). Up to {formatNumber(MAX_IMPORT_ROWS)} rows at a time. People who
              already have an account are skipped.{' '}
              <button
                type="button"
                className="focus-ring rounded-sm font-medium text-ink underline underline-offset-2"
                onClick={() => downloadCsv(`house-of-collabs-${many}-template.csv`, templateCsv(kind))}
              >
                Download the template
              </button>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-line-strong p-4">
            <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
              <Upload /> {picked ? 'Choose another file' : 'Choose CSV file'}
            </Button>
            <span className="min-w-0 truncate text-sm text-muted">{picked?.name ?? 'No file chosen'}</span>
          </div>

          {picked && (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium text-ink">{count(kind, total)}</span> ready to add
                {picked.problems.length > 0 && (
                  <>
                    {' · '}
                    <span className="text-danger">
                      {formatNumber(picked.problems.length)} {picked.problems.length === 1 ? 'row' : 'rows'} can’t be added
                    </span>
                  </>
                )}
              </p>
              {picked.problems.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-card bg-danger-soft/50 px-3 py-2 text-xs text-ink-soft">
                  {picked.problems.map((p, i) => (
                    <li key={i}>
                      {p.line > 0 && <span className="font-medium text-ink">Line {p.line}: </span>}
                      {p.message}
                    </li>
                  ))}
                </ul>
              )}
              {unmatched.length > 0 && (
                <p className="rounded-card bg-subtle px-3 py-2 text-xs text-ink-soft">
                  <span className="font-medium text-ink">Not on your category list:</span> {unmatched.join(', ')}. Those creators are still added,
                  without these categories, and can choose their own from their profile.
                </p>
              )}
            </div>
          )}

          <CheckboxRow
            id={`import-invite-${kind}`}
            label="Email each person a link to set their password"
            description="The same email an approval sends. Brevo allows 300 emails a day, and Supabase limits login emails per hour (Authentication → Rate Limits), so raise that before a big upload. Anyone who doesn’t get one can use “Forgot password”."
            checked={invite}
            onCheckedChange={setInvite}
          />
        </div>
      )}
    </Modal>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-card border border-line p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('font-display text-2xl font-semibold tabular-nums', tone)}>{formatNumber(value)}</p>
    </div>
  )
}

function ResultList({ rows }: { rows: ImportResult[] }) {
  return (
    <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-card border border-line text-sm">
      {rows.map((r, i) => (
        <li key={`${r.line}-${i}`} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3">
          <span className="shrink-0 text-xs text-faint sm:w-14">Line {r.line}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{r.email}</span>
            <span className={cn('block text-xs', r.status === 'created' ? 'text-warning-ink' : 'text-danger')}>{r.message ?? 'Not added.'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
