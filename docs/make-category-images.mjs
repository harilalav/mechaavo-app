#!/usr/bin/env node
/**
 * Makes the category photos (public/images/categories/<id>.jpg) from the sources in
 * docs/category-sources/<id>.<jpg|png>, and nothing else: run it after dropping in a new source.
 *
 *   node docs/make-category-images.mjs            all eight
 *   node docs/make-category-images.mjs jig-head   one
 *   node docs/make-category-images.mjs --sheet out.jpg   also write a contact sheet to look at
 *
 * Each photo is cropped to 2:1 around its subject, turned to plain grayscale and has its levels
 * stretched, at 1600 x 800. The colour is not in the file: src/styles/categories.css tints it with the
 * brand tokens (multiply onto --color-primary, a lift of white), exactly as the water footage is
 * (docs/media-credits.md), so the photos carry no colour of their own and the eight stay one set.
 *
 * To use the client's own product photo for a category: put it in docs/category-sources/<id>.jpg
 * (replacing the stock one), set where to look in it below (`zoom`, `x`, `y`, and `rotate` to lay a
 * lure that hangs vertically on its side), run this, and update CATEGORY_MEDIA in lib/config/media.ts
 * (its alt text and credit). Lures read best facing right, as the hero's does.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = path.join(ROOT, "docs/category-sources");
const OUT = path.join(ROOT, "public/images/categories");
const WIDTH = 1600;
const HEIGHT = 800;

/**
 * Where to look in each source, after `rotate` (degrees clockwise: a lure that hangs vertically is laid
 * on its side). The window is always 2:1: `zoom` is its width as a share of the source's (1 = all of it),
 * `x` and `y` the centre of the window as a share of the source's width and height.
 */
const CATEGORIES = {
  "frog-lure": { zoom: 1, x: 0.5, y: 0.26 },
  "soft-lure": { zoom: 0.95, x: 0.52, y: 0.5 },
  "plastic-lure": { zoom: 1, x: 0.5, y: 0.45 },
  "wood-lure": { zoom: 1, x: 0.5, y: 0.55 },
  spinner: { rotate: 90, zoom: 1, x: 0.5, y: 0.5 },
  "metal-jig": { zoom: 0.62, x: 0.55, y: 0.47 },
  "jig-head": { zoom: 0.8, x: 0.5, y: 0.55 },
  "assist-hook": { zoom: 1, x: 0.5, y: 0.5 },
};

function sourceOf(id) {
  for (const ext of ["jpg", "jpeg", "png"]) {
    const file = path.join(SOURCES, `${id}.${ext}`);
    if (existsSync(file)) return file;
  }
  throw new Error(`no source for ${id} in docs/category-sources`);
}

async function make(id) {
  const spec = CATEGORIES[id];
  let image = sharp(sourceOf(id)).rotate(); // honour the camera's own orientation first
  if (spec.rotate) image = sharp(await image.rotate(spec.rotate).toBuffer());
  const { width, height } = await image.metadata();
  const cropWidth = Math.min(width, Math.round(spec.zoom * width), 2 * height);
  const cropHeight = Math.round(cropWidth / 2);
  const region = {
    left: Math.round(Math.min(Math.max(spec.x * width - cropWidth / 2, 0), width - cropWidth)),
    top: Math.round(Math.min(Math.max(spec.y * height - cropHeight / 2, 0), height - cropHeight)),
    width: cropWidth,
    height: cropHeight,
  };
  const file = path.join(OUT, `${id}.jpg`);
  await image
    .extract(region)
    .resize(WIDTH, HEIGHT, { fit: "fill" })
    .grayscale()
    .normalise({ lower: 1, upper: 99 })
    .jpeg({ quality: 76, mozjpeg: true })
    .toFile(file);
  return file;
}

const args = process.argv.slice(2);
const sheetIndex = args.indexOf("--sheet");
const sheet = sheetIndex >= 0 ? args.splice(sheetIndex, 2)[1] : null;
const ids = args.length ? args : Object.keys(CATEGORIES);

mkdirSync(OUT, { recursive: true });
for (const id of ids) {
  if (!CATEGORIES[id]) throw new Error(`unknown category ${id}`);
  console.log(`${id}  ->  ${path.relative(ROOT, await make(id))}`);
}

if (sheet) {
  const cell = [400, 200];
  const cols = 4;
  const all = Object.keys(CATEGORIES);
  const composite = [];
  for (let i = 0; i < all.length; i++) {
    composite.push({
      input: await sharp(path.join(OUT, `${all[i]}.jpg`)).resize(...cell).toBuffer(),
      left: (i % cols) * (cell[0] + 6),
      top: Math.floor(i / cols) * (cell[1] + 6),
    });
  }
  await sharp({
    create: { width: cols * (cell[0] + 6), height: Math.ceil(all.length / cols) * (cell[1] + 6), channels: 3, background: "#ffffff" },
  })
    .composite(composite)
    .jpeg({ quality: 85 })
    .toFile(sheet);
  console.log(`contact sheet: ${sheet}`);
}
