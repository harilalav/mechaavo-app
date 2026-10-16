/**
 * Runtime bridge between the Mechaavo CSS tokens (src/styles/theme.css) and
 * Canvas 2D, which cannot consume `var(--token)` directly.
 *
 * Nothing here defines a color. Values are read from the live CSS custom
 * properties, so theme.css stays the single source of truth. `alpha()` only
 * adds opacity to an approved token; it never introduces a new base color.
 */

export const BRAND_TOKENS = [
  "primary",
  "secondary",
  "dark",
  "surface",
  "light",
  "white",
  "accentPrimary",
  "accentSecondary",
  "seaShallow",
  "seaMid",
  "seaDeep",
  "brandBlue",
] as const;

export type BrandToken = (typeof BRAND_TOKENS)[number];

const TOKEN_VARIABLE: Record<BrandToken, string> = {
  primary: "--color-primary",
  secondary: "--color-secondary",
  dark: "--color-dark",
  surface: "--color-surface",
  light: "--color-light",
  white: "--color-white",
  accentPrimary: "--color-accent-primary",
  accentSecondary: "--color-accent-secondary",
  seaShallow: "--color-sea-shallow",
  seaMid: "--color-sea-mid",
  seaDeep: "--color-sea-deep",
  brandBlue: "--color-brand-blue",
};

type RGB = readonly [number, number, number];

export interface BrandPalette {
  /** Token color at the given opacity (0–1), as a Canvas-ready string. Cached. */
  alpha(token: BrandToken, alpha: number): string;
  /** Token color, fully opaque. */
  solid(token: BrandToken): string;
  /** Token channels (0–255), for code that builds pixels directly (the caustic tile). */
  rgb(token: BrandToken): readonly [number, number, number];
  /**
   * Two tokens blended in sRGB (`t` 0 = a, 1 = b) at an opacity, the canvas twin of
   * CSS `color-mix(in srgb, a, b)`. Used for countershading and depth fog on the fish
   * and the seabed; like `alpha()` it only blends approved tokens. Cached.
   */
  mix(a: BrandToken, b: BrandToken, t: number, alpha?: number): string;
  /**
   * Weighted blend of several tokens (weights are normalised), for a shade that is
   * itself mixed into the water, such as a fish's flank fogged by distance. Cached.
   */
  blend(parts: readonly (readonly [BrandToken, number])[], alpha?: number): string;
}

/** A shade as a weighted blend of tokens, resolved by `BrandPalette.blend`. */
export type BrandShade = readonly (readonly [BrandToken, number])[];

const ALPHA_STEPS = 100;
const TRANSPARENT = "transparent";

function parseHex(raw: string): RGB | null {
  const hex = raw.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function readBrandPalette(
  root: Element = document.documentElement,
): BrandPalette {
  const styles = getComputedStyle(root);
  const rgb = {} as Record<BrandToken, RGB | null>;
  const cache = {} as Record<BrandToken, (string | undefined)[]>;

  for (const token of BRAND_TOKENS) {
    const parsed = parseHex(styles.getPropertyValue(TOKEN_VARIABLE[token]));
    if (!parsed && process.env.NODE_ENV !== "production") {
      console.warn(`[brand] ${TOKEN_VARIABLE[token]} did not resolve to a hex value.`);
    }
    rgb[token] = parsed;
    cache[token] = new Array<string | undefined>(ALPHA_STEPS + 1);
  }

  const alpha = (token: BrandToken, a: number): string => {
    const channels = rgb[token];
    if (!channels) return TRANSPARENT;
    const step = Math.max(0, Math.min(ALPHA_STEPS, Math.round(a * ALPHA_STEPS)));
    const hit = cache[token][step];
    if (hit) return hit;
    const value = `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${step / ALPHA_STEPS})`;
    cache[token][step] = value;
    return value;
  };

  // keyed by token pair, blend step and opacity step: the fish ask for the same few
  // blends every frame, so after the first frames nothing new is built
  const mixCache = new Map<string, string>();
  const mix = (a: BrandToken, b: BrandToken, t: number, opacity = 1): string => {
    const ca = rgb[a];
    const cb = rgb[b];
    if (!ca || !cb) return TRANSPARENT;
    const ts = Math.max(0, Math.min(ALPHA_STEPS, Math.round(t * ALPHA_STEPS)));
    const as = Math.max(0, Math.min(ALPHA_STEPS, Math.round(opacity * ALPHA_STEPS)));
    const key = `${a}|${b}|${ts}|${as}`;
    const hit = mixCache.get(key);
    if (hit) return hit;
    const k = ts / ALPHA_STEPS;
    const ch = (i: number) => Math.round(ca[i] + (cb[i] - ca[i]) * k);
    const value = `rgba(${ch(0)}, ${ch(1)}, ${ch(2)}, ${as / ALPHA_STEPS})`;
    mixCache.set(key, value);
    return value;
  };

  const blendCache = new Map<string, string>();
  const blend = (parts: BrandShade, opacity = 1): string => {
    const as = Math.max(0, Math.min(ALPHA_STEPS, Math.round(opacity * ALPHA_STEPS)));
    let key = `${as}`;
    for (const [token, w] of parts) key += `|${token}:${Math.round(w * 1000)}`;
    const hit = blendCache.get(key);
    if (hit) return hit;
    let r = 0;
    let g = 0;
    let b = 0;
    let total = 0;
    for (const [token, w] of parts) {
      const c = rgb[token];
      if (!c || w <= 0) continue;
      r += c[0] * w;
      g += c[1] * w;
      b += c[2] * w;
      total += w;
    }
    const value =
      total > 0
        ? `rgba(${Math.round(r / total)}, ${Math.round(g / total)}, ${Math.round(b / total)}, ${as / ALPHA_STEPS})`
        : TRANSPARENT;
    blendCache.set(key, value);
    return value;
  };

  return {
    alpha,
    solid: (token) => alpha(token, 1),
    rgb: (token) => rgb[token] ?? [0, 0, 0],
    mix,
    blend,
  };
}
