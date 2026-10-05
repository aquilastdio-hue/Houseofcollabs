/**
 * Moves the screen to the first error in a form and focuses the control it
 * belongs to.
 *
 * `handleSubmit` focuses the first invalid field on its own, but `trigger()` —
 * what a multi-page wizard calls on Continue — does not. The sign-up pages are
 * long enough that an error on the first field renders well above the fold, so
 * pressing Continue looked like it did nothing at all.
 *
 * Errors are found by `role="alert"`, which `Field` puts on every message it
 * renders, so this works for text inputs, comboboxes, chip groups and file
 * pickers without any of them needing to know about it. Scoping the search to
 * the form matters: toasts are alerts too, and a stray toast would otherwise
 * win on document order.
 */
export function scrollToFirstError(container: HTMLElement | null) {
  if (!container) return
  // Two frames: the first lets React commit the error, the second lets it be
  // laid out before anything is measured or scrolled.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const alert = container.querySelector<HTMLElement>('[role="alert"]')
      if (!alert) return

      // `Field` gives the message the id `<control>-desc`, which is the only
      // link back to the control from here — names like `instagram.handle`
      // don't match element ids like `ig_handle`.
      const controlId = alert.id.endsWith('-desc') ? alert.id.slice(0, -'-desc'.length) : null
      const control = controlId ? document.getElementById(controlId) : null

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ;(control ?? alert).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
      // `preventScroll` so focusing doesn't jump instantly and fight the
      // smooth scroll that has just started.
      control?.focus({ preventScroll: true })
    })
  })
}
