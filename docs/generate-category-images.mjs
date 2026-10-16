#!/usr/bin/env node
/**
 * Generates the category images with Gemini's image model and saves the originals, and nothing else.
 * The prompts live in docs/category-image-prompts.md (the shared style block and one block per id): edit
 * them there, this script only sends them.
 *
 *   node docs/generate-category-images.mjs plastic-lure     the style anchor, make it first and look at it
 *   node docs/generate-category-images.mjs --all            the other seven, the anchor attached as a reference
 *   node docs/generate-category-images.mjs spinner --force  redo one (an existing file is never overwritten otherwise)
 *   node docs/generate-category-images.mjs --dry            print the prompts that would be sent, call nothing
 *
 *   --size 2K|4K   output size (default 2K)        --model <id>   (default gemini-3-pro-image, the top Gemini image model)
 *   --ref <file>   style reference (default: the anchor's file)
 *
 * The key is read from GEMINI_API_KEY in the environment or in .env.local (never printed). Each image is
 * written to docs/category-sources/ai/<id>.png; to use it on the site, copy or convert it to
 * docs/category-sources/<id>.jpg and run docs/make-category-images.mjs (crop and levels, in the image's own colour).
 * Each call costs money: nothing is retried more than twice and a file that exists is skipped.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMPTS = path.join(ROOT, "docs/category-image-prompts.md");
const OUT = path.join(ROOT, "docs/category-sources/ai");
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const ANCHOR = "plastic-lure";
const ALL = ["frog-lure", "soft-lure", "plastic-lure", "wood-lure", "spinner", "metal-jig", "jig-head", "assist-hook"];
const MATCH =
  "Match the attached reference image exactly in camera, lighting, background, shadow, level of detail and the scale of the product in the frame. Only the product changes.";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const ids = flag("--all") ? ALL.filter((id) => id !== ANCHOR) : args.filter((a) => ALL.includes(a));
const size = value("--size", "2K");
const model = value("--model", "gemini-3-pro-image");

if (ids.length === 0 && !flag("--paste")) {
  console.error("Name a category id (or --all). Ids: " + ALL.join(", "));
  process.exit(1);
}
if (!["1K", "2K", "4K"].includes(size)) {
  console.error("--size must be 1K, 2K or 4K (capital K)");
  process.exit(1);
}

/** The shared block and the block of each id, from the prompts file. */
function readPrompts() {
  const md = readFileSync(PROMPTS, "utf8");
  const shared = md.match(/## Shared style block[^\n]*\n+```\n([\s\S]*?)\n```/)?.[1];
  if (!shared) throw new Error("shared style block not found in " + PROMPTS);
  const blocks = {};
  for (const id of ALL) {
    const found = md.match(new RegExp("### " + id + " \\([^\\n]*\\n+```\\n([\\s\\S]*?)\\n```"))?.[1];
    if (!found) throw new Error("block for " + id + " not found in " + PROMPTS);
    blocks[id] = found.trim();
  }
  return { shared: shared.trim(), blocks };
}

function loadKey() {
  if (!process.env.GEMINI_API_KEY && existsSync(path.join(ROOT, ".env.local"))) {
    process.loadEnvFile(path.join(ROOT, ".env.local"));
  }
  return process.env.GEMINI_API_KEY;
}

const fileOf = (id) => {
  for (const ext of ["png", "jpg"]) {
    const file = path.join(OUT, id + "." + ext);
    if (existsSync(file)) return file;
  }
  return null;
};

/** The first block of type image with base64 data, wherever the reply keeps it. */
function findImage(node) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "image" && typeof node.data === "string" && node.data.length > 1000) return node;
  if (node.output_image?.data) return node.output_image;
  for (const child of Object.values(node)) {
    const found = findImage(child);
    if (found) return found;
  }
  return null;
}

/** The reply with every long string cut, so an error can be printed without a megabyte of base64. */
const brief = (node) =>
  JSON.stringify(node, (_, v) => (typeof v === "string" && v.length > 120 ? v.slice(0, 40) + "...(" + v.length + ")" : v), 2);

