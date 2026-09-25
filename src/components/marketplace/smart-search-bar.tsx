import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Search, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-utils'
import { smartSearch, type SmartSearchResult } from '@/services/search.service'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type SearchMode = 'smart' | 'keyword'

const EXAMPLES = ['Fitness creators in Mumbai under 3000', 'Hindi tech YouTubers with 100k+ followers', 'UGC videos within 3 days']

const shellClass =
  'flex items-center gap-2 rounded-panel border border-line bg-surface p-1.5 pl-4 shadow-card transition-[border-color,box-shadow] duration-200 focus-within:border-ink focus-within:shadow-glow'
const inputClass = 'h-11 min-w-0 flex-1 bg-transparent text-[0.95rem] text-ink outline-none placeholder:text-faint'

/**
 * Two ways to search, made explicit with tabs:
 * - Smart search: plain-English request → structured filters (replaces current filters).
 * - Keyword: free-text match on names, niches, cities and bios (debounced into `q`).
 */
export function SmartSearchBar({
  mode,
  onModeChange,
  keyword,
  onKeywordChange,
  onSmartResult,
  showExamples,
  className,
}: {
  mode: SearchMode
  onModeChange: (mode: SearchMode) => void
  /** Current `q` from the URL. */
  keyword: string
  onKeywordChange: (q: string | undefined) => void
  onSmartResult: (result: SmartSearchResult) => void
  showExamples?: boolean
  className?: string
}) {
  const [smartText, setSmartText] = React.useState('')
  const [keywordText, setKeywordText] = React.useState(keyword)
  const debouncedKeyword = useDebounce(keywordText, 350)

  // Last keyword we know the URL holds — separates our own writes from outside
  // changes (Clear all, back button, smart search) so typing is never clobbered.
  const synced = React.useRef(keyword)
  const onKeywordChangeRef = React.useRef(onKeywordChange)
  React.useEffect(() => {
    onKeywordChangeRef.current = onKeywordChange
  })

  React.useEffect(() => {
    if (keyword === synced.current) return
    synced.current = keyword
    setKeywordText(keyword)
  }, [keyword])

  const pushKeyword = React.useCallback((raw: string) => {
    const next = raw.trim()
    if (next === synced.current.trim()) return
    synced.current = next
    onKeywordChangeRef.current(next || undefined)
  }, [])

  React.useEffect(() => {
    pushKeyword(debouncedKeyword)
  }, [debouncedKeyword, pushKeyword])

  const smart = useMutation({
    mutationFn: (text: string) => smartSearch(text),
    meta: { silent: true },
    onSuccess: (result) => onSmartResult(result),
  })

  const runSmart = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    smart.mutate(trimmed)
  }

  return (
    <Tabs value={mode} onValueChange={(v) => onModeChange(v === 'keyword' ? 'keyword' : 'smart')} className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <TabsList aria-label="Search mode">
          <TabsTrigger value="smart">
            <Sparkles className="size-4" /> Smart search
          </TabsTrigger>
          <TabsTrigger value="keyword">
            <Search className="size-4" /> Keyword
          </TabsTrigger>
        </TabsList>
        <p className="text-sm text-muted">
          {mode === 'smart' ? 'Describe who you need in plain words — we’ll set the filters for you.' : 'Match names, niches, cities and bios as you type.'}
        </p>
      </div>

      <TabsContent value="smart" tabIndex={-1}>
        <form
          role="search"
          aria-label="Smart search"
          className={shellClass}
          onSubmit={(e) => {
            e.preventDefault()
            runSmart(smartText)
          }}
        >
          <Sparkles className="size-5 shrink-0 text-brand-ink" aria-hidden />
          <label htmlFor="smart-search-input" className="sr-only">
            Describe the creator you need
          </label>
          <input
            id="smart-search-input"
            value={smartText}
            onChange={(e) => setSmartText(e.target.value)}
            placeholder="Try: female beauty creator in Delhi under 5000 within 5 days"
            className={inputClass}
            autoComplete="off"
            enterKeyHint="search"
            maxLength={300}
          />
          <Button type="submit" loading={smart.isPending} disabled={!smartText.trim()} aria-label="Search" className="max-sm:px-3.5">
            <span className="hidden sm:inline">Search</span>
            <ArrowRight className={cn(smart.isPending && 'hidden', 'sm:hidden')} />
          </Button>
        </form>
        {showExamples && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Try</span>
            {EXAMPLES.map((example, i) => (
              <button
                key={example}
                type="button"
                disabled={smart.isPending}
                onClick={() => {
                  setSmartText(example)
                  runSmart(example)
                }}
                className={cn(
                  'focus-ring rounded-pill border border-line bg-surface px-3 py-1 text-left text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60',
                  i > 1 && 'hidden sm:inline-block',
                )}
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="keyword" tabIndex={-1}>
        <div role="search" aria-label="Keyword search" className={shellClass}>
          <Search className="size-5 shrink-0 text-faint" aria-hidden />
          <label htmlFor="keyword-search-input" className="sr-only">
            Search creators by keyword
          </label>
          <input
            id="keyword-search-input"
            value={keywordText}
            onChange={(e) => setKeywordText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') pushKeyword(keywordText)
            }}
            placeholder="Search by name, niche or city"
            className={inputClass}
            autoComplete="off"
            enterKeyHint="search"
            maxLength={120}
          />
          {keywordText && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear keyword"
              onClick={() => {
                setKeywordText('')
                pushKeyword('')
              }}
            >
              <X />
            </Button>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
