/**
 * Caustic light: the shifting web of bright lines that sunlight makes after
 * passing through a rippling water surface.
 *
 * One small seamless tile is generated once, shortly after the engine starts, as white
 * (the palette's own white, read at runtime) with the pattern in its alpha
 * channel. The hero lays it over the scene twice, at different scales and
 * drifting in opposite directions, so the light moves across the fish and the
 * lure. The pattern is the classic tiling caustic: a few iterations of a
 * warped sine lattice.
 */

const TAU = Math.PI * 2;
const ITERATIONS = 6;
const INTENSITY = 0.005;
const TIME = 23;

/** Rows computed before handing the thread back, so building the tile never blocks input or paint. */
const ROWS_PER_SLICE = 24;

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * A data URL for a `size` x `size` tile (WebP where the browser can encode it,
 * PNG otherwise), or null when a canvas is unavailable or `isCancelled()` turns
 * true. Computed in small slices with the thread released between them.
 */
export async function createCausticTile(
  size: number,
  rgb: readonly [number, number, number],
  isCancelled: () => boolean = () => false,
): Promise<string | null> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    if (y > 0 && y % ROWS_PER_SLICE === 0) {
      await yieldToBrowser();
      if (isCancelled()) return null;
    }
    for (let x = 0; x < size; x++) {
      // the offset keeps the (non-periodic) division terms nearly constant across the tile, which is what makes it seamless
      const px = ((x / size) * TAU) % TAU - 250;
      const py = ((y / size) * TAU) % TAU - 250;
      let ix = px;
      let iy = py;
      let c = 1;
      for (let n = 0; n < ITERATIONS; n++) {
        const t = TIME * (1 - 3.5 / (n + 1));
        const nx = px + Math.cos(t - ix) + Math.sin(t + iy);
        const ny = py + Math.sin(t - iy) + Math.cos(t + ix);
        ix = nx;
        iy = ny;
        c += 1 / Math.hypot(px / (Math.sin(ix + t) / INTENSITY), py / (Math.cos(iy + t) / INTENSITY));
      }
      c /= ITERATIONS;
      c = 1.17 - Math.pow(c, 1.4);
      // thin bright filaments on clear water: keep only the strong part of the pattern
      const line = Math.min(1, Math.pow(Math.abs(c), 5));
      const k = Math.min(1, Math.max(0, (line - 0.14) / 0.76));
      const alpha = k * k * (3 - 2 * k);
      const i = (y * size + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}
