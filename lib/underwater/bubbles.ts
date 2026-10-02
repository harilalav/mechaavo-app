import type { BrandPalette } from "../theme/brand";
import { createRng, range, TAU, type Rng } from "./rng";

/**
 * Bubbles, ripples and the splash. They are events, not functions of scroll: a
 * bite, a release, a rod-tip twitch or the lure's entry into the water releases
 * some, and they then rise (or fade) on their own clock. A pool of fixed size is
 * reused, so nothing allocates per frame.
 */

interface Bubble {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  life: number;
  wobble: number;
  phase: number;
  /** How quickly sideways and vertical speed die away, 1/s (zero for a bubble that just rises). */
  drag: number;
}

interface Ripple {
  active: boolean;
  x: number;
  y: number;
  age: number;
}

/** The splash where the lure enters the water: two soft rings and a fan of droplets. */
interface Splash {
  active: boolean;
  x: number;
  y: number;
  age: number;
  /** Size of the rings, 1 = about 140 px across at the widest. */
  scale: number;
}

/** One fleck of spray from the splash: thrown outward, slowed by the water. */
interface Fleck {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  life: number;
}

export interface BubblePool {
  bubbles: Bubble[];
  ripples: Ripple[];
  splash: Splash;
  flecks: Fleck[];
  rng: Rng;
  cursor: number;
}

const RIPPLE_LIFE = 1.1;
const SPLASH_LIFE = 1.0;
const FLECKS = 12;

export function createBubblePool(capacity: number, seed: number): BubblePool {
  const bubbles: Bubble[] = [];
  for (let i = 0; i < capacity; i++) {
    bubbles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 1, age: 0, life: 1, wobble: 0, phase: 0, drag: 0 });
  }
  const ripples: Ripple[] = [
    { active: false, x: 0, y: 0, age: 0 },
    { active: false, x: 0, y: 0, age: 0 },
  ];
  const flecks: Fleck[] = [];
  for (let i = 0; i < FLECKS; i++) flecks.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 1, age: 0, life: 1 });
  return {
    bubbles,
    ripples,
    splash: { active: false, x: 0, y: 0, age: 0, scale: 1 },
    flecks,
    rng: createRng(seed),
    cursor: 0,
  };
}

/** Release `count` bubbles around (x, y). `size` is the typical radius in px, `rise` the typical speed in px/s. */
export function emitBubbles(
  pool: BubblePool,
  x: number,
  y: number,
  count: number,
  spread: number,
  rise: number,
  size: number,
): void {
  for (let i = 0; i < count; i++) {
    const b = pool.bubbles[pool.cursor];
    pool.cursor = (pool.cursor + 1) % pool.bubbles.length;
    b.active = true;
    b.x = x + range(pool.rng, -spread, spread);
    b.y = y + range(pool.rng, -spread * 0.4, spread * 0.4);
    b.vx = range(pool.rng, -6, 6);
    b.vy = -rise * range(pool.rng, 0.7, 1.3);
    b.radius = size * range(pool.rng, 0.55, 1.4);
    b.age = -range(pool.rng, 0, 0.35); // staggered release
    b.life = range(pool.rng, 1.6, 2.6);
    b.wobble = range(pool.rng, 4, 10);
    b.phase = range(pool.rng, 0, TAU);
    b.drag = 0;
  }
}

/**
 * A stream of bubbles sent out from the logo, along its width, when it is
 * hovered: a wave of them, released one after another so the stream flows rather
 * than pops, aimed along `aim` (radians, 0 = right, positive = down; the hero
 * aims them at the lure) with a slight fan, and slowed by the water. Most go a few
 * hundred pixels and settle into the current; every fifth runs far ahead, so the
 * stream reaches across the screen. `scale` sizes their speed to the scene and
 * `size` their radius (the pool's bubbles are otherwise drawn at the lure's scale).
 */
