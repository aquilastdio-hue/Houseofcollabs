/**
 * Props for a video player showing a creator's work to the public.
 *
 * Spread these onto every public `<video controls>`: the storefront intro and
 * the portfolio lightbox. They are separate components, and fixing one and not
 * the other is exactly what happened the first time — the download item
 * disappeared from the portfolio player while the intro video kept offering it.
 *
 * `nodownload` drops Download from the player's overflow menu; with playback
 * speed and picture-in-picture gone too, Chrome stops rendering the three-dot
 * button at all rather than leaving a menu with one orphan entry. Blocking the
 * context menu closes the "Save video as…" route.
 *
 * This is a deterrent, not protection. Portfolio media lives in a public
 * bucket, so anyone reading the network tab can still fetch the file. It keeps
 * the work out of two casual paths, which is all a visible control can do.
 * Real protection would mean signed, expiring URLs.
 *
 * Deliberately NOT used on: the admin moderation players, where reviewing
 * content is the job, and order deliverables, where the brand has paid for the
 * files and downloading them is the entire point.
 */
export const protectedVideoProps = {
  controlsList: 'nodownload noplaybackrate',
  disablePictureInPicture: true,
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
} as const
