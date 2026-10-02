#!/usr/bin/env node
/*
 * Builds the logo assets the site actually uses from the supplied artwork,
 * public/images/mechaavo-logo.jpeg (blue waves on white, the "E" in red).
 *
 *   mechaavo-logo-mark.png     the two-wave mark only (navigation; its alpha is also the story watermark's mask)
 *   mechaavo-logo-lockup.png   mark + MECHAAVO wordmark
 *   app/icon.png               favicon: the mark on white
 *
 * The logo is shown exactly as supplied, in its own colors: the client asked for
 * the same exact logo, and a brand mark is an asset, not part of the UI palette
 * (the eight tokens in src/styles/theme.css govern everything drawn in CSS and
 * canvas). The JPEG has a white background, so each PNG is the artwork lifted off
 * it: alpha from how far a pixel is from white, color un-mixed from the white so
 * edges keep the true blue and red instead of turning pale.
 *
 * Run from the repo root after replacing the JPEG:  node docs/make-logo-assets.mjs
 * (sharp ships with Next.js, so nothing extra is installed.)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public/images/mechaavo-logo.jpeg");
const PAD = 8;

const WHITE = "#FFFFFF"; // the favicon's ground

(async () => {
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // how much ink a pixel carries: 0 on white, ~0.84 on the logo blue, 1 on the red
  const ink = (i) => 1 - Math.min(data[i], data[i + 1], data[i + 2]) / 255;
  const alpha = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const a = (ink(p * 3) - 0.04) / (0.84 - 0.04); // 0.04 drops JPEG noise; 0.84 is full ink
    alpha[p] = Math.round(Math.min(1, Math.max(0, a)) * 255);
  }

  // find the content: rows and columns that carry ink, split into the mark and the wordmark by the empty gap
  const rowInk = new Array(height).fill(0);
  let x0 = width;
  let x1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 64) {
        rowInk[y]++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
  }
  const runs = [];
  let start = -1;
  for (let y = 0; y <= height; y++) {
    const on = y < height && rowInk[y] > 0;
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      runs.push([start, y - 1]);
      start = -1;
    }
  }
  if (runs.length < 2) throw new Error(`expected a mark and a wordmark, found ${runs.length} blocks of ink`);
  const markRows = runs[0];
  const wordRows = runs[runs.length - 1];

  const crop = (top, bottom) => ({
    left: Math.max(0, x0 - PAD),
    top: Math.max(0, top - PAD),
    width: Math.min(width, x1 + PAD + 1) - Math.max(0, x0 - PAD),
    height: Math.min(height, bottom + PAD + 1) - Math.max(0, top - PAD),
  });

  // the artwork on a transparent ground: straight alpha, color un-mixed from the white it was printed on
  const rgba = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const a = alpha[p] / 255;
    if (a < 0.02) continue; // fully transparent
    for (let c = 0; c < 3; c++) {
      const v = 255 - (255 - data[p * 3 + c]) / a;
      rgba[p * 4 + c] = Math.round(Math.min(255, Math.max(0, v)));
    }
    rgba[p * 4 + 3] = alpha[p];
  }
  const artwork = (box) => sharp(rgba, { raw: { width, height, channels: 4 } }).extract(box);

  const mark = crop(markRows[0], markRows[1]);
  const lockup = crop(markRows[0], wordRows[1]);
  // two hues and their edges need few colors: a 128-entry palette keeps the edges smooth at a fraction of the size
  const small = { palette: true, quality: 95, colours: 128, compressionLevel: 9, effort: 10 };
  await artwork(mark).png(small).toFile(path.join(root, "public/images/mechaavo-logo-mark.png"));
  await artwork(lockup).png(small).toFile(path.join(root, "public/images/mechaavo-logo-lockup.png"));
  console.log(`mark   ${mark.width} x ${mark.height}   (aspect ${mark.width} / ${mark.height})`);
  console.log(`lockup ${lockup.width} x ${lockup.height}   (aspect ${lockup.width} / ${lockup.height})`);

  // favicon: the mark, in color, on a white rounded square
  const size = 512;
  const inner = 400;
  const markBuf = await artwork(mark).resize({ width: inner }).png().toBuffer();
  const markMeta = await sharp(markBuf).metadata();
  const rounded = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="112" ry="112" fill="${WHITE}"/></svg>`,
  );
  await sharp(rounded)
    .composite([{ input: markBuf, left: Math.round((size - markMeta.width) / 2), top: Math.round((size - markMeta.height) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "app/icon.png"));
  console.log("favicon written");
})();
