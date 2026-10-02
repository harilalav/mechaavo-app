import { clamp } from "./rng";

/**
 * The water's push: one slow, uneven signal that everything floating in the
 * scene reads, so the lure, its line, the weed, the drifting sediment and the
 * bubbles all lean and ease together. That shared cause is what makes the
 * movement of the lure match its surroundings: when a gust arrives the line
 * bows, the lure sways off to leeward, the weed bends and the motes stream
 * past, all on the same beat.
 *
 * The lure hangs nose into the current, so the water runs from the nose toward
 * the tail: leftward on screen.
 */
export interface Current {
  /** Horizontal push, about -1 (hard leftward) to -0.3 (slack water). Never positive. */
  x: number;
  /** Vertical sloshing, roughly -0.85 to 0.85. Zero on average. */
  y: number;
  /** 0-1: how hard the water is pushing right now. */
  gust: number;
  /** Slowly advancing phase for anything that waves in the current (weed, the line). */
  swell: number;
  /** What `x` averages to, so a force can be taken about the mean position. */
  mean: number;
}

export function createCurrent(): Current {
  return { x: -0.65, y: 0, gust: 0.5, swell: 0, mean: -0.65 };
}

/** Advance the current to `time` seconds. `flow` is the scene's water speed (1 = normal). */
export function stepCurrent(current: Current, time: number, flow: number): void {
  // three incommensurate beats: a long surge (about 15 s), a medium one (6 s) and a shiver (2 s)
  const gust =
    0.5 +
    0.3 * Math.sin(time * 0.42 + 0.6) +
    0.14 * Math.sin(time * 1.07 + 2.1) +
    0.06 * Math.sin(time * 2.9 + 0.3);
  current.gust = clamp(gust, 0, 1);
  current.x = -(0.3 + 0.7 * current.gust) * flow;
  current.mean = -0.65 * flow;
  current.y = 0.55 * Math.sin(time * 0.31 + 1.2) + 0.3 * Math.sin(time * 0.77 + 0.2);
  current.swell = time * 0.8;
}
