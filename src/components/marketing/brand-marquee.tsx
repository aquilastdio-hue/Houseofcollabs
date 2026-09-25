import { Headphones, Mountain, Sprout } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Fictional D2C wordmarks (original, not real companies) rendered as styled
 * type. Each entry is a tiny piece of original "logo" typography.
 */
const WORDMARKS: { name: string; mark: React.ReactNode }[] = [
  {
    name: 'Kumkum Naturals',
    mark: (
      <span className="inline-flex items-center gap-2 font-serif text-[1.65rem] italic">
        <span aria-hidden className="size-2.5 rounded-full bg-current" />
        Kumkum Naturals
      </span>
    ),
  },
  {
    name: 'Urban Tiffin Co.',
    mark: (
      <span className="inline-flex items-center gap-2 font-display text-lg font-extrabold tracking-tight uppercase">
        <span aria-hidden className="grid size-6 place-items-center rounded-[0.35rem] border-2 border-current text-[0.6rem] leading-none">UT</span>
        Urban Tiffin Co.
      </span>
    ),
  },
  {
    name: 'Nimbus Audio',
    mark: (
      <span className="inline-flex items-center gap-2 text-lg font-light tracking-[0.18em] lowercase">
        <Headphones aria-hidden className="size-5" strokeWidth={1.5} />
        nimbus audio
      </span>
    ),
  },
  {
    name: 'Saffron Street',
    mark: (
      <span className="inline-flex items-baseline gap-1 font-serif text-[1.7rem]">
        Saffron<span className="font-display text-sm font-bold tracking-[0.3em] uppercase">Street</span>
      </span>
    ),
  },
  {
    name: 'Peak Protein Labs',
    mark: (
      <span className="inline-flex items-center gap-2 font-display text-lg uppercase">
        <Mountain aria-hidden className="size-5" strokeWidth={2.25} />
        <span className="font-black italic">Peak</span>
        <span className="font-medium tracking-wide">Protein Labs</span>
      </span>
    ),
  },
  {
    name: 'Chai Circle',
    mark: (
      <span className="inline-flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
        <span aria-hidden className="size-5 rounded-full border-[3px] border-current" />
        chai circle
      </span>
    ),
  },
  {
    name: 'Loom & Lace',
    mark: (
      <span className="font-serif text-[1.65rem]">
        Loom <span className="italic">&amp;</span> Lace
      </span>
    ),
  },
  {
    name: 'Byte Gadgets',
    mark: (
      <span className="font-mono text-base font-semibold tracking-[0.2em] uppercase">
        byte<span aria-hidden className="mx-0.5 opacity-50">/</span>gadgets
      </span>
    ),
  },
  {
    name: 'Wander Bags',
    mark: (
      <span className="inline-flex items-baseline font-display text-xl tracking-tight">
        <span className="font-bold">wander</span>
        <span className="font-light">bags</span>
        <span aria-hidden className="ml-0.5 size-1.5 self-end rounded-full bg-current" />
      </span>
    ),
  },
  {
    name: 'Little Sprouts',
    mark: (
      <span className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
        <Sprout aria-hidden className="size-5" />
        Little Sprouts
      </span>
    ),
  },
]

export function BrandMarquee({ className }: { className?: string }) {
  return (
    <section aria-labelledby="brand-strip-title" className={cn('border-y border-line bg-surface/60 py-10', className)}>
      <div className="container-page">
        <h2 id="brand-strip-title" className="eyebrow text-center font-sans text-faint">
          Loved by growing D2C brands
        </h2>
      </div>
      <div className="group mask-fade-x mt-7 overflow-hidden">
        <div className="flex w-max animate-marquee items-center group-hover:[animation-play-state:paused]">
          <WordmarkList />
          <WordmarkList hidden />
        </div>
      </div>
    </section>
  )
}

function WordmarkList({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-14 pr-14 text-ink/55 sm:gap-20 sm:pr-20">
      {WORDMARKS.map((w) => (
        <li key={w.name} className="shrink-0 whitespace-nowrap leading-none transition-colors duration-300 hover:text-ink">
          {hidden ? (
            w.mark
          ) : (
            <span role="img" aria-label={w.name}>
              {w.mark}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
