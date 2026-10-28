import * as React from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Building2, Check, ExternalLink, MessageCircle, RotateCcw, Search, Send, Sparkles, UserCheck, X } from 'lucide-react'
import { fetchAllPages } from '@/lib/fetch-all'
import { formatNumber } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { firstName, personalize, whatsappHref, whatsappNumber } from '@/lib/whatsapp'
import { getProfileNames, listBrandContacts, listCreators } from '@/services/admin.service'
import { Seo } from '@/components/shared/seo'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/states'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { RadioCard, RadioGroup } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

/**
 * One WhatsApp message to every approved creator, every brand, or a hand-picked
 * few, sent from the admin's own WhatsApp.
 *
 * Without a WhatsApp provider the platform can't send on its own, so this does
 * the next best thing: write the message once, then each tap opens WhatsApp
 * (one reused tab) with that person's number and their personalised message
 * already typed, and the admin presses send. Progress is kept in this browser
 * per message, so a reload or a break doesn't lose the place.
 *
 * Only people already approved: live creators (pending applicants have no
 * creator account; profiles sent back or suspended aren't live) and active
 * brand accounts. "Specific" picks from those same people.
 */

type Audience = 'creators' | 'brands' | 'specific'

type Recipient = {
  id: string
  kind: 'Creator' | 'Brand'
  /** What the list shows. */
  label: string
  /** Whose first name `{name}` becomes. */
  greet: string | null
  avatar: string | null
  whatsapp: string | null
  detail: string | null
  href: string
}

async function loadCreators(): Promise<Recipient[]> {
  const { items } = await fetchAllPages((page, pageSize) =>
    listCreators({ status: 'published', includeDeleted: false, sort: 'newest', page, pageSize }),
  )
  // Greet people by their real name, not the storefront name (which can be a
  // nickname or a handle). The storefront name is only the fallback.
  const names = await getProfileNames(items.map((c) => c.profile_id))
  return items.map((c) => ({
    id: c.id,
    kind: 'Creator',
    label: c.display_name,
    greet: names.get(c.profile_id) ?? c.display_name,
    avatar: c.profile_image_url,
    whatsapp: c.whatsapp,
    detail: c.city,
    href: `/admin/creators/${c.id}`,
  }))
}

async function loadBrands(): Promise<Recipient[]> {
  const { items } = await listBrandContacts()
  return items.map((b) => ({
    id: b.id,
    kind: 'Brand',
    label: b.contact_name ? `${b.brand_name} · ${b.contact_name}` : b.brand_name,
    greet: b.contact_name,
    avatar: b.logo,
    whatsapp: b.whatsapp,
    detail: b.location,
    href: `/admin/brands/${b.id}`,
  }))
}

async function loadRecipients(audience: Audience): Promise<Recipient[]> {
  if (audience === 'creators') return loadCreators()
  if (audience === 'brands') return loadBrands()
  const [creators, brands] = await Promise.all([loadCreators(), loadBrands()])
  return [...creators, ...brands].sort((a, b) => a.label.localeCompare(b.label))
}

const canMessage = (r: Recipient) => !!(r.whatsapp && whatsappNumber(r.whatsapp))

const DRAFT_KEY = 'hoc:wa-broadcast:draft'
const WINDOW_NAME = 'hoc-whatsapp'

/** Small stable hash so progress belongs to one message + audience. */
function hash(s: string) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage blocked: progress just won't survive a reload
  }
}

/** Search-and-tick list for "Specific": everyone who can be messaged, with their picture. */
function RecipientPicker({
  people,
  selected,
  onToggle,
  onClear,
}: {
  people: Recipient[]
  selected: Set<string>
  onToggle: (id: string, on: boolean) => void
  onClear: () => void
}) {
  const [search, setSearch] = React.useState('')
  const q = search.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')
  const shown = q
    ? people.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          (r.detail ?? '').toLowerCase().includes(q) ||
          (digits.length >= 3 && (r.whatsapp ?? '').replace(/\D/g, '').includes(digits)),
      )
    : people

  return (
    <div className="overflow-hidden rounded-card border border-line">
      <div className="space-y-2 border-b border-line bg-subtle/40 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, city or number"
            aria-label="Search people"
            className="pl-9"
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span>
            {formatNumber(selected.size)} selected · {formatNumber(shown.length)} shown
          </span>
          {selected.size > 0 && (
            <button type="button" onClick={onClear} className="focus-ring inline-flex items-center gap-1 rounded-sm font-medium text-ink hover:underline">
              <X className="size-3.5" /> Clear selection
            </button>
          )}
        </div>
      </div>
      <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
        {shown.map((r) => {
          const ok = canMessage(r)
          const on = selected.has(r.id)
          const id = `pick-${r.id}`
          return (
            <li key={r.id}>
              <label
                htmlFor={id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5',
                  ok ? 'cursor-pointer hover:bg-subtle/60' : 'cursor-not-allowed opacity-55',
                  on && 'bg-brand-soft/40',
                )}
              >
                <Checkbox id={id} checked={on} disabled={!ok} onCheckedChange={(v) => onToggle(r.id, v === true)} />
                <Avatar src={r.avatar} name={r.label} size="sm" shape={r.kind === 'Brand' ? 'rounded' : 'circle'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.label}</span>
                  <span className="block truncate text-xs text-muted tabular-nums">
                    {ok ? r.whatsapp : 'No WhatsApp number'}
                    {r.detail ? ` · ${r.detail}` : ''}
                  </span>
                </span>
                <Badge size="sm" tone={r.kind === 'Brand' ? 'info' : 'brand-soft'}>
                  {r.kind}
                </Badge>
              </label>
            </li>
          )
        })}
        {shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No one matches “{search.trim()}”.</li>}
      </ul>
    </div>
  )
}

