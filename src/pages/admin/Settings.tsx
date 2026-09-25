import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Info, RotateCcw, Save, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qk } from '@/lib/query-keys'
import { formatDateTime, formatINR } from '@/lib/format'
import { listSettings, updateSetting } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader, SectionTitle } from '@/components/shared/page-header'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { SwitchRow } from '@/components/ui/switch'
import { useAdminMutation } from '@/components/admin/use-admin-mutation'
import type { Json } from '@/types'

/**
 * Client-side mirror of the validation in `public.admin_update_setting`. The
 * database is still the authority — this only avoids a round trip for
 * obviously-bad input and lets us render the right control per setting.
 */
type NumberSpec = { kind: 'number'; min: number; max: number; integer: boolean; unit?: string; money?: boolean }
type Spec = NumberSpec | { kind: 'boolean' } | { kind: 'text'; maxLength: number; rows?: number; email?: boolean }

const SPECS: Record<string, Spec> = {
  platform_fee_percentage: { kind: 'number', min: 0, max: 50, integer: false, unit: '%' },
  minimum_payout_amount: { kind: 'number', min: 0, max: 1_000_000, integer: false, money: true },
  max_revisions: { kind: 'number', min: 0, max: 10, integer: true, unit: 'revisions' },
  earning_hold_days: { kind: 'number', min: 0, max: 60, integer: true, unit: 'days' },
  creator_response_hours: { kind: 'number', min: 1, max: 720, integer: true, unit: 'hours' },
  auto_approve_days: { kind: 'number', min: 1, max: 60, integer: true, unit: 'days' },
  payment_expiry_hours: { kind: 'number', min: 1, max: 168, integer: true, unit: 'hours' },
  require_creator_approval: { kind: 'boolean' },
  cancellation_rules: { kind: 'text', maxLength: 4000, rows: 4 },
  refund_rules: { kind: 'text', maxLength: 4000, rows: 4 },
  support_email: { kind: 'text', maxLength: 4000, email: true },
}

const GROUPS: { title: string; description: string; keys: string[] }[] = [
  {
    title: 'Money',
    description: 'Commission and payout thresholds. Changes apply to new orders and payout requests, never to money already moved.',
    keys: ['platform_fee_percentage', 'minimum_payout_amount', 'earning_hold_days'],
  },
  {
    title: 'Order timings',
    description: 'The clocks the scheduled jobs use to chase, auto-approve and expire orders.',
    keys: ['creator_response_hours', 'auto_approve_days', 'payment_expiry_hours', 'max_revisions'],
  },
  { title: 'Marketplace', description: 'How new creators join the marketplace.', keys: ['require_creator_approval'] },
  { title: 'Public copy', description: 'Shown to brands and creators on the policy pages and at checkout.', keys: ['cancellation_rules', 'refund_rules', 'support_email'] },
]

const LABELS: Record<string, string> = {
  platform_fee_percentage: 'Platform fee',
  minimum_payout_amount: 'Minimum payout',
  earning_hold_days: 'Earnings hold',
  creator_response_hours: 'Creator response window',
  auto_approve_days: 'Auto-approve after delivery',
  payment_expiry_hours: 'Checkout expiry',
  max_revisions: 'Maximum revisions',
  require_creator_approval: 'Review creator profiles before they go live',
  cancellation_rules: 'Cancellation rules',
  refund_rules: 'Refund rules',
  support_email: 'Support email',
}

type SettingRow = Awaited<ReturnType<typeof listSettings>>[number]

function validate(spec: Exclude<Spec, { kind: 'boolean' }>, raw: string): { value: Json } | { error: string } {
  if (spec.kind === 'number') {
    const trimmed = raw.trim()
    if (!trimmed) return { error: 'Enter a value.' }
    const n = Number(trimmed)
    if (!Number.isFinite(n)) return { error: 'Enter a number.' }
    if (spec.integer && !Number.isInteger(n)) return { error: 'Enter a whole number.' }
    if (n < spec.min || n > spec.max) return { error: `Must be between ${spec.min} and ${spec.max}.` }
    return { value: n }
  }
  const text = raw.trim()
  if (!text) return { error: 'Enter a value.' }
  if (text.length > spec.maxLength) return { error: `Keep it under ${spec.maxLength} characters.` }
  if (spec.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) return { error: 'Enter a valid email address.' }
  return { value: text }
}

/** jsonb scalars arrive as number | boolean | string. */
function toInput(value: Json) {
  if (value === null || typeof value === 'object') return ''
  return String(value)
}

