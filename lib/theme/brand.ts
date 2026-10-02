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
};

type RGB = readonly [number, number, number];

export interface BrandPalette {
  /** Token color at the given opacity (0–1), as a Canvas-ready string. Cached. */
  alpha(token: BrandToken, alpha: number): string;
  /** Token color, fully opaque. */
  solid(token: BrandToken): string;
  /** Token channels (0–255), for code that builds pixels directly (the caustic tile). */
  rgb(token: BrandToken): readonly [number, number, number];
}

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

  return {
    alpha,
    solid: (token) => alpha(token, 1),
    rgb: (token) => rgb[token] ?? [0, 0, 0],
  };
}
