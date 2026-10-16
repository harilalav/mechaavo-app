import type { BrandPalette } from "../theme/brand";
import { createRng, range, TAU, type Rng } from "./rng";

/**
 * Bubbles, ripples and the splash. They are events, not functions of scroll: a
 * bite, a release, a rod-tip twitch or the lure's entry into the water releases
 * some, and they then rise (or fade) on their own clock. A pool of fixed size is
 * reused, so nothing allocates per frame.
 *
 * Two looks. The default is the bite's: a clear sphere with a rim, a hairline and two
 * glints, loud on purpose. `fine` is the quiet one (a faint body, one thin rim, one
 * glint) for the lure's dive in and the tiles' arrival, where a crowd of the loud
 * ones read as stickers.
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
  /** The quiet look (see the header). */
  fine: boolean;
}

interface Ripple {
  active: boolean;
  x: number;
  y: number;
  age: number;
}

/** The splash where the lure enters the water: two soft rings. */
interface Splash {
  active: boolean;
  x: number;
  y: number;
  age: number;
  /** Size of the rings, 1 = about 140 px across at the widest. */
  scale: number;
}

export interface BubblePool {
  bubbles: Bubble[];
  ripples: Ripple[];
  splash: Splash;
  rng: Rng;
  cursor: number;
}

const RIPPLE_LIFE = 1.1;
const SPLASH_LIFE = 1.0;

export function createBubblePool(capacity: number, seed: number): BubblePool {
  const bubbles: Bubble[] = [];
  for (let i = 0; i < capacity; i++) {
    bubbles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 1, age: 0, life: 1, wobble: 0, phase: 0, drag: 0, fine: false });
  }
  const ripples: Ripple[] = [
    { active: false, x: 0, y: 0, age: 0 },
    { active: false, x: 0, y: 0, age: 0 },
  ];
  return {
    bubbles,
    ripples,
    splash: { active: false, x: 0, y: 0, age: 0, scale: 1 },
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
    b.fine = false;
  }
}

/**
 * The quiet bubbles: `count` of them around (x, y), mostly tiny with the odd larger one
 * (a cube of the random draw, so a crowd is never a row of equals), each on its own
 * release time, with little sideways wobble. `size` is the typical radius in px.
 * Used where a trail should read as water, not as a sticker sheet.
 */
