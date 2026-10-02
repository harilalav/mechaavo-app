/**
 * Production lure artwork detection (client side).
 *
 * The server half (lureAsset.server.ts) tells us whether a PNG exists and its
 * size. This half decodes it once and checks the four corners are transparent.
 * A cut-out has transparent corners; a boxed product photo does not — and a
 * boxed photo would bring back exactly the "floating image card" the hero is
 * meant to get rid of, so it is rejected (never faked with CSS masks/blend).
 */
export interface LureAsset {
  src: string;
  width: number;
  height: number;
}

export function probeTransparentLure(asset: LureAsset): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onerror = () => resolve(false);
    image.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(false);
        ctx.drawImage(image, 0, 0, size, size);
        const corners: ReadonlyArray<readonly [number, number]> = [
          [0, 0],
          [size - 1, 0],
          [0, size - 1],
          [size - 1, size - 1],
        ];
        const transparent = corners.every(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] < 12);
        if (!transparent && process.env.NODE_ENV !== "production") {
          console.warn(
            `[hero] ${asset.src} has opaque corners, so it is a boxed photo and not a cut-out. ` +
              "Using the vector lure until a transparent PNG is provided.",
          );
        }
        resolve(transparent);
      } catch {
        resolve(false);
      }
    };
    image.src = asset.src;
  });
}
