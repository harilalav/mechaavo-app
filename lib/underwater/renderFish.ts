import type { BrandPalette, BrandToken } from "../theme/brand";
import { MIN_TURN } from "./pose";
import { TAU } from "./rng";
import type { Fish, FishTier, SpeciesKey } from "./types";

/**
 * Fish drawing.
 *
 * `FishRenderer` is the seam for real assets: swap the procedural renderer for
 * `createSpriteFishRenderer` (see fishAssets.ts) and nothing else changes.
 *
 * The procedural renderer builds a swimming fish from a spine with a travelling
 * sine wave (small at the head, large at the tail, like a real carangiform
 * swimmer), separate dorsal / ventral depth profiles per species, and caudal /
 * dorsal / anal / pelvic fins merged into one filled path, so fins never show
 * seams against the body. The spine can also curl (`bend`: wind-up, strike,
 * thrashing) and the jaws can open (`gape`).
 *
 * Orientation comes from the simulation: `facing` and `turn` (foreshortening
 * while the fish swings toward or away from the camera) and `pitch`. Fish are
 * countershaded (dark back, pale belly) in brand tokens, and solid: depth is
 * expressed through tone and opacity, never by letting one fish show through
 * another.
 *
 * Everything is drawn in "fish-length" units (head at the origin, body toward
 * -x), so one cached gradient per tier serves every fish of that tier.
 */

export interface FishView {
  /** Head position on screen, px. */
  x: number;
  y: number;
  /** Body length on screen, px. */
  length: number;
  /** Extra opacity multiplier (fades). */
  alpha: number;
}

export interface FishRenderer {
  draw(ctx: CanvasRenderingContext2D, fish: Fish, view: FishView): void;
}

interface Species {
  /** Full body depth / length. */
  depth: number;
  /** Share of the depth that sits above the spine. */
  backShare: number;
  backPeak: number;
  bellyPeak: number;
  /** <1 = blunt snout, ->1 = pointed. */
  snout: number;
  /** Peduncle thickness as a fraction of max depth. */
  stock: number;
  tailLen: number;
  tailSpan: number;
  spiny: readonly [number, number];
  soft: readonly [number, number];
  dorsalHeight: number;
  anal: readonly [number, number];
  analHeight: number;
  gill: number;
  pectoral: number;
  mouth: number;
  eye: number;
}

type BodySpecies = Exclude<SpeciesKey, "bait">;

const SPECIES: Record<BodySpecies, Species> = {
  // deep-bodied ambush predator: the primary fish
  bass: {
    depth: 0.28,
    backShare: 0.47,
    backPeak: 0.32,
    bellyPeak: 0.4,
    snout: 0.78,
    stock: 0.15,
    tailLen: 0.17,
    tailSpan: 0.27,
    spiny: [0.3, 0.47],
    soft: [0.5, 0.64],
    dorsalHeight: 0.07,
    anal: [0.7, 0.82],
    analHeight: 0.05,
    gill: 0.19,
    pectoral: 0.22,
    mouth: 0.085,
    eye: 0.075,
  },
  trout: {
    depth: 0.21,
    backShare: 0.48,
    backPeak: 0.38,
    bellyPeak: 0.42,
    snout: 0.8,
    stock: 0.12,
    tailLen: 0.15,
    tailSpan: 0.22,
    spiny: [0.4, 0.46],
    soft: [0.46, 0.56],
    dorsalHeight: 0.05,
    anal: [0.7, 0.8],
    analHeight: 0.035,
    gill: 0.18,
    pectoral: 0.22,
    mouth: 0.06,
    eye: 0.07,
  },
  pike: {
    depth: 0.15,
    backShare: 0.5,
    backPeak: 0.5,
    bellyPeak: 0.52,
    snout: 0.9,
    stock: 0.16,
    tailLen: 0.16,
    tailSpan: 0.2,
    spiny: [0.68, 0.72],
    soft: [0.72, 0.86],
    dorsalHeight: 0.06,
    anal: [0.72, 0.87],
    analHeight: 0.05,
    gill: 0.16,
    pectoral: 0.25,
    mouth: 0.1,
    eye: 0.06,
  },
};

