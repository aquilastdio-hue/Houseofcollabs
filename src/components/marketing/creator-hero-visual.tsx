import { BadgeCheck, Inbox, MessageSquareText, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { site } from '@/config/site'
import { Glow, stagger } from './primitives'

type Note = { icon: LucideIcon; title: string; body: string; time: string; className: string; iconClass: string }

/** Example notifications that tell the creator story (decorative, no real data). */
const NOTES: Note[] = [
  {
    icon: Inbox,
    title: 'New order',
    body: 'A skincare brand ordered your UGC video package.',
    time: 'Mon',
    className: 'lg:-translate-x-6 -rotate-2',
    iconClass: 'bg-brand text-white',
  },
  {
    icon: MessageSquareText,
    title: 'Brief received',
    body: 'Product notes, talking points and references are in your inbox.',
    time: 'Mon',
    className: 'lg:translate-x-10 rotate-1',
    iconClass: 'bg-lilac-soft text-lilac',
  },
  {
    icon: BadgeCheck,
    title: 'Delivery approved',
    body: 'The brand approved your video on the first round.',
    time: 'Thu',
    className: 'lg:-translate-x-2 -rotate-1',
    iconClass: 'bg-mint-soft text-mint',
  },
  {
    icon: Wallet,
    title: 'Payout sent',
    body: 'Your available balance is on its way to your UPI ID.',
    time: 'Fri',
    className: 'lg:translate-x-8 rotate-2',
    iconClass: 'bg-ink text-brand',
  },
]

export function CreatorHeroVisual({ className }: { className?: string }) {
  return (
    <figure className={cn('relative isolate mx-auto w-full max-w-md', className)}>
      <Glow tone="brand" className="top-6 -left-10 -z-10 size-72" />
      <Glow tone="lilac" className="-right-10 bottom-0 -z-10 size-72" />
      <ol className="space-y-3.5">
        {NOTES.map((note, i) => {
          const Icon = note.icon
          return (
            <li key={note.title} className="animate-fade-up" style={stagger(i, 140, 200)}>
              <div
                className={cn(
                  'flex items-start gap-3.5 rounded-card border border-line bg-surface/95 p-4 shadow-float backdrop-blur-md transition-[rotate,translate] duration-500 ease-spring hover:rotate-0',
                  note.className,
                )}
              >
                <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', note.iconClass)}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display font-semibold tracking-tight">{note.title}</p>
                    <span className="text-xs text-faint">{note.time}</span>
                  </div>
                  <p className="mt-0.5 text-sm leading-snug text-muted">{note.body}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <figcaption className="mt-5 text-center text-xs text-faint">Example of a week on {site.name} — notifications you’ll get as orders move.</figcaption>
    </figure>
  )
}
