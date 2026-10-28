import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, X } from 'lucide-react'
import { formatCompact } from '@/lib/format'
import { useDebounce } from '@/hooks/use-utils'
import { searchInvitableCreators, type InvitedCreator } from '@/services/campaigns.service'
import { Avatar } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'

const MAX_INVITES = 50

/**
 * Pick specific creators to invite. They're told once the campaign is
 * approved and see an "Invited" tag; anyone else can still apply.
 */
export function CreatorInvitePicker({ value, onChange }: { value: InvitedCreator[]; onChange: (next: InvitedCreator[]) => void }) {
  const [q, setQ] = React.useState('')
  const term = useDebounce(q.trim(), 250)
  const results = useQuery({
    queryKey: ['campaigns', 'invite-search', term],
    queryFn: () => searchInvitableCreators(term),
    enabled: term.length >= 2,
    staleTime: 30_000,
  })
  const chosen = new Set(value.map((c) => c.id))
  const add = (c: InvitedCreator) => {
    if (chosen.has(c.id) || value.length >= MAX_INVITES) return
    onChange([...value, c])
    setQ('')
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5 rounded-pill border border-line bg-surface py-1 pr-1.5 pl-1">
              <Avatar src={c.photo} name={c.name} size="xs" />
              <span className="text-sm font-medium">{c.name}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.id !== c.id))}
                className="focus-ring rounded-full p-0.5 text-muted hover:text-ink"
                aria-label={`Remove ${c.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search live creators by name"
          aria-label="Search creators to invite"
          leftIcon={<Search />}
          disabled={value.length >= MAX_INVITES}
        />
        {term.length >= 2 && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-card border border-line bg-surface shadow-float">
            {results.isPending ? (
              <p className="px-3 py-3 text-sm text-muted">Searching…</p>
            ) : (results.data ?? []).length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted">No live creators match “{term}”.</p>
            ) : (
              <ul>
                {results.data!.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={chosen.has(c.id)}
                      onClick={() => add(c)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle disabled:opacity-50"
                    >
                      <Avatar src={c.photo} name={c.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {formatCompact(c.followers)} followers{c.city ? ` · ${c.city}` : ''}
                        </span>
                      </span>
                      {chosen.has(c.id) ? <span className="text-xs text-muted">Added</span> : <Plus className="size-4 text-muted" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-muted">
        {value.length}/{MAX_INVITES} invited. They’re notified once your campaign is approved.
      </p>
    </div>
  )
}
