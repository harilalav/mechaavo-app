import type { Current } from "./current";
import { createRng, range, TAU } from "./rng";

/**
 * Suspended sediment ("marine snow"). Struct-of-arrays so a frame touches no
 * objects. Particles carry a depth (0 far → 1 near): the engine projects them
 * through the same camera as the fish, so near motes rush past on push-in while
 * distant ones barely move.
 *
 * They ride the water's current (lib/underwater/current.ts): the whole cloud
 * streams toward the lure's tail, faster up close than far away, surging and
 * easing with the gusts that sway the lure and its line. A bite shoves the motes
 * near the hook outward (`shoveParticles`), and they settle back into the flow.
 */
export interface ParticleField {
  count: number;
  x: Float32Array;
  y: Float32Array;
  /** depth 0–1 */
  z: Float32Array;
  radius: Float32Array;
  driftX: Float32Array;
  fall: Float32Array;
  phase: Float32Array;
  twinkle: Float32Array;
  /** Velocity from a shove, px/s; it decays. */
  vx: Float32Array;
  vy: Float32Array;
}

/** Streaming speed of the nearest motes at full current, px/s. */
const STREAM = 20;

export function createParticleField(
  count: number,
  width: number,
  height: number,
  seed: number,
): ParticleField {
  const rng = createRng(seed);
  const field: ParticleField = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    radius: new Float32Array(count),
    driftX: new Float32Array(count),
    fall: new Float32Array(count),
    phase: new Float32Array(count),
    twinkle: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
  };
  for (let i = 0; i < count; i++) {
    const z = Math.pow(rng(), 1.6); // most motes are distant
    field.x[i] = rng() * width;
    field.y[i] = rng() * height;
    field.z[i] = z;
    field.radius[i] = 0.5 + z * 1.9 + rng() * 0.4;
    field.driftX[i] = range(rng, -2, 2) * (0.4 + z);
    field.fall[i] = range(rng, 1.2, 4) * (0.4 + z * 1.2);
    field.phase[i] = rng() * TAU;
    field.twinkle[i] = range(rng, 0.25, 0.8);
  }
  return field;
}

export function updateParticles(
  field: ParticleField,
  dt: number,
  time: number,
  current: Current,
  width: number,
  height: number,
): void {
  const margin = 40;
  const settle = Math.exp(-1.3 * dt);
  for (let i = 0; i < field.count; i++) {
    // near motes move faster (parallax); the current sets the beat for all of them
    const depth = 0.35 + field.z[i];
    const sway = Math.sin(time * 0.3 + field.phase[i]) * 4 * depth;
    field.vx[i] *= settle;
    field.vy[i] *= settle;
    field.x[i] += (current.x * STREAM * depth + field.driftX[i] + sway + field.vx[i]) * dt;
    field.y[i] += (field.fall[i] + current.y * 5 * depth + field.vy[i]) * dt;

    if (field.y[i] > height + margin) field.y[i] = -margin;
    else if (field.y[i] < -margin) field.y[i] = height + margin;
    if (field.x[i] > width + margin) field.x[i] = -margin;
    else if (field.x[i] < -margin) field.x[i] = width + margin;
  }
}

/** Push every mote within `radius` of (x, y) away from it: the shock of a bite. `strength` is px/s at the centre. */
export function shoveParticles(field: ParticleField, x: number, y: number, radius: number, strength: number): void {
  const r2 = radius * radius;
  for (let i = 0; i < field.count; i++) {
    const dx = field.x[i] - x;
    const dy = field.y[i] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    const d = Math.sqrt(d2) + 1;
    const push = strength * (1 - d / radius) * (0.4 + field.z[i]);
    field.vx[i] += (dx / d) * push;
    field.vy[i] += (dy / d) * push;
  }
}