export function emitFine(
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
    const r = pool.rng();
    b.active = true;
    b.x = x + range(pool.rng, -spread, spread);
    b.y = y + range(pool.rng, -spread * 0.5, spread * 0.5);
    b.vx = range(pool.rng, -3, 3);
    b.vy = -rise * range(pool.rng, 0.5, 1.2);
    b.radius = size * (0.5 + 1.9 * r * r * r);
    b.age = -range(pool.rng, 0, 0.5);
    b.life = range(pool.rng, 1.1, 2.0);
    b.wobble = range(pool.rng, 1.5, 4.5);
    b.phase = range(pool.rng, 0, TAU);
    b.drag = 0;
    b.fine = true;
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
    b.fine = false;
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
 * point of entry and fade within a second. Small and soft on purpose; it happens
 * once. (It used to throw a fan of white droplets as well; with the bubbles they
 * made the entry a crowd.) `scale` sizes it to the lure (1 is about 140 px across
 * at its widest).
 */
export function emitSplash(pool: BubblePool, x: number, y: number, scale: number): void {
  pool.splash.active = true;
  pool.splash.x = x;
  pool.splash.y = y;
  pool.splash.age = 0;
  pool.splash.scale = scale;
}

export function clearBubbles(pool: BubblePool): void {
  for (const b of pool.bubbles) b.active = false;
  for (const r of pool.ripples) r.active = false;
  pool.splash.active = false;
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
    // rings on ocean water (D12): a navy shade, then a pale echo
    ctx.strokeStyle = palette.alpha("seaDeep", 0.5 * fade);
    ctx.beginPath();
    ctx.arc(r.x, r.y, (10 + 130 * t) * scale, 0, TAU);
    ctx.stroke();
    if (t > 0.12) {
      const t2 = (t - 0.12) / 0.88;
      ctx.strokeStyle = palette.alpha("white", 0.55 * (1 - t2) * (1 - t2));
      ctx.beginPath();
      ctx.arc(r.x, r.y, (8 + 90 * t2) * scale, 0, TAU);
      ctx.stroke();
    }
  }

  // the splash: two rings opening out from the point of entry
  const splash = pool.splash;
  if (splash.active) {
    const t = splash.age / SPLASH_LIFE;
    const fade = (1 - t) * (1 - t);
    // the first ring: a bright edge with a thin shade beside it, so it reads on pale water
    const radius = (6 + 70 * Math.pow(t, 0.6)) * splash.scale;
    ctx.beginPath();
    ctx.arc(splash.x, splash.y, radius, 0, TAU);
    ctx.lineWidth = 3.4 - 2 * t;
    ctx.strokeStyle = palette.alpha("seaDeep", 0.16 * fade);
    ctx.stroke();
    ctx.lineWidth = 2.2 - 1.2 * t;
    ctx.strokeStyle = palette.alpha("white", 0.75 * fade);
    ctx.stroke();
    // the second, a beat later and tighter, in the logo's blue (the lure swims in from the logo)
    if (t > 0.12) {
      const t2 = (t - 0.12) / 0.88;
      ctx.lineWidth = 1.8 - 1 * t2;
      ctx.strokeStyle = palette.alpha("brandBlue", 0.4 * (1 - t2) * (1 - t2));
      ctx.beginPath();
      ctx.arc(splash.x, splash.y, (5 + 48 * Math.pow(t2, 0.6)) * splash.scale, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.lineWidth = 1;
  for (const b of pool.bubbles) {
    if (!b.active || b.age < 0) continue;
    const t = b.age / b.life;
    const envelope = Math.min(1, t * 6) * Math.min(1, (1 - t) * 3);
    if (b.fine) {
      // the quiet look: a faint body, one thin rim (a hair of navy beside it only where it is big enough to
      // carry one), one glint. Smaller than a pixel is a speck, so the floor is a pixel and a tenth.
      const r = Math.max(1.1, b.radius * scale * (0.85 + 0.35 * t));
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, TAU);
      ctx.fillStyle = palette.alpha("white", 0.12 * envelope);
      ctx.fill();
      if (r >= 2.2) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = palette.alpha("seaDeep", 0.16 * envelope);
        ctx.beginPath();
        ctx.arc(b.x, b.y, r + 0.5, 0, TAU);
        ctx.stroke();
      }
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = palette.alpha("white", 0.7 * envelope);
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(0.6, r - 0.3), 0, TAU);
      ctx.stroke();
      if (r >= 1.8) {
        ctx.beginPath();
        ctx.arc(b.x - r * 0.35, b.y - r * 0.35, Math.max(0.5, r * 0.18), 0, TAU);
        ctx.fillStyle = palette.alpha("white", 0.85 * envelope);
        ctx.fill();
      }
      continue;
    }
    // never smaller than a pixel and a half: a bubble that is only a speck is not a bubble
    const radius = Math.max(1.5, b.radius * scale * (0.8 + 0.5 * t));
    // a clear sphere on blue water (D12): a faint milky body, a bright rim with a navy hairline outside it (the
    // rim alone is lost against the pale surface water, the hairline alone against the deep), and two glints
    ctx.beginPath();
    ctx.arc(b.x, b.y, radius, 0, TAU);
    ctx.fillStyle = palette.alpha("white", 0.16 * envelope);
    ctx.fill();
    // the navy hairline only for a bubble big enough to have one (a few pixels across it is a dot, and the
    // trail of a dive is hundreds of them: fewer paths per frame)
    if (radius >= 2.6) {
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = palette.alpha("seaDeep", 0.42 * envelope);
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius + 0.6, 0, TAU);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.alpha("white", 0.92 * envelope);
    ctx.beginPath();
    ctx.arc(b.x, b.y, Math.max(0.8, radius - 0.4), 0, TAU);
    ctx.stroke();
    // a pinpoint of light on the upper left, and a fainter one opposite it where the light comes through
    ctx.beginPath();
    ctx.arc(b.x - radius * 0.35, b.y - radius * 0.35, Math.max(0.6, radius * 0.2), 0, TAU);
    ctx.fillStyle = palette.alpha("white", 0.95 * envelope);
    ctx.fill();
    if (radius >= 2.6) {
      ctx.beginPath();
      ctx.arc(b.x + radius * 0.4, b.y + radius * 0.4, Math.max(0.5, radius * 0.12), 0, TAU);
      ctx.fillStyle = palette.alpha("white", 0.5 * envelope);
      ctx.fill();
    }
  }
}