export function emitStream(
  pool: BubblePool,
  x: number,
  y: number,
  width: number,
  count: number,
  scale: number,
  size: number,
  aim: number,
): void {
  for (let i = 0; i < count; i++) {
    const b = pool.bubbles[pool.cursor];
    pool.cursor = (pool.cursor + 1) % pool.bubbles.length;
    const along = count > 1 ? i / (count - 1) : 0;
    const lead = i % 5 === 0;
    const speed = (lead ? range(pool.rng, 560, 820) : range(pool.rng, 200, 470)) * scale;
    const angle = aim + range(pool.rng, -0.22, 0.22) * (lead ? 0.5 : 1);
    b.active = true;
    // spread along the logo and up and down with the curve of its waves
    b.x = x + along * width + range(pool.rng, -4, 4);
    b.y = y + Math.sin(along * TAU) * 6 + range(pool.rng, -3, 3);
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.drag = lead ? range(pool.rng, 0.42, 0.62) : range(pool.rng, 0.6, 1.05);
    b.radius = (lead ? range(pool.rng, 3.4, 7.5) : range(pool.rng, 2.4, 5.8)) * size;
    b.age = -(i * 0.03 + range(pool.rng, 0, 0.05)); // staggered: a flowing stream
    b.life = range(pool.rng, 2.8, 4.2);
    b.wobble = range(pool.rng, 3, 8);
    b.phase = range(pool.rng, 0, TAU);
  }
}

export function emitRipple(pool: BubblePool, x: number, y: number): void {
  const ripple = pool.ripples.find((r) => !r.active) ?? pool.ripples[0];
  ripple.active = true;
  ripple.x = x;
  ripple.y = y;
  ripple.age = 0;
}

/**
 * The lure goes into the water at (x, y): two quick rings open out from the
 * point of entry and a small fan of spray is thrown downward and outward, then
 * everything fades within a second. Small and soft on purpose; it happens once.
 * `scale` sizes it to the lure (1 is about 140 px across at its widest).
 */
export function emitSplash(pool: BubblePool, x: number, y: number, scale: number): void {
  pool.splash.active = true;
  pool.splash.x = x;
  pool.splash.y = y;
  pool.splash.age = 0;
  pool.splash.scale = scale;
  for (const fleck of pool.flecks) {
    // a fan below the entry point (the surface is above the frame), wide enough to read as a burst
    const angle = Math.PI / 2 + range(pool.rng, -1.25, 1.25);
    const speed = range(pool.rng, 70, 165) * scale;
    fleck.active = true;
    fleck.x = x;
    fleck.y = y;
    fleck.vx = Math.cos(angle) * speed;
    fleck.vy = Math.sin(angle) * speed;
    fleck.radius = range(pool.rng, 1.4, 2.8) * Math.sqrt(scale);
    fleck.age = 0;
    fleck.life = range(pool.rng, 0.5, 0.95);
  }
}

export function clearBubbles(pool: BubblePool): void {
  for (const b of pool.bubbles) b.active = false;
  for (const r of pool.ripples) r.active = false;
  pool.splash.active = false;
  for (const f of pool.flecks) f.active = false;
}

/** Advance the pool. `streamX` is the water's sideways speed at the lure (px/s): rising bubbles are carried along with it. */
export function updateBubbles(pool: BubblePool, dt: number, streamX = 0): void {
  for (const b of pool.bubbles) {
    if (!b.active) continue;
    b.age += dt;
    if (b.age < 0) continue;
    if (b.age >= b.life) {
      b.active = false;
      continue;
    }
    if (b.drag > 0) {
      const slow = Math.exp(-b.drag * dt);
      b.vx *= slow;
      b.vy *= slow;
    }
    b.vy -= 22 * dt; // buoyancy: they speed up as they rise
    b.x += (b.vx + streamX + Math.sin(b.age * 4 + b.phase) * b.wobble) * dt;
    b.y += b.vy * dt;
  }
  for (const r of pool.ripples) {
    if (!r.active) continue;
    r.age += dt;
    if (r.age >= RIPPLE_LIFE) r.active = false;
  }
  if (pool.splash.active) {
    pool.splash.age += dt;
    if (pool.splash.age >= SPLASH_LIFE) pool.splash.active = false;
  }
  const drag = Math.exp(-2.6 * dt);
  for (const f of pool.flecks) {
    if (!f.active) continue;
    f.age += dt;
    if (f.age >= f.life) {
      f.active = false;
      continue;
    }
    f.vx *= drag;
    f.vy *= drag;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }
}

