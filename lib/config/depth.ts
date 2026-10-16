/**
 * Where in the water a category works: the depth text each category carries ("Surface (0 ft)", "Variable
 * (1-45 ft)", "20-350+ ft", "All Depths (Offshore & Shore)") read into a span on a gauge, so a tile and the
 * inspector can show it as a picture as well as in words. Nothing here is invented: the gauge says what
 * the data says, so it is exactly as right as `specs.depth` is.
 *
 * The gauge is logarithmic, because the interesting part of the water column is the top of it (a topwater
 * frog at 0 ft and a wood lure at 0-8 ft must not both sit in the first pixel of a scale that runs to 350).
 * 0 is the surface (the top of the gauge) and `DEPTH_MAX` the bottom of it.
 */

/** Feet at the bottom of the gauge: the deepest range any category quotes is 350+. */
export const DEPTH_MAX = 400;

/** Where the gauge is ticked and what the tick says. */
export const DEPTH_TICKS: readonly { ft: number; label: string }[] = [
  { ft: 0, label: "0 ft" },
  { ft: 10, label: "10" },
  { ft: 100, label: "100" },
  { ft: DEPTH_MAX, label: "400 ft" },
];

/** A depth in feet as a position on the gauge, 0 at the surface to 1 at `DEPTH_MAX` (logarithmic). */
export function depthPosition(ft: number): number {
  const clamped = Math.min(DEPTH_MAX, Math.max(0, ft));
  return Math.log1p(clamped) / Math.log1p(DEPTH_MAX);
}

export interface DepthSpan {
  /** Top of the span on the gauge, 0 to 1. */
  from: number;
  /** Bottom of the span on the gauge, 0 to 1 (never closer to `from` than `MIN_SPAN`, so the surface is a mark). */
  to: number;
  /** The range in a few characters ("0-8 ft", "Surface", "All depths"), for the tile. */
  label: string;
}

/** The smallest span the gauge draws, so "Surface (0 ft)" is a mark you can see. */
const MIN_SPAN = 0.07;

export function parseDepth(text: string): DepthSpan {
  if (/all\s+depths/i.test(text)) return { from: 0, to: 1, label: "All depths" };

  const feet = [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (!feet.length) return { from: 0, to: 1, label: "Varies" };

  const low = Math.min(...feet);
  const high = Math.max(...feet);
  const from = depthPosition(low);
  const to = Math.min(1, Math.max(depthPosition(high), from + MIN_SPAN));
  const open = /\d\s*\+/.test(text);

  let label: string;
  if (high === 0) label = "Surface";
  else if (low === high) label = `${low} ft`;
  else label = `${low}-${high}${open ? "+" : ""} ft`;
  return { from, to, label };
}
