#!/usr/bin/env node
/*
 * Reads the colours out of a reference photo of the sea (the client's, 2026-10-15) so the
 * water tokens in src/styles/theme.css are the photo's own and not an eyeballed guess.
 *
 *   node docs/sample-ocean.mjs docs/ocean-reference.jpg          5 colours, foam left out
 *   node docs/sample-ocean.mjs docs/ocean-reference.jpg 7        more clusters
 *
 * It clusters the pixels (k-means in sRGB on a thinned grid), leaves out the white foam
 * (very light and barely saturated), and prints each cluster's hex, its share of the water
 * and its lightness, ordered light to dark, with the token each is the best candidate for:
 * sea-shallow (the light azure), sea-mid (the dominant blue), sea-deep (the navy). Nothing is
 * written: copy the three hexes into theme.css by hand, then run `npm run test:ui`.
 *
 * `sharp` comes with Next (its image optimiser); this script is a one-off tool, not part of
 * the build.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const [file, kArg] = process.argv.slice(2);
if (!file) {
  console.error("usage: node docs/sample-ocean.mjs <image> [clusters]");
  process.exit(2);
}
const K = Math.max(3, Math.min(9, Number(kArg) || 5));
const sharp = require("sharp");

const { data, info } = await sharp(file).resize({ width: 240, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

const hsl = ([r, g, b]) => {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = (max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4) * 60;
  return { h, s, l };
};

// the water: everything that is not foam (light and washed out) or glare
const px = [];
for (let i = 0; i < data.length; i += info.channels) {
  const c = [data[i], data[i + 1], data[i + 2]];
  const { s, l } = hsl(c);
  if (l > 0.82 || (s < 0.22 && l > 0.6)) continue;
  px.push(c);
}
if (px.length < 50) {
  console.error("hardly any water pixels found: is this the right picture?");
  process.exit(1);
}

// k-means++ seeding, 24 rounds
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
let centers = [px[Math.floor(rnd() * px.length)]];
while (centers.length < K) {
  const d = px.map((p) => Math.min(...centers.map((c) => dist2(p, c))));
  const total = d.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  let pick = 0;
  for (; pick < d.length - 1; pick++) {
    r -= d[pick];
    if (r <= 0) break;
  }
  centers.push(px[pick]);
}
let labels = new Array(px.length).fill(0);
for (let round = 0; round < 24; round++) {
  labels = px.map((p) => {
    let best = 0, bd = Infinity;
    centers.forEach((c, i) => {
      const dd = dist2(p, c);
      if (dd < bd) { bd = dd; best = i; }
    });
    return best;
  });
  centers = centers.map((c, i) => {
    const members = px.filter((_, j) => labels[j] === i);
    if (!members.length) return c;
    return [0, 1, 2].map((ch) => members.reduce((a, m) => a + m[ch], 0) / members.length);
  });
}

const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const rows = centers
  .map((c, i) => ({ c, share: labels.filter((l) => l === i).length / px.length, ...hsl(c) }))
  .sort((a, b) => b.l - a.l);

const dominant = rows.reduce((a, b) => (b.share > a.share ? b : a));
console.log(`${file}: ${px.length} water pixels of ${data.length / info.channels} (foam and glare left out)\n`);
for (const r of rows) {
  const role = r === rows[0] ? "sea-shallow (lightest)" : r === rows[rows.length - 1] ? "sea-deep (darkest)" : r === dominant ? "sea-mid (dominant)" : "";
  console.log(`${hex(r.c)}  ${(r.share * 100).toFixed(1).padStart(5)}%  hue ${r.h.toFixed(0).padStart(3)}  sat ${(r.s * 100).toFixed(0).padStart(3)}%  light ${(r.l * 100).toFixed(0).padStart(3)}%  ${role}`);
}
