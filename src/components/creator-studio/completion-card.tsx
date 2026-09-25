import { Link } from 'react-router'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useCompletion } from '@/hooks/use-creators'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/states'
import type { CompletionItem } from '@/types'

/**
 * Signup step (1-based) where each completion item is edited. Only the required
 * items appear during signup; everything else is edited from the dashboard, so
 * those fall back to step 1 and are reached through `completionHref` instead.
 */
export const COMPLETION_STEP: Record<string, number> = {
  photo: 1,
  bio: 1,
  location: 1,
  languages: 1,
  categories: 2,
  creator_type: 2,
  social: 2,
  intro_video: 2,
}

/** Workspace page where each completion item is edited. */
export function completionHref(key: string) {
  switch (key) {
    case 'categories':
    case 'creator_type':
      return '/creator/profile?tab=creator'
    case 'social':
    case 'intro_video':
      return '/creator/profile?tab=social'
    case 'services':
    case 'addons':
      return '/creator/services'
    case 'portfolio':
      return '/creator/portfolio'
    default:
      return '/creator/profile?tab=basic'
  }
}

function ChecklistGroup({
  title,
  items,
  required,
  onFix,
}: {
  title: string
  items: CompletionItem[]
  required: boolean
  onFix?: (key: string) => void
}) {
  if (items.length === 0) return null
  const done = items.filter((i) => i.done).length
  return (
    <div>
      <p className="eyebrow mb-1 flex items-center justify-between text-faint">
        <span>{title}</span>
        <span className="tabular-nums">
          {done}/{items.length}
        </span>
      </p>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.key} className="flex min-h-11 items-center gap-3 py-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full',
                item.done ? 'bg-brand text-white' : 'border border-dashed border-line-strong',
              )}
              aria-hidden
            >
              {item.done && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className={cn('min-w-0 flex-1 text-sm', item.done ? 'text-muted' : 'font-medium text-ink')}>
              {item.label}
              <span className="sr-only">{item.done ? ' — done' : ' — to do'}</span>
            </span>
            {!item.done &&
              (onFix ? (
                <Button type="button" variant="secondary" size="xs" onClick={() => onFix(item.key)} aria-label={`${required ? 'Fix' : 'Add'}: ${item.label}`}>
                  {required ? 'Fix' : 'Add'}
                </Button>
              ) : (
                <Button asChild variant="secondary" size="xs">
                  <Link to={completionHref(item.key)} aria-label={`${required ? 'Fix' : 'Add'}: ${item.label}`}>
                    {required ? 'Fix' : 'Add'}
                  </Link>
                </Button>
              ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Profile completion (from `get_creator_completion`): progress plus a
 * required / recommended checklist. `onFix` turns the links into buttons
 * (onboarding jumps to a step instead of navigating).
 */
export function CompletionCard({
  title = 'Profile strength',
  onFix,
  hideWhenComplete,
  stacked,
  className,
}: {
  title?: string
  onFix?: (key: string) => void
  hideWhenComplete?: boolean
  /** Single-column checklist for narrow columns (sidebars). */
  stacked?: boolean
  className?: string
}) {
  const { creator } = useAuth()
  const query = useCompletion(!!creator)
  if (!creator) return null

  if (query.isPending) {
    return (
      <Card className={cn('space-y-4 p-5 sm:p-6', className)} aria-busy="true">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-2 w-full" />
        <div className={cn('grid gap-3', !stacked && 'md:grid-cols-2')}>
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </Card>
    )
  }
  if (query.isError) {
    return <ErrorState compact className={className} error={query.error} title="Couldn’t load your checklist" onRetry={() => void query.refetch()} />
  }

  const { percent, items, can_publish: canPublish, status } = query.data
  if (hideWhenComplete && percent >= 100) return null
  const required = items.filter((i) => i.required)
  const recommended = items.filter((i) => !i.required)
  const missing = required.filter((i) => !i.done).length
  const summary =
    missing > 0
      ? `${missing} required step${missing === 1 ? '' : 's'} left before you can publish.`
      : canPublish && (status === 'draft' || status === 'rejected')
        ? 'Everything required is done — you’re ready to publish.'
        : percent < 100
          ? 'Add the recommended extras to stand out to brands.'
          : 'Your storefront is complete. Nice work!'

  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{summary}</p>
        </div>
        <p className="shrink-0 font-display text-3xl font-semibold tabular-nums">{percent}%</p>
      </div>
      <Progress value={percent} tone={percent >= 100 ? 'success' : 'brand'} className="mt-4" aria-label={`Profile ${percent}% complete`} />
      <div className={cn('mt-5 grid gap-x-8 gap-y-5', !stacked && 'md:grid-cols-2')}>
        <ChecklistGroup title="Required to publish" items={required} required onFix={onFix} />
        <ChecklistGroup title="Grow your storefront" items={recommended} required={false} onFix={onFix} />
      </div>
    </Card>
  )
}