async function generate(key, prompt, reference) {
  const input = [];
  if (reference) {
    input.push({ type: "image", mime_type: reference.mime, data: reference.data });
    prompt += "\n\n" + MATCH;
  }
  input.push({ type: "text", text: prompt });
  const body = { model, input, response_format: { type: "image", aspect_ratio: "16:9", image_size: size } };
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240_000),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 400) };
    }
    if (res.ok) {
      const image = findImage(json);
      if (!image) throw new Error("no image in the reply:\n" + brief(json));
      return Buffer.from(image.data, "base64");
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    throw new Error("HTTP " + res.status + ":\n" + brief(json));
  }
}

const { shared, blocks } = readPrompts();
const promptOf = (id) => shared + "\n\n" + blocks[id];

if (flag("--paste")) {
  // One file of ready-to-paste prompts for the Antigravity agent panel (no API key): anchor first.
  const order = [ANCHOR, ...ALL.filter((id) => id !== ANCHOR)];
  const lines = [
    "# Paste-ready prompts for the Antigravity agent",
    "",
    "Generated by `node docs/generate-category-images.mjs --paste` from docs/category-image-prompts.md: edit the prompts there, not here.",
    "Use ONE conversation for all eight. Do " + ANCHOR + " first, look at it, then paste the others in the same conversation (the agent keeps the anchor as the style reference).",
    "",
  ];
  for (const id of order) {
    const target = path.join(OUT, id + ".png");
    const intro =
      id === ANCHOR
        ? "This is the STYLE ANCHOR for a set of eight product photos. Later images must match it exactly."
        : "Next image of the same set. Match the " + ANCHOR + " image you made earlier in this conversation exactly in camera, lighting, background, shadow, level of detail and the scale of the product in the frame. Only the product changes.";
    lines.push(
      "---",
      "",
      "## " + (order.indexOf(id) + 1) + ". " + id,
      "",
      "```",
      intro,
      "",
      "Use your image generation tool with the highest-quality Gemini image model available (Nano Banana Pro, gemini-3-pro-image), landscape 16:9, the largest output size it offers. Do not edit, crop, resize or recolour the result afterwards.",
      "",
      promptOf(id),
      "",
      "When the image is made, save the original file to exactly this absolute path (create the folders if missing): " + target,
      "Then reply with: the saved path, how many hook points you can count, and whether any text or logo appears anywhere in the image.",
      "```",
      "",
    );
  }
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, "paste.md");
  writeFileSync(file, lines.join("\n"));
  console.log("wrote " + path.relative(ROOT, file) + " (" + order.length + " prompts)");
  process.exit(0);
}

if (flag("--dry")) {
  for (const id of ids) console.log("=== " + id + " (" + promptOf(id).length + " chars)\n" + promptOf(id) + "\n");
  process.exit(0);
}

const key = loadKey();
if (!key) {
  console.error("GEMINI_API_KEY is not set (environment or .env.local).");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

let reference = null;
if (ids.some((id) => id !== ANCHOR)) {
  const refFile = value("--ref", null) ?? fileOf(ANCHOR);
  if (!refFile || !existsSync(refFile)) {
    console.error("The style anchor is missing: make " + ANCHOR + " first (node docs/generate-category-images.mjs " + ANCHOR + ") or pass --ref <file>.");
    process.exit(1);
  }
  reference = { mime: refFile.endsWith(".png") ? "image/png" : "image/jpeg", data: readFileSync(refFile).toString("base64") };
  console.log("style reference: " + path.relative(ROOT, refFile));
}

let failed = 0;
for (const id of ids) {
  if (fileOf(id) && !flag("--force")) {
    console.log("skip " + id + " (exists, --force to redo)");
    continue;
  }
  const started = Date.now();
  try {
    const bytes = await generate(key, promptOf(id), id === ANCHOR ? null : reference);
    const ext = bytes[0] === 0x89 && bytes[1] === 0x50 ? "png" : "jpg";
    const file = path.join(OUT, id + "." + ext);
    writeFileSync(file, bytes);
    console.log("ok   " + id + "  " + path.relative(ROOT, file) + "  " + Math.round(bytes.length / 1024) + " KB  " + Math.round((Date.now() - started) / 1000) + " s");
  } catch (error) {
    failed++;
    console.error("FAIL " + id + ": " + (error instanceof Error ? error.message : error));
  }
}
process.exit(failed ? 1 : 0);
