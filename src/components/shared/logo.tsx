import { cn } from '@/lib/utils'
import { site } from '@/config/site'

/**
 * House of Collabs mark: two circles — a brand and a creator — overlapping, with
 * the shared area knocked out in limelight to read as the collaboration itself.
 * Original artwork.
 */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  const ink = inverted ? '#ffffff' : '#111111'
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <defs>
        {/* The overlap is the only part filled with limelight. */}
        <clipPath id="hoc-overlap">
          <circle cx="12" cy="16" r="9" />
        </clipPath>
      </defs>
      <circle cx="12" cy="16" r="9" fill={ink} />
      <circle cx="20" cy="16" r="9" fill={ink} />
      <g clipPath="url(#hoc-overlap)">
        <circle cx="20" cy="16" r="9" fill="#e1306c" />
      </g>
    </svg>
  )
}

/**
 * The brand lockup.
 *
 * On light surfaces this is the real House of Collabs artwork. It ships with
 * real transparency, so — unlike the file it replaced — it needs neither a
 * blend mode to drop a white canvas nor a horizontal squeeze to swallow a wide
 * built-in margin.
 *
 * The aspect box crops to the "HOUSE of COLLABS" wordmark. The
 * `CREATORS BRANDS CULTURE` line above it is 19px of a 512px-tall file, so it
 * lands under 2px at header size — a smudge rather than words — and is cropped
 * away rather than shown.
 *
 * Crop maths, from the artwork's measured ink (768x512, tagline y 104-122,
 * wordmark y 147-406): a window of y 135-418 keeps the wordmark with 12px of
 * margin either side, which is 768:284 and sits 59% down the frame.
 *
 * `inverted` (the dark footer) and `showWordmark={false}` (the collapsed
 * sidebar) keep the geometric mark: the artwork can't be recoloured for a dark
 * background, and it has no standalone icon form.
 */
export function Logo({ className, inverted, showWordmark = true }: { className?: string; inverted?: boolean; showWordmark?: boolean }) {
  // Collapsed sidebar: no room for a wordmark of any kind.
  if (!showWordmark) {
    return (
      <span className={cn('inline-flex items-center', className)}>
        <LogoMark inverted={inverted} />
      </span>
    )
  }

  // Dark surfaces get the white artwork. It ships with real transparency, so
  // unlike the black lockup it needs no blend mode to sit on the footer.
  //
  // Crop maths, from the artwork's measured ink (1536x1024): the tagline line
  // occupies y 212-244 and the wordmark y 313-855. At footer size the tagline
  // would render about 4px tall — a smudge rather than words — so the window is
  // y 290-878, which keeps the wordmark with ~23px of margin either side. That
  // is 1536:588, sitting 67% down the frame.
  if (inverted) {
    return (
      <span className={cn('inline-flex items-center align-middle', className)}>
        <span className="aspect-[1536/588] h-12 overflow-hidden sm:h-14">
          <img
            src="/house-of-collabs-logo-white.webp"
            alt={site.name}
            width={1536}
            height={1024}
            className="size-full object-cover [object-position:50%_67%]"
          />
        </span>
      </span>
    )
  }

  // `align-middle` because an inline-flex box otherwise sits on the parent's
  // text baseline, which left the mark ~4px above centre in the header bar.
  return (
    <span className={cn('inline-flex items-center align-middle', className)}>
      <span className="aspect-[768/284] h-11 overflow-hidden sm:h-12">
        <img
          src="/house-of-collabs-logo-header.webp"
          alt={site.name}
          width={768}
          height={512}
          className="size-full object-cover [object-position:50%_59%]"
        />
      </span>
    </span>
  )
}