function profile(u: number, peak: number, snout: number, stock: number): number {
  if (u <= peak) return Math.sin(Math.pow(u / peak, snout) * (Math.PI / 2));
  const t = (u - peak) / (1 - peak);
  return stock + (1 - stock) * Math.cos(Math.pow(t, 0.85) * (Math.PI / 2));
}

interface TierStyle {
  /** Back to belly (top to bottom) in fish-length units; opacity comes from the fish. */
  stops: readonly (readonly [number, BrandToken])[];
  /** Pale line along the belly: opacity. */
  belly: number;
  /** Faint outer edge that softens a distant fish (stroke, fish-length units). */
  edge: number;
  detail: boolean;
  fins: boolean;
  /** Lateral gloss in the accent: opacity (the hero fish only). */
  gloss: number;
}

const STYLES: Record<FishTier, TierStyle> = {
  // distant: flat, pale, quiet: a shape in the haze
  far: {
    stops: [
      [0, "secondary"],
      [1, "secondary"],
    ],
    belly: 0,
    edge: 0.03,
    detail: false,
    fins: false,
    gloss: 0,
  },
  // mid-water: slate rather than near-black, so the hero fish (the darkest thing in the water) leads
  mid: {
    stops: [
      [0, "secondary"],
      [0.55, "secondary"],
      [1, "light"],
    ],
    belly: 0.55,
    edge: 0,
    detail: true,
    fins: false,
    gloss: 0,
  },
  // foreground: large, dark, out of focus (drawn into a small buffer and upscaled)
  near: {
    stops: [
      [0, "dark"],
      [0.6, "dark"],
      [1, "secondary"],
    ],
    belly: 0,
    edge: 0,
    detail: false,
    fins: false,
    gloss: 0,
  },
  primary: {
    stops: [
      [0, "dark"],
      [0.3, "dark"],
      [0.54, "secondary"],
      [0.76, "secondary"],
      [1, "light"],
    ],
    belly: 0.7,
    edge: 0,
    detail: true,
    fins: true,
    gloss: 0.3,
  },
};

const MAX_SEGMENTS = 24;
const WAVES = 0.85;

const sx = new Float32Array(MAX_SEGMENTS + 1);
const sy = new Float32Array(MAX_SEGMENTS + 1);
const nx = new Float32Array(MAX_SEGMENTS + 1);
const ny = new Float32Array(MAX_SEGMENTS + 1);
const back = new Float32Array(MAX_SEGMENTS + 1);
const belly = new Float32Array(MAX_SEGMENTS + 1);
const ox = new Float32Array((MAX_SEGMENTS + 1) * 2);
const oy = new Float32Array((MAX_SEGMENTS + 1) * 2);

/** Closed outline through (xs, ys) smoothed with quadratic midpoints. */
function traceClosed(
  ctx: CanvasRenderingContext2D,
  xs: Float32Array,
  ys: Float32Array,
  count: number,
): void {
  ctx.moveTo((xs[count - 1] + xs[0]) / 2, (ys[count - 1] + ys[0]) / 2);
  for (let i = 0; i < count; i++) {
    const j = i + 1 === count ? 0 : i + 1;
    ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2);
  }
}

