#!/usr/bin/env node
/*
 * Builds the share image (Open Graph, also used by X) from the real hero:
 *
 *   app/opengraph-image.jpg       1200 x 630, what a link to the site shows on social media and in chat apps
 *   app/opengraph-image.alt.txt   its text alternative (Next.js reads both by file convention)
 *
 * The hero is screenshotted from a production copy with reduced motion on, so it is one still frame: the
 * lure at rest, every heading finished, nothing caught mid-animation. Rerun after the hero changes:
 *
 *   bash scripts/preview-clone.sh          (a production copy on :3150; never `next build` in the repo)
 *   node docs/make-og-image.mjs            (or --url http://localhost:<port>)
 *
 * Needs Google Chrome (CHROME_PATH overrides the lookup), playwright-core (a dev dependency) and sharp
 * (ships with Next.js).
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const urlArg = process.argv.indexOf("--url");
const url = urlArg > -1 ? process.argv[urlArg + 1] : "http://localhost:3150";
const out = path.join(root, "app/opengraph-image.jpg");
const ALT = "Mechaavo Tackles: engineered for every cast. A fishing lure resting in sunlit water.";
const SIZE = { width: 1200, height: 630 };

const chrome = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
]
  .filter(Boolean)
  .find((p) => existsSync(p));
if (!chrome) throw new Error("Google Chrome not found: set CHROME_PATH");

const browser = await chromium.launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // the engine shows the lure (data-lure) once it has drawn its first frame; the CSS failsafe does after 5 s
  await page.waitForSelector("[data-lure]", { state: "attached", timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const png = await page.screenshot({ type: "png" });
  const jpg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  writeFileSync(out, jpg);
  writeFileSync(path.join(root, "app/opengraph-image.alt.txt"), ALT);
  console.log(`app/opengraph-image.jpg  ${SIZE.width} x ${SIZE.height}  ${Math.round(jpg.length / 1024)} KB  (from ${url})`);
} finally {
  await browser.close();
}
