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
