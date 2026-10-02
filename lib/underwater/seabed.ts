import type { BrandPalette } from "../theme/brand";
import type { Current } from "./current";
import { createRng, range, TAU } from "./rng";

/**
 * Distant seabed silhouettes: rock ridges painted once into offscreen canvases
 * (on resize) and parallaxed per frame with drawImage, plus the weed that grows
 * from the near ridge. The ridges are still; the weed is drawn live, blade by
 * blade, so it leans downstream and sways with the water's current (the same
 * signal that moves the lure and its line; see current.ts).
 * In the bright water they are slate tints in `secondary` and `dark`, fading
 * toward the haze with distance: pure depth cues.
 */
export interface WeedBlades {
  count: number;
  /** Base of each blade in the layer's own pixels. */
  x: Float32Array;
  y: Float32Array;
  rise: Float32Array;
  /** Resting lean, as a fraction of the blade's height. */
  lean: Float32Array;
  width: Float32Array;
  phase: Float32Array;
  /** Stroke style shared by the layer's blades. */
  style: string;
}

export interface SeabedLayer {
  canvas: HTMLCanvasElement;
  /** 0 far, 1 near; drives parallax strength. */
  depth: number;
  /** Layer height in CSS px, including the foot below the screen's bottom edge. */
  height: number;
  /** How much of `height` is that foot: the camera descends, so the layer must reach below the frame. */
  foot: number;
  weed: WeedBlades | null;
}

interface LayerSpec {
  depth: number;
  heightRatio: number;
  baseRatio: number;
  amplitude: number;
  /** Clusters of weed on the ridge (zero for none). */
  weed: number;
  /** Opacity of the ridge at its crest and at its foot. */
  crest: number;
  foot: number;
  weedAlpha: number;
}

const SPECS: LayerSpec[] = [
  // far ridge: hazy, defines the horizon of the seabed
  { depth: 0.22, heightRatio: 0.34, baseRatio: 0.62, amplitude: 0.2, weed: 0, crest: 0.12, foot: 0.22, weedAlpha: 0 },
  // near ridge: darker, carries the weed
  { depth: 0.7, heightRatio: 0.26, baseRatio: 0.58, amplitude: 0.26, weed: 22, crest: 0.26, foot: 0.5, weedAlpha: 0.36 },
];

/**
 * `weedDensity` (0-1) thins the weed on small screens, where the bottom of the
 * frame is already crowded with fish: fewer, shorter blades.
 */
export function createSeabed(
  palette: BrandPalette,
  width: number,
  height: number,
  layerCount: number,
  weedDensity: number,
  seed: number,
): SeabedLayer[] {
  const rng = createRng(seed);
  const specs = layerCount >= 2 ? SPECS : [SPECS[1]];
  const scale = Math.min(window.devicePixelRatio || 1, 1.5);
  const layers: SeabedLayer[] = [];

  for (const spec of specs) {
    const canvas = document.createElement("canvas");
    // wider than the viewport so horizontal sway / push-in never shows an edge
    const layerWidth = width * 1.5;
    const body = Math.round(height * spec.heightRatio);
    // the camera sinks through the water, lifting the seabed; the extra foot keeps the bottom edge covered
    const foot = Math.round(height * 0.16);
    const layerHeight = body + foot;
    canvas.width = Math.round(layerWidth * scale);
    canvas.height = Math.round(layerHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.scale(scale, scale);

    const p1 = range(rng, 0, TAU);
    const p2 = range(rng, 0, TAU);
    const p3 = range(rng, 0, TAU);
    const base = body * spec.baseRatio;
    const amp = body * spec.amplitude;
    const ridge = (x: number) => {
      const t = x / layerWidth;
      return (
        base -
        amp * (0.55 * Math.sin(t * 5.1 + p1) + 0.3 * Math.sin(t * 11.7 + p2) + 0.15 * Math.abs(Math.sin(t * 23 + p3)))
      );
    };

    const fill = ctx.createLinearGradient(0, base - amp, 0, layerHeight);
    fill.addColorStop(0, palette.alpha("secondary", spec.crest));
    fill.addColorStop(1, palette.alpha(spec.weed === 0 ? "secondary" : "dark", spec.foot));
    ctx.beginPath();
    ctx.moveTo(0, layerHeight);
    for (let x = 0; x <= layerWidth; x += 12) ctx.lineTo(x, ridge(x));
    ctx.lineTo(layerWidth, layerHeight);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    // faint rim so the far ridge reads against the water behind it
    if (spec.weed === 0) {
      ctx.beginPath();
      for (let x = 0; x <= layerWidth; x += 12) {
        if (x === 0) ctx.moveTo(x, ridge(x));
        else ctx.lineTo(x, ridge(x));
      }
      ctx.strokeStyle = palette.alpha("secondary", 0.18);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // weed: slim tapered blades rising from the near ridge, kept as data and drawn live
    let weed: WeedBlades | null = null;
    const clusters = Math.round(spec.weed * weedDensity);
    if (clusters > 0) {
      const planned: { x: number; y: number; rise: number; lean: number; width: number; phase: number }[] = [];
      for (let i = 0; i < clusters; i++) {
        const x = range(rng, 0.03, 0.97) * layerWidth;
        const y = ridge(x) + 4;
        const blades = 2 + Math.floor(rng() * 3);
        for (let b = 0; b < blades; b++) {
          planned.push({
            x: x + (b - blades / 2) * range(rng, 4, 9),
            y,
            rise: range(rng, 0.18, 0.5) * body * (0.7 + 0.3 * weedDensity),
            lean: range(rng, -0.5, 0.5) * 0.5,
            width: range(rng, 1.4, 3.2),
            phase: range(rng, 0, TAU),
          });
        }
      }
      weed = {
        count: planned.length,
        x: Float32Array.from(planned, (p) => p.x),
        y: Float32Array.from(planned, (p) => p.y),
        rise: Float32Array.from(planned, (p) => p.rise),
        lean: Float32Array.from(planned, (p) => p.lean),
        width: Float32Array.from(planned, (p) => p.width),
        phase: Float32Array.from(planned, (p) => p.phase),
        style: palette.alpha("dark", spec.weedAlpha),
      };
    }

    layers.push({ canvas, depth: spec.depth, height: layerHeight, foot, weed });
  }
  return layers;
}

/**
 * Draw a layer's weed. (dx, dy) is where the layer's top-left corner lands on
 * screen and `z` the scale the layer was drawn at, so blades stay on the ridge
 * through the camera's parallax. The current leans every blade downstream; each
 * waves on its own phase, the tip more than the root.
 */
export function drawWeed(
  ctx: CanvasRenderingContext2D,
  layer: SeabedLayer,
  dx: number,
  dy: number,
  z: number,
  current: Current,
): void {
  const weed = layer.weed;
  if (!weed) return;
  // leeward lean grows with the push of the water
  const bend = current.x * 0.24;
  ctx.lineCap = "round";
  ctx.strokeStyle = weed.style;
  for (let i = 0; i < weed.count; i++) {
    const phase = weed.phase[i];
    const wave =
      0.075 * Math.sin(current.swell * 1.1 + phase + weed.x[i] * 0.003) +
      0.03 * Math.sin(current.swell * 2.3 + phase * 1.7);
    const rise = weed.rise[i] * z;
    const tip = (weed.lean[i] + bend + wave) * rise;
    const bx = dx + weed.x[i] * z;
    const by = dy + weed.y[i] * z;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + tip * 0.2, by - rise * 0.55, bx + tip, by - rise);
    ctx.lineWidth = weed.width[i] * (0.8 + 0.2 * z);
    ctx.stroke();
  }
}
