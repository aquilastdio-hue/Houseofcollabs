import * as React from 'react'

/**
 * Play a video while the pointer rests on it, stop when it leaves.
 *
 * Creators upload six-second clips and a still frame says very little about
 * them, so the work should move as soon as someone shows interest — the same
 * thing the creator cards on the grid already do, now on the profile too.
 *
 * Three things this is careful about:
 *
 * - **Sound.** Browsers refuse to autoplay audible video, so a hover preview
 *   is always muted. Whatever the viewer had set is put back on the way out,
 *   so pressing play afterwards is not silently muted.
 * - **Ownership.** A viewer who pressed play themselves, or unmuted, owns the
 *   player from then on; moving the pointer away must not pause them. Only
 *   playback this hook started gets stopped by this hook.
 * - **Touch.** A tap has to keep working — on a tile it opens the lightbox, on
 *   a player with controls it hits the play button. So touch gets a real
 *   press-and-hold rather than treating the first contact as a hover.
 */

/**
 * How long a touch is held before the preview starts. Long enough that an
 * ordinary tap lands on what is underneath, short enough to feel like a hold.
 */
const HOLD_MS = 250

export function useHoverPlay({ resetOnLeave = true }: { resetOnLeave?: boolean } = {}) {
  const ref = React.useRef<HTMLVideoElement>(null)
  /** Whether the playback in progress is ours to stop. */
  const ours = React.useRef(false)
  /** The viewer's own sound setting, borrowed for the length of a preview. */
  const wasMuted = React.useRef(true)
  const hold = React.useRef<number | null>(null)

  const cancelHold = () => {
    if (hold.current != null) window.clearTimeout(hold.current)
    hold.current = null
  }

  const start = React.useCallback(() => {
    const el = ref.current
    if (!el || !el.paused) return
    wasMuted.current = el.muted
    el.muted = true
    ours.current = true
    // Rejected when the element is torn down mid-hover, or when a policy
    // blocks it outright; either way we no longer own the player.
    el.play().catch(() => {
      ours.current = false
    })
  }, [])

  const stop = React.useCallback(() => {
    cancelHold()
    const el = ref.current
    if (!el || !ours.current) return
    ours.current = false
    // Hand the sound back first, and unconditionally. A short clip often runs
    // to its end while the pointer is still on it, and returning early for an
    // element that has already stopped would leave it muted for good — the
    // next press of play would be silent with no way to tell why.
    el.muted = wasMuted.current
    if (el.paused) return // ended, or stopped by the viewer — leave the position alone
    el.pause()
    if (resetOnLeave) el.currentTime = 0
  }, [resetOnLeave])

  React.useEffect(() => cancelHold, [])

  return {
    /** Spread on the `<video>` itself — media events do not bubble. */
    videoProps: {
      ref,
      onVolumeChange: () => {
        if (ref.current && !ref.current.muted) ours.current = false
      },
    },
    /**
     * Spread on whatever the pointer actually reaches: the video itself, or
     * the wrapper when the video sits behind something else — a preview tile
     * keeps its video under the button that opens the lightbox.
     */
    hoverProps: {
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') start()
      },
      onPointerLeave: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') stop()
      },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') return
        cancelHold()
        hold.current = window.setTimeout(start, HOLD_MS)
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') stop()
      },
      onPointerCancel: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') stop()
      },
    },
  }
}
