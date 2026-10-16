import { readFileSync } from "node:fs";
import path from "node:path";

export type RGB = [number, number, number];

/** The colour tokens as theme.css defines them, so the tests never keep a copy of the palette. */
export function readTokens(): Record<string, RGB> {
  const css = readFileSync(path.resolve(__dirname, "../../src/styles/theme.css"), "utf8");
  const out: Record<string, RGB> = {};
  for (const m of css.matchAll(/--color-([\w-]+):\s*#([0-9a-f]{6})/gi)) out[m[1]] = hexToRgb(m[2]);
  return out;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

/** Hue in degrees, saturation and lightness 0 to 1. */
export function hsl([r, g, b]: RGB): { h: number; s: number; l: number } {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  return { h, s, l };
}

export function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: RGB, b: RGB): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const v = [...values].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
}