export default function WhatsApp() {
  const draft = readJson<{ message?: string; audience?: string; selected?: string[] }>(DRAFT_KEY, {})
  const [message, setMessage] = React.useState(draft.message ?? '')
  const [audience, setAudience] = React.useState<Audience>(
    draft.audience === 'brands' || draft.audience === 'specific' ? draft.audience : 'creators',
  )
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(draft.selected ?? []))
  React.useEffect(() => writeJson(DRAFT_KEY, { message, audience, selected: [...selected] }), [message, audience, selected])

  const query = useQuery({
    queryKey: [...qk.admin.all, 'whatsapp-recipients', audience],
    queryFn: () => loadRecipients(audience),
  })

  const people = query.data ?? []
  const reachable = people.filter(canMessage)
  const unreachable = people.filter((r) => !canMessage(r))
  const specific = audience === 'specific'
  // Who this message goes to: everyone reachable, or just the ticked ones.
  const recipients = specific ? reachable.filter((r) => selected.has(r.id)) : reachable
  const noun = audience === 'brands' ? 'brand' : audience === 'creators' ? 'creator' : 'person'

  // Progress belongs to this exact message and audience: edit the message and
  // it starts again, which is right — the earlier ones got the old wording.
  const progressKey = `hoc:wa-broadcast:sent:${hash(`${audience}\n${message.trim()}`)}`
  const [sent, setSent] = React.useState<Set<string>>(() => new Set(readJson<string[]>(progressKey, [])))
  React.useEffect(() => setSent(new Set(readJson<string[]>(progressKey, []))), [progressKey])
  const mark = (id: string, on: boolean) =>
    setSent((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      writeJson(progressKey, [...next])
      return next
    })

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const ready = message.trim().length > 0
  const next = recipients.find((r) => !sent.has(r.id))
  const done = recipients.filter((r) => sent.has(r.id)).length
  const sample = recipients[0] ?? reachable[0]
  const preview = personalize(message.trim(), sample?.greet ?? 'Riya Sharma')

  function open(r: Recipient) {
    if (!ready || !r.whatsapp) return
    window.open(whatsappHref(r.whatsapp, personalize(message.trim(), r.greet)), WINDOW_NAME)
    mark(r.id, true)
  }

  const listTitle = specific ? 'Selected' : audience === 'brands' ? 'Brands' : 'Creators'

  return (
    <>
      <Seo title="WhatsApp" noindex />
      <PageHeader
        eyebrow="Platform"
        title="WhatsApp"
        description="Write one message, then send it to approved creators, brands or the people you pick. Each tap opens WhatsApp with their number and your message already typed — you just press send."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card className="space-y-5 p-5 sm:p-6">
            <Field
              label="Message"
              htmlFor="wa-message"
              hint={
                <>
                  Type <code className="rounded bg-subtle px-1">{'{name}'}</code> where each person’s first name should go. ·{' '}
                  {formatNumber(message.length)} characters
                </>
              }
            >
              <Textarea
                id="wa-message"
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={'Hi {name}, quick update from House of Collabs…'}
              />
            </Field>

            <Field label="Send to">
              <RadioGroup value={audience} onValueChange={(v) => setAudience(v as Audience)} className="grid gap-3 sm:grid-cols-2">
                <RadioCard value="creators" icon={<Sparkles />} title="Creators" description="Approved creators with a live profile" />
                <RadioCard value="brands" icon={<Building2 />} title="Brands" description="Active brand accounts" />
                <RadioCard value="specific" icon={<UserCheck />} title="Specific" description="Search and pick exactly who gets it" />
              </RadioGroup>
            </Field>

            {specific &&
              (query.isPending ? (
                <Skeleton className="h-64 rounded-card" />
              ) : query.isError ? (
                <ErrorState title="Couldn’t load people" onRetry={() => query.refetch()} />
              ) : (
                <RecipientPicker people={people} selected={selected} onToggle={toggle} onClear={() => setSelected(new Set())} />
              ))}

            {ready && sample && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-faint">Preview for {sample.label}</p>
                <div className="max-w-md rounded-card rounded-tl-sm bg-[#d9fdd3] px-3.5 py-2.5 text-sm whitespace-pre-wrap text-[#111b21] shadow-sm">
                  {preview}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
              <h2 className="font-display text-lg font-semibold">
                {listTitle}{' '}
                {query.data && (
                  <span className="text-muted">
                    · {formatNumber(recipients.length)}
                    {specific ? '' : ' with WhatsApp'}
                  </span>
                )}
              </h2>
              {done > 0 && (
                <Button type="button" size="sm" variant="ghost" onClick={() => { setSent(new Set()); writeJson(progressKey, []) }}>
                  <RotateCcw /> Start over
                </Button>
              )}
            </div>

            {query.isPending ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : query.isError ? (
              <ErrorState className="m-5" title={`Couldn’t load ${noun === 'person' ? 'people' : `${noun}s`}`} onRetry={() => query.refetch()} />
            ) : specific && recipients.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted sm:px-6">Tick people in the list above to add them here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recipients.map((c) => {
                  const isSent = sent.has(c.id)
                  const greetAs = firstName(c.greet)
                  return (
                    <li key={c.id} className={cn('flex items-center gap-3 px-5 py-3 sm:px-6', isSent && 'bg-subtle/50')}>
                      <Avatar src={c.avatar} name={c.label} size="sm" shape={c.kind === 'Brand' ? 'rounded' : 'circle'} />
                      <div className="min-w-0 flex-1">
                        <Link to={c.href} className="block truncate text-sm font-medium hover:underline">
                          {c.label}
                        </Link>
                        <p className="truncate text-xs text-muted tabular-nums">
                          {c.whatsapp}
                          {c.detail ? ` · ${c.detail}` : ''}
                          {greetAs && greetAs !== firstName(c.label) ? ` · greeted as ${greetAs}` : ''}
                        </p>
                      </div>
                      {isSent ? (
                        <>
                          <Badge tone="success" size="sm">
                            <Check className="size-3" /> Opened
                          </Badge>
                          <Button type="button" size="sm" variant="ghost" onClick={() => mark(c.id, false)}>
                            Undo
                          </Button>
                        </>
                      ) : (
                        <Button type="button" size="sm" variant="secondary" disabled={!ready} onClick={() => open(c)}>
                          <MessageCircle /> Open
                        </Button>
                      )}
                    </li>
                  )
                })}
                {!specific && unreachable.length > 0 && (
                  <li className="px-5 py-4 sm:px-6">
                    <p className="text-xs font-medium text-faint">No valid WhatsApp number ({formatNumber(unreachable.length)})</p>
                    <p className="mt-1 text-sm text-muted">{unreachable.map((c) => c.label).join(', ')}</p>
                  </li>
                )}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Card className="space-y-4 p-5">
            <div>
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-medium">Progress</span>
                <span className="text-muted tabular-nums">
                  {formatNumber(done)} of {formatNumber(recipients.length)}
                </span>
              </div>
              <Progress value={recipients.length ? (done / recipients.length) * 100 : 0} tone="success" />
            </div>

            {next ? (
              <Button type="button" block size="lg" disabled={!ready} onClick={() => open(next)}>
                <Send /> Send to {next.label}
              </Button>
            ) : recipients.length ? (
              <p className="rounded-control bg-success-soft px-3 py-2.5 text-sm font-medium text-success">
                Done — everyone has been messaged.
              </p>
            ) : (
              <p className="rounded-control bg-subtle px-3 py-2.5 text-sm text-muted">
                {specific ? 'Pick people to send to.' : `No ${noun}s to message.`}
              </p>
            )}

            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted">
              <li>Tap <strong className="text-ink">Send to…</strong> — WhatsApp opens with the message typed.</li>
              <li>Press send in WhatsApp, then come back here.</li>
              <li>Tap again for the next person. WhatsApp reuses the same tab.</li>
            </ol>
            <p className="flex items-start gap-1.5 text-xs text-faint">
              <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
              Messages go from the WhatsApp you’re signed in to on this device. Progress is saved in this browser.
            </p>
          </Card>
        </aside>
      </div>
    </>
  )
}
