import { angleDiff, clamp, TAU } from "./rng";

/**
 * Small motion toolkit shared by the fish and the lure rig. Everything is
 * frame-rate independent: it takes `dt` and never counts frames.
 */

/** Exponential smoothing toward a target. `rate` is 1/seconds (higher = snappier). */
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  target + (current - target) * Math.exp(-rate * dt);

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(angle: number): number {
  const a = angle % TAU;
  if (a > Math.PI) return a - TAU;
  return a <= -Math.PI ? a + TAU : a;
}

/** Turn an angle toward a target, by at most `maxStep` radians (rate-limited steering). */
export function turnToward(current: number, target: number, maxStep: number): number {
  return wrapAngle(current + clamp(angleDiff(current, target), -maxStep, maxStep));
}

/** Smooth organic noise in roughly [-1, 1]: three incommensurate sines. `t` is in radians. */
export const wobble = (t: number, seed: number): number =>
  0.55 * Math.sin(t + seed) +
  0.3 * Math.sin(t * 2.31 + seed * 1.7) +
  0.15 * Math.sin(t * 4.17 + seed * 2.9);

/** A smooth 0 → 1 → 0 pulse across [start, end]. */
export function pulse(x: number, start: number, end: number): number {
  const t = (x - start) / (end - start);
  return t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI) ** 2;
}

/** Kick-and-glide envelope: 0 while gliding, 1 at the peak of a tail-beat burst. */
export function kickEnvelope(time: number, period: number, phase: number): number {
  const s = 0.5 + 0.5 * Math.sin((time * TAU) / period + phase);
  const t = clamp((s - 0.35) / 0.6, 0, 1);
  return t * t * (3 - 2 * t);
}

/** A damped spring (one degree of freedom). Semi-implicit Euler, substepped for big frames. */
export interface Spring {
  x: number;
  v: number;
}

export function stepSpring(
  s: Spring,
  target: number,
  k: number,
  c: number,
  dt: number,
  force = 0,
): void {
  const steps = dt > 0.02 ? 2 : 1;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    s.v += (-k * (s.x - target) - c * s.v + force) * h;
    s.x += s.v * h;
  }
}

/** k and c for a spring with natural frequency `hz` and damping ratio `zeta`. */
export const springCoefficients = (hz: number, zeta: number): [number, number] => {
  const w = TAU * hz;
  return [w * w, 2 * zeta * w];
};

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
