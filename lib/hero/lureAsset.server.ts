import { closeSync, existsSync, openSync, readSync } from "node:fs";
import path from "node:path";
import { LURE_IMAGE_SRC } from "./lureConfig";
import type { LureAsset } from "./lureAsset";

/**
 * Server-only: is the production lure PNG present, and can it carry
 * transparency? Reads just the PNG header, so a missing file costs nothing and
 * the browser never makes a request that would 404.
 */
export function readLureAsset(): LureAsset | null {
  const file = path.join(process.cwd(), "public", LURE_IMAGE_SRC.replace(/^\//, ""));
  if (!existsSync(file)) return null;

  const header = Buffer.alloc(26);
  const fd = openSync(file, "r");
  try {
    readSync(fd, header, 0, header.length, 0);
  } finally {
    closeSync(fd);
  }

  const isPng = header.subarray(1, 4).toString("ascii") === "PNG";
  if (!isPng) return null;

  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  const colorType = header[25];
  // 4 = grayscale+alpha, 6 = RGBA; palette (3) may carry tRNS, so let the client probe decide
  const mayHaveAlpha = colorType === 3 || colorType === 4 || colorType === 6;
  if (!mayHaveAlpha || !width || !height) return null;

  return { src: LURE_IMAGE_SRC, width, height };
}