export function createProceduralFishRenderer(
  palette: BrandPalette,
  segments: number,
): FishRenderer {
  const n = Math.min(MAX_SEGMENTS, Math.max(8, segments));

  const backProfiles = {} as Record<BodySpecies, Float32Array>;
  const bellyProfiles = {} as Record<BodySpecies, Float32Array>;
  for (const key of Object.keys(SPECIES) as BodySpecies[]) {
    const sp = SPECIES[key];
    const b = new Float32Array(n + 1);
    const v = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      b[i] = sp.depth * sp.backShare * profile(u, sp.backPeak, sp.snout, sp.stock);
      v[i] = sp.depth * (1 - sp.backShare) * profile(u, sp.bellyPeak, sp.snout, sp.stock);
    }
    backProfiles[key] = b;
    bellyProfiles[key] = v;
  }

  const gradients = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();
  const cached = (
    ctx: CanvasRenderingContext2D,
    key: string,
    make: () => CanvasGradient,
  ): CanvasGradient => {
    let perCtx = gradients.get(ctx);
    if (!perCtx) {
      perCtx = new Map();
      gradients.set(ctx, perCtx);
    }
    let gradient = perCtx.get(key);
    if (!gradient) {
      gradient = make();
      perCtx.set(key, gradient);
    }
    return gradient;
  };

  const bodyFill = (ctx: CanvasRenderingContext2D, tier: FishTier, species: BodySpecies) =>
    cached(ctx, `body:${tier}:${species}`, () => {
      const reach = SPECIES[species].depth * 0.55;
      const g = ctx.createLinearGradient(0, -reach, 0, reach);
      for (const [offset, token] of STYLES[tier].stops) g.addColorStop(offset, palette.solid(token));
      return g;
    });

  /** Baitfish: back dark, flank silver. */
  const baitFill = (ctx: CanvasRenderingContext2D) =>
    cached(ctx, "bait", () => {
      const g = ctx.createLinearGradient(0, -0.1, 0, 0.1);
      g.addColorStop(0, palette.solid("dark"));
      g.addColorStop(0.45, palette.solid("secondary"));
      g.addColorStop(1, palette.solid("light"));
      return g;
    });

  /** The body transform: head at the origin, body toward -x, in fish lengths. */
  const place = (ctx: CanvasRenderingContext2D, fish: Fish, view: FishView) => {
    ctx.translate(view.x, view.y);
    ctx.rotate(fish.facing > 0 ? -fish.pitch : Math.PI + fish.pitch);
    // `turn` shortens the body while the fish swings toward or away from the camera;
    // the vertical scale carries the facing so the back stays up when the head points left
    ctx.scale(view.length * fish.turn, view.length * fish.facing);
  };

  const drawBait = (ctx: CanvasRenderingContext2D, fish: Fish, view: FishView, alpha: number) => {
    const m = 7;
    const phase = fish.tailPhase;
    const amp = fish.tailAmp;
    let count = 0;
    // dorsal edge head to tail, then ventral edge tail to head
    for (let i = 0; i <= m; i++) {
      const u = i / m;
      const half = 0.075 * Math.sin(Math.PI * Math.pow(u, 0.72) * 0.96) + 0.014;
      ox[count] = -u;
      oy[count] = Math.sin(phase - u * WAVES * TAU) * amp * (0.02 + 0.13 * u * u) - half;
      count++;
    }
    for (let i = m; i >= 0; i--) {
      const u = i / m;
      const half = 0.075 * Math.sin(Math.PI * Math.pow(u, 0.72) * 0.96) + 0.014;
      ox[count] = -u;
      oy[count] = Math.sin(phase - u * WAVES * TAU) * amp * (0.02 + 0.13 * u * u) + half;
      count++;
    }
    const tipY = oy[m] + 0.014; // spine height at the tail
    const spineY = tipY - 0.014;

    ctx.save();
    place(ctx, fish, view);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    traceClosed(ctx, ox, oy, count);
    // forked tail
    ctx.moveTo(-0.97, spineY);
    ctx.lineTo(-1.2, spineY - 0.1);
    ctx.lineTo(-1.14, spineY);
    ctx.lineTo(-1.2, spineY + 0.1);
    ctx.closePath();
    ctx.fillStyle = baitFill(ctx);
    ctx.fill();
    if (fish.glint > 0.04) {
      // a flash of the silver flank as the school turns in the light
      ctx.globalAlpha = alpha * Math.min(1, fish.glint * 1.1);
      ctx.beginPath();
      ctx.moveTo(-0.16, spineY - 0.004);
      ctx.quadraticCurveTo(-0.5, spineY + 0.015, -0.82, spineY - 0.002);
      ctx.strokeStyle = palette.solid("white");
      ctx.lineWidth = 0.034;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();
  };

  return {
    draw(ctx, fish, view) {
      // a fish swinging end-on to the camera softens into the water instead of showing a stubby silhouette
      const endOn = 0.62 + 0.38 * Math.min(1, Math.max(0, (fish.turn - MIN_TURN) / (0.85 - MIN_TURN)));
      const alpha = fish.opacity * view.alpha * endOn;
      if (alpha <= 0.004 || view.length < 2) return;

      if (fish.species === "bait") {
        drawBait(ctx, fish, view, alpha);
        return;
      }

      const sp = SPECIES[fish.species];
      const style = STYLES[fish.tier];
      const backProfile = backProfiles[fish.species];
      const bellyProfile = bellyProfiles[fish.species];
      const amp = fish.tailAmp;
      const phase = fish.tailPhase;
      const bend = fish.bend;

      // spine: still at the head, swinging harder toward the tail; `bend` curls it
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        sx[i] = -u;
        sy[i] = Math.sin(phase - u * WAVES * TAU) * amp * (0.012 + 0.1 * u * u) - bend * 0.34 * u * u;
      }
      for (let i = 0; i <= n; i++) {
        const a = i === 0 ? 0 : i - 1;
        const b = i === n ? n : i + 1;
        let tx = sx[b] - sx[a];
        let ty = sy[b] - sy[a];
        const len = Math.hypot(tx, ty) || 1;
        tx /= len;
        ty /= len;
        nx[i] = -ty; // "up" (dorsal) normal; canvas y is down
        ny[i] = tx;
        back[i] = backProfile[i];
        belly[i] = bellyProfile[i];
      }

      // outline: dorsal edge head to tail, ventral edge tail to head
      let count = 0;
      for (let i = 0; i <= n; i++) {
        ox[count] = sx[i] + nx[i] * back[i];
        oy[count] = sy[i] + ny[i] * back[i];
        count++;
      }
      for (let i = n; i >= 0; i--) {
        ox[count] = sx[i] - nx[i] * belly[i];
        oy[count] = sy[i] - ny[i] * belly[i];
        count++;
      }
      const v = (i: number) => count - 1 - i; // ventral outline index for spine i

      ctx.save();
      place(ctx, fish, view);
      ctx.globalAlpha = alpha;

      // one path: body + caudal + dorsal + anal + pelvic (single fill)
      ctx.beginPath();
      traceClosed(ctx, ox, oy, count);

      // caudal fin follows the tail's own lag
      const tailAngle =
        Math.atan2(sy[n] - sy[n - 1], sx[n] - sx[n - 1]) +
        Math.sin(phase - WAVES * TAU - 0.7) * 0.32 * amp;
      const tc = Math.cos(tailAngle);
      const ts = Math.sin(tailAngle);
      const base = (back[n] + belly[n]) * 0.5;
      const span = sp.tailSpan * 0.5;
      const len = sp.tailLen;
      // local +x toward the tail, local +y toward the dorsal side
      const fx = (lx: number, ly: number) => sx[n] + lx * tc - ly * ts;
      const fy = (lx: number, ly: number) => sy[n] + lx * ts + ly * tc;
      ctx.moveTo(fx(-0.02, base), fy(-0.02, base));
      ctx.quadraticCurveTo(fx(len * 0.55, span * 0.55), fy(len * 0.55, span * 0.55), fx(len, span), fy(len, span));
      ctx.quadraticCurveTo(fx(len * 0.7, span * 0.2), fy(len * 0.7, span * 0.2), fx(len * 0.78, 0), fy(len * 0.78, 0));
      ctx.quadraticCurveTo(fx(len * 0.7, -span * 0.2), fy(len * 0.7, -span * 0.2), fx(len, -span), fy(len, -span));
      ctx.quadraticCurveTo(fx(len * 0.55, -span * 0.55), fy(len * 0.55, -span * 0.55), fx(-0.02, -base), fy(-0.02, -base));
      ctx.closePath();

      // dorsal: spiny front, a notch, then the soft rear lobe (rakes backward)
      const s0 = Math.round(sp.spiny[0] * n);
      const s1 = Math.round(sp.spiny[1] * n);
      const f0 = Math.round(sp.soft[0] * n);
      const f1 = Math.round(sp.soft[1] * n);
      const sm = (s0 + s1) >> 1;
      const fm = (f0 + f1) >> 1;
      const lift = sp.dorsalHeight;
      ctx.moveTo(ox[s0], oy[s0]);
      ctx.quadraticCurveTo(
        ox[sm] + nx[sm] * lift * 1.7 - 0.03,
        oy[sm] + ny[sm] * lift * 1.7,
        ox[s1] + nx[s1] * lift * 0.18,
        oy[s1] + ny[s1] * lift * 0.18,
      );
      ctx.quadraticCurveTo(ox[fm] + nx[fm] * lift * 2.1 - 0.025, oy[fm] + ny[fm] * lift * 2.1, ox[f1], oy[f1]);
      ctx.closePath();

      // anal fin on the ventral edge
      const a0 = Math.round(sp.anal[0] * n);
      const a1 = Math.round(sp.anal[1] * n);
      const am = (a0 + a1) >> 1;
      ctx.moveTo(ox[v(a1)], oy[v(a1)]);
      ctx.quadraticCurveTo(
        ox[v(am)] - nx[am] * sp.analHeight * 1.8 - 0.02,
        oy[v(am)] - ny[am] * sp.analHeight * 1.8,
        ox[v(a0)],
        oy[v(a0)],
      );
      ctx.closePath();

      // pelvic fin
      const p0 = Math.round(0.27 * n);
      const p1 = Math.round(0.34 * n);
      ctx.moveTo(ox[v(p1)], oy[v(p1)]);
      ctx.quadraticCurveTo(ox[v(p0)] - nx[p0] * 0.05 - 0.035, oy[v(p0)] - ny[p0] * 0.05, ox[v(p0)], oy[v(p0)]);
      ctx.closePath();

      ctx.fillStyle = bodyFill(ctx, fish.tier, fish.species as BodySpecies);
      ctx.fill();

      // a faint outer edge softens a distant fish into the haze
      if (style.edge > 0) {
        ctx.strokeStyle = palette.alpha("secondary", 0.22);
        ctx.lineWidth = style.edge;
        ctx.lineJoin = "round";
        ctx.stroke();
      }

      // soft pale line along the belly
      if (style.belly > 0) {
        const end = Math.round(0.78 * n);
        ctx.beginPath();
        ctx.moveTo(ox[v(0)], oy[v(0)]);
        for (let i = 1; i < end; i++) {
          ctx.quadraticCurveTo(
            ox[v(i)],
            oy[v(i)],
            (ox[v(i)] + ox[v(i + 1)]) / 2,
            (oy[v(i)] + oy[v(i + 1)]) / 2,
          );
        }
        ctx.strokeStyle = palette.alpha("white", style.belly);
        ctx.lineWidth = 0.009;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // the hero fish carries a faint brand-blue gloss down the flank
      if (style.gloss > 0) {
        const g0 = Math.round(0.2 * n);
        const g1 = Math.round(0.86 * n);
        ctx.beginPath();
        ctx.moveTo(sx[g0], sy[g0]);
        for (let i = g0 + 1; i < g1; i++) {
          ctx.quadraticCurveTo(sx[i], sy[i], (sx[i] + sx[i + 1]) / 2, (sy[i] + sy[i + 1]) / 2);
        }
        ctx.strokeStyle = palette.alpha("primary", style.gloss);
        ctx.lineWidth = 0.026;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      if (style.detail) {
        // lateral line
        const l0 = Math.round(0.16 * n);
        const l1 = Math.round(0.9 * n);
        ctx.beginPath();
        ctx.moveTo(sx[l0], sy[l0] - ny[l0] * back[l0] * 0.12);
        for (let i = l0 + 1; i < l1; i++) {
          ctx.quadraticCurveTo(
            sx[i],
            sy[i] + ny[i] * back[i] * 0.12,
            (sx[i] + sx[i + 1]) / 2,
            (sy[i] + sy[i + 1]) / 2 + ny[i] * back[i] * 0.12,
          );
        }
        ctx.strokeStyle = palette.alpha("white", fish.tier === "primary" ? 0.34 : 0.22);
        ctx.lineWidth = 0.0035;
        ctx.stroke();

        // gill cover: bulges toward the head
        const g = Math.max(2, Math.round(sp.gill * n));
        ctx.beginPath();
        ctx.moveTo(ox[g], oy[g]);
        ctx.quadraticCurveTo(sx[g] + 0.045, sy[g] - 0.004, ox[v(g)], oy[v(g)]);
        ctx.strokeStyle = palette.alpha("dark", 0.55);
        ctx.lineWidth = 0.005;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox[g] + 0.006, oy[g] + 0.004);
        ctx.quadraticCurveTo(sx[g] + 0.05, sy[g] - 0.004, ox[v(g)] + 0.006, oy[v(g)] - 0.004);
        ctx.strokeStyle = palette.alpha("white", fish.tier === "primary" ? 0.32 : 0.2);
        ctx.lineWidth = 0.003;
        ctx.stroke();

        // pectoral fin: outline only, fans slowly
        const p = Math.round(sp.pectoral * n);
        const fan = Math.sin(phase * 0.5) * 0.22;
        const bx = sx[p] - nx[p] * belly[p] * 0.35;
        const by = sy[p] - ny[p] * belly[p] * 0.35;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - 0.035, by + 0.04 + fan * 0.03, bx - 0.085, by + 0.055 + fan * 0.05);
        ctx.quadraticCurveTo(bx - 0.04, by + 0.015, bx - 0.012, by - 0.006);
        ctx.strokeStyle = palette.alpha("white", 0.3);
        ctx.lineWidth = 0.0035;
        ctx.stroke();

        // eye
        const e = Math.max(1, Math.round(sp.eye * n));
        const ex = sx[e];
        const ey = sy[e] + ny[e] * back[e] * 0.3;
        const eyeR = fish.tier === "primary" ? 0.017 : 0.013;
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, TAU);
        ctx.fillStyle = palette.alpha("white", 0.9);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex - 0.0012, ey, eyeR * 0.62, 0, TAU);
        ctx.fillStyle = palette.solid("dark");
        ctx.fill();
        if (fish.tier === "primary") {
          ctx.beginPath();
          ctx.arc(ex - 0.005, ey - 0.005, 0.0028, 0, TAU);
          ctx.fillStyle = palette.solid("white");
          ctx.fill();
        }

        // mouth: a line, or a pale wedge when the jaws open
        const mouthY = sy[1] + 0.017;
        if (fish.gape > 0.05) {
          // the hero fish opens wide enough to take a whole lure
          const open = fish.gape * (fish.tier === "primary" ? 0.05 : 0.034);
          ctx.beginPath();
          ctx.moveTo(-sp.mouth, mouthY);
          ctx.lineTo(0.004, mouthY - 0.004);
          ctx.lineTo(0.002, mouthY + open);
          ctx.closePath();
          ctx.fillStyle = palette.alpha("white", 0.9);
          ctx.fill();
          ctx.strokeStyle = palette.alpha("dark", 0.7);
          ctx.lineWidth = 0.0035;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(-0.003, sy[0] + 0.006);
          ctx.quadraticCurveTo(-sp.mouth * 0.6, sy[1] + 0.02, -sp.mouth, mouthY);
          ctx.strokeStyle = palette.alpha("dark", 0.75);
          ctx.lineWidth = 0.0042;
          ctx.stroke();
        }
      }

      // fin rays on the hero fish
      if (style.fins) {
        ctx.strokeStyle = palette.alpha("white", 0.22);
        ctx.lineWidth = 0.0022;
        ctx.beginPath();
        for (let r = -2; r <= 2; r++) {
          ctx.moveTo(fx(0.01, r * 0.012), fy(0.01, r * 0.012));
          ctx.lineTo(fx(len * 0.92, r * span * 0.42), fy(len * 0.92, r * span * 0.42));
        }
        for (let i = f0 + 1; i < f1; i += 2) {
          ctx.moveTo(ox[i], oy[i]);
          ctx.lineTo(ox[i] + nx[i] * lift * 1.5 - 0.012, oy[i] + ny[i] * lift * 1.5);
        }
        ctx.stroke();
      }

      ctx.restore();
    },
  };
}