function SettingControl({ row }: { row: SettingRow }) {
  const spec = SPECS[row.key]
  const id = `setting-${row.key}`
  const label = LABELS[row.key] ?? row.key
  const [draft, setDraft] = React.useState(() => toInput(row.value))
  const [error, setError] = React.useState<string>()

  const save = useAdminMutation((value: Json) => updateSetting(row.key, value), {
    invalidate: [qk.admin.settings, qk.settings],
    success: `${label} updated`,
  })

  // Adopt the server value whenever it changes underneath us (refetch, another admin).
  const serverInput = toInput(row.value)
  const lastServer = React.useRef(serverInput)
  React.useEffect(() => {
    if (lastServer.current !== serverInput) {
      lastServer.current = serverInput
      setDraft(serverInput)
      setError(undefined)
    }
  }, [serverInput])

  if (!spec) {
    // A setting the UI doesn't know how to edit yet — show it read-only rather than risk a bad write.
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{row.key}</p>
        <p className="font-mono text-xs text-muted">{JSON.stringify(row.value)}</p>
        {row.description && <p className="text-xs text-muted">{row.description}</p>}
      </div>
    )
  }

  if (spec.kind === 'boolean') {
    const checked = row.value === true
    return (
      <SwitchRow
        id={id}
        label={label}
        description={row.description ?? undefined}
        checked={checked}
        disabled={save.isPending}
        onCheckedChange={(next) => save.mutate(next)}
      />
    )
  }

  const dirty = draft !== serverInput
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const result = validate(spec, draft)
    if ('error' in result) return setError(result.error)
    setError(undefined)
    save.mutate(result.value)
  }

  const hint =
    spec.kind === 'number'
      ? spec.money
        ? `Between ${formatINR(spec.min)} and ${formatINR(spec.max)}.`
        : `Between ${spec.min} and ${spec.max}${spec.unit ? ` ${spec.unit}` : ''}.`
      : (row.description ?? undefined)

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label={label} htmlFor={id} hint={spec.kind === 'number' ? (row.description ?? undefined) : undefined} error={error}>
        {spec.kind === 'text' && spec.rows ? (
          <Textarea
            id={id}
            rows={spec.rows}
            maxLength={spec.maxLength}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={`${id}-hint`}
          />
        ) : (
          <Input
            id={id}
            type={spec.kind === 'number' ? 'number' : spec.email ? 'email' : 'text'}
            inputMode={spec.kind === 'number' ? 'decimal' : undefined}
            step={spec.kind === 'number' ? (spec.integer ? 1 : 'any') : undefined}
            min={spec.kind === 'number' ? spec.min : undefined}
            max={spec.kind === 'number' ? spec.max : undefined}
            maxLength={spec.kind === 'text' ? spec.maxLength : undefined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={`${id}-hint`}
            rightSlot={spec.kind === 'number' && spec.unit ? <span className="text-xs text-muted">{spec.unit}</span> : undefined}
          />
        )}
      </Field>
      <p id={`${id}-hint`} className="sr-only">
        {hint}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!dirty} loading={save.isPending}>
          <Save /> Save
        </Button>
        {dirty && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(serverInput)
              setError(undefined)
            }}
          >
            <RotateCcw /> Revert
          </Button>
        )}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </form>
  )
}

export default function Settings() {
  const query = useQuery({ queryKey: qk.admin.settings, queryFn: listSettings })
  const byKey = React.useMemo(() => new Map((query.data ?? []).map((s) => [s.key, s])), [query.data])
  const grouped = new Set(GROUPS.flatMap((g) => g.keys))
  const ungrouped = (query.data ?? []).filter((s) => !grouped.has(s.key))
  const lastChange = (query.data ?? []).reduce<string | null>((latest, s) => (!latest || s.updated_at > latest ? s.updated_at : latest), null)

  return (
    <>
      <Seo title="Platform settings" noindex />
      <PageHeader
        eyebrow="Configuration"
        title="Platform settings"
        description="Fees, timings and public policy copy. Every value is validated and written by the database, and each change is recorded in the audit log."
      />

      {query.isError ? (
        <ErrorState error={query.error} title="Couldn’t load settings" onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-48 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      ) : query.data.length === 0 ? (
        <EmptyState icon={<SlidersHorizontal />} title="No settings found" description="Run the migrations and reference data seed to populate platform settings." />
      ) : (
        <div className="max-w-3xl space-y-8">
          <p className="flex items-start gap-2 rounded-card border border-line bg-subtle px-4 py-3 text-sm text-muted">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Settings marked <Badge tone="brand-soft" size="sm">public</Badge> are readable by everyone, including signed-out visitors — never put anything sensitive in them.
              {lastChange && <> Last change {formatDateTime(lastChange)}.</>}
            </span>
          </p>

          {GROUPS.map((group) => {
            const rows = group.keys.map((k) => byKey.get(k)).filter((r): r is SettingRow => !!r)
            if (rows.length === 0) return null
            return (
              <section key={group.title} className="space-y-4">
                <SectionTitle title={group.title} description={group.description} />
                <Card className="divide-y divide-line p-0">
                  {rows.map((row) => (
                    <div key={row.key} className={cn('p-5', row.key === 'require_creator_approval' && 'py-4')}>
                      <SettingControl row={row} />
                    </div>
                  ))}
                </Card>
              </section>
            )
          })}

          {ungrouped.length > 0 && (
            <section className="space-y-4">
              <SectionTitle title="Other settings" description="Defined in the database but not yet given a dedicated control here." />
              <Card className="divide-y divide-line p-0">
                {ungrouped.map((row) => (
                  <div key={row.key} className="p-5">
                    <SettingControl row={row} />
                  </div>
                ))}
              </Card>
            </section>
          )}
        </div>
      )}
    </>
  )
}
