/**
 * How long a scrubbed timeline takes to catch up with the scroll, in seconds.
 *
 * Under a mouse wheel a second of smoothing turns the wheel's steps into a glide. On a touch screen the
 * browser's own momentum already is the glide, so the same second made the page keep changing for a
 * moment after the finger had stopped it (the card and the story still moving once the scroll was over):
 * a coarse pointer gets a short catch-up. Read when a timeline is built.
 */
export function scrubSeconds(): number {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? 0.4 : 1;
}

/**
 * The camera sinking under the catalog (the statement, the nav and the lure leaving, the water deepening) follows the
 * scroll closely: it is only fades and a layer's opacity, and with the story's full second of smoothing a scroll
 * back up left a frame of deep water with the heading low on the screen and the statement already gone, for the
 * best part of a second (client round 3). A short catch-up.
 */
export function sinkScrubSeconds(): number {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? 0.2 : 0.3;
}
