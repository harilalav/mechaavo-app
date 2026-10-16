import type { Page } from "@playwright/test";
import type { RGB } from "./color";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Pixels of a screenshot, read back in the browser itself (createImageBitmap onto a canvas),
 * so the suite needs no image library. `step` thins the grid (every n-th pixel each way).
 * The screenshot is taken at CSS scale, so boxes are in CSS pixels.
 */
export async function samplePixels(page: Page, png: Buffer, boxes: Box[], step = 4): Promise<RGB[][]> {
  const scratch = await page.context().newPage();
  try {
    await scratch.setContent("<!doctype html><title>pixels</title>");
    return await scratch.evaluate(
      async ({ data, boxes, step }) => {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return boxes.map(() => []);
        ctx.drawImage(bitmap, 0, 0);
        return boxes.map((b) => {
          const x = Math.max(0, Math.floor(b.x));
          const y = Math.max(0, Math.floor(b.y));
          const w = Math.max(1, Math.min(bitmap.width - x, Math.floor(b.w)));
          const h = Math.max(1, Math.min(bitmap.height - y, Math.floor(b.h)));
          const img = ctx.getImageData(x, y, w, h).data;
          const out: [number, number, number][] = [];
          for (let j = 0; j < h; j += step) {
            for (let i = 0; i < w; i += step) {
              const k = (j * w + i) * 4;
              out.push([img[k], img[k + 1], img[k + 2]]);
            }
          }
          return out;
        });
      },
      { data: png.toString("base64"), boxes, step },
    );
  } finally {
    await scratch.close();
  }
}

/** A screenshot at CSS scale (one image pixel per CSS pixel, whatever the device's density). */
export function cssShot(page: Page): Promise<Buffer> {
  return page.screenshot({ scale: "css", animations: "allow" });
}
