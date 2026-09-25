import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Check, Search, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn, range } from '@/lib/utils'
import { formatCompact, formatLocation } from '@/lib/format'
import { qk } from '@/lib/query-keys'
import { useDebounce } from '@/hooks/use-utils'
import { useCreatorSearch } from '@/hooks/use-creators'
import { sendBrief, type BriefDetail } from '@/services/briefs.service'
import type { CreatorCard } from '@/types'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/states'

type SendableBrief = Pick<BriefDetail, 'id' | 'title' | 'status' | 'creator'>

/** Brand picks a published creator and shares the brief (`send_brief` RPC). */
export function SendBriefDialog({ brief, open, onOpenChange }: { brief: SendableBrief; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <SendBriefBody brief={brief} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function SendBriefBody({ brief, onDone }: { brief: SendableBrief; onDone: () => void }) {
  const qc = useQueryClient()
  const [query, setQuery] = React.useState('')
  const [selected, setSelected] = React.useState<CreatorCard | null>(null)
  const debounced = useDebounce(query.trim(), 300)
  const params = React.useMemo(() => ({ q: debounced || undefined, pageSize: 8 }), [debounced])
  const results = useCreatorSearch(params)
  const items = results.data?.items ?? []
  const current = brief.status === 'sent' ? brief.creator : null

  const send = useMutation({
    mutationFn: (creator: CreatorCard) => sendBrief(brief.id, creator.id),
    onSuccess: (_data, creator) => {
      toast.success(`Brief sent to ${creator.display_name}`)
      onDone()
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.briefs.all })
      void qc.invalidateQueries({ queryKey: qk.conversations.all })
      void qc.invalidateQueries({ queryKey: qk.dashboard.brand })
    },
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Send brief to a creator</DialogTitle>
        <DialogDescription>
          “{brief.title}” — they’ll get a notification and can accept or decline. A chat thread opens so you can talk details.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-3">
        {current && (
          <p className="rounded-control bg-info-soft px-3 py-2 text-sm text-info">
            {current.display_name} hasn’t replied yet. Sending to someone else replaces them on this brief.
          </p>
        )}
        <Command shouldFilter={false} label="Search creators" className="overflow-hidden rounded-card border border-line">
          <CommandInput placeholder="Search by name, niche or city" value={query} onValueChange={setQuery} autoFocus />
          <CommandList className={cn('max-h-80 transition-opacity', results.isPlaceholderData && 'opacity-60')}>
            {results.isPending ? (
              <div className="space-y-1 p-1" aria-hidden>
                {range(4).map((i) => (
                  <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.isError ? (
              <ErrorState compact className="m-1 border-0" error={results.error} onRetry={() => void results.refetch()} />
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted">
                {debounced ? `No creators match “${debounced}”.` : 'No creators are available right now.'}
              </p>
            ) : (
              items.map((c) => {
                const chosen = selected?.id === c.id
                return (
                  <CommandItem key={c.id} value={c.id} onSelect={() => setSelected(c)} className={cn(chosen && 'bg-brand-soft data-[selected=true]:bg-brand-soft')}>
                    <Avatar src={c.profile_image_url} name={c.display_name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 font-medium">
                        <span className="truncate">{c.display_name}</span>
                        {c.verified && <BadgeCheck className="size-3.5 shrink-0 fill-brand text-ink" aria-label="Verified" />}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {formatLocation(c.city, c.state)}
                        {c.followers_count ? ` · ${formatCompact(c.followers_count)} followers` : ''}
                      </span>
                    </span>
                    {current?.id === c.id && (
                      <Badge tone="info" size="sm">
                        Current
                      </Badge>
                    )}
                    <Check className={cn('text-ink', chosen ? 'opacity-100' : 'opacity-0')} aria-hidden />
                    {chosen && <span className="sr-only">Selected</span>}
                  </CommandItem>
                )
              })
            )}
          </CommandList>
        </Command>
        {selected ? (
          <div className="flex items-center gap-2 rounded-control border border-line bg-subtle/60 px-3 py-2 text-sm" aria-live="polite">
            <Avatar src={selected.profile_image_url} name={selected.display_name} size="xs" />
            <span className="min-w-0 flex-1 truncate">
              Sending to <span className="font-medium">{selected.display_name}</span>
            </span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="focus-ring rounded-full p-1 text-faint transition-colors hover:bg-muted-surface hover:text-ink"
              aria-label="Clear selected creator"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Search className="size-3.5" aria-hidden /> Pick a creator from the list to continue.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={send.isPending}>
          Cancel
        </Button>
        <Button onClick={() => selected && send.mutate(selected)} disabled={!selected} loading={send.isPending} className="max-w-full sm:max-w-xs">
          {!send.isPending && <Send />}
          <span className="truncate">{selected ? `Send to ${selected.display_name}` : 'Send brief'}</span>
        </Button>
      </DialogFooter>
    </>
  )
}