/** Draw the pool. `scale` follows the lure's size so effects stay in proportion while the camera pushes in. */
export function drawBubbles(
  ctx: CanvasRenderingContext2D,
  pool: BubblePool,
  palette: BrandPalette,
  scale: number,
): void {
  for (const r of pool.ripples) {
    if (!r.active) continue;
    const t = r.age / RIPPLE_LIFE;
    const fade = (1 - t) * (1 - t);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = palette.alpha("primary", 0.5 * fade);
    ctx.beginPath();
    ctx.arc(r.x, r.y, (10 + 130 * t) * scale, 0, TAU);
    ctx.stroke();
    if (t > 0.12) {
      const t2 = (t - 0.12) / 0.88;
      ctx.strokeStyle = palette.alpha("accentSecondary", 0.4 * (1 - t2) * (1 - t2));
      ctx.beginPath();
      ctx.arc(r.x, r.y, (8 + 90 * t2) * scale, 0, TAU);
      ctx.stroke();
    }
  }

  // the splash: two rings opening out from the point of entry, then the spray
  const splash = pool.splash;
  if (splash.active) {
    const t = splash.age / SPLASH_LIFE;
    const fade = (1 - t) * (1 - t);
    // the first ring: a bright edge with a thin shade beside it, so it reads on pale water
    const radius = (6 + 70 * Math.pow(t, 0.6)) * splash.scale;
    ctx.beginPath();
    ctx.arc(splash.x, splash.y, radius, 0, TAU);
    ctx.lineWidth = 3.4 - 2 * t;
    ctx.strokeStyle = palette.alpha("secondary", 0.2 * fade);
    ctx.stroke();
    ctx.lineWidth = 2.2 - 1.2 * t;
    ctx.strokeStyle = palette.alpha("white", 0.95 * fade);
    ctx.stroke();
    // the second, a beat later and tighter, in the brand blue
    if (t > 0.12) {
      const t2 = (t - 0.12) / 0.88;
      ctx.lineWidth = 1.8 - 1 * t2;
      ctx.strokeStyle = palette.alpha("primary", 0.75 * (1 - t2) * (1 - t2));
      ctx.beginPath();
      ctx.arc(splash.x, splash.y, (5 + 48 * Math.pow(t2, 0.6)) * splash.scale, 0, TAU);
      ctx.stroke();
    }
  }
  for (const f of pool.flecks) {
    if (!f.active) continue;
    const t = f.age / f.life;
    const fade = (1 - t) * Math.min(1, f.age * 12);
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius, 0, TAU);
    ctx.fillStyle = palette.alpha("white", 0.9 * fade);
    ctx.fill();
    ctx.strokeStyle = palette.alpha("secondary", 0.45 * fade);
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  ctx.lineWidth = 1;
  for (const b of pool.bubbles) {
    if (!b.active || b.age < 0) continue;
    const t = b.age / b.life;
    const envelope = Math.min(1, t * 6) * Math.min(1, (1 - t) * 3);
    const radius = b.radius * scale * (0.8 + 0.5 * t);
    ctx.beginPath();
    ctx.arc(b.x, b.y, radius, 0, TAU);
    ctx.fillStyle = palette.alpha("white", 0.32 * envelope);
    ctx.fill();
    ctx.strokeStyle = palette.alpha("secondary", 0.42 * envelope);
    ctx.stroke();
    // a pinpoint of light on the upper left
    ctx.beginPath();
    ctx.arc(b.x - radius * 0.35, b.y - radius * 0.35, Math.max(0.5, radius * 0.18), 0, TAU);
    ctx.fillStyle = palette.alpha("white", 0.9 * envelope);
    ctx.fill();
  }
}
