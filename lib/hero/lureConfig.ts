/**
 * Lure artwork contract, shared by HeroProduct (renders it) and the underwater
 * engine (measures it).
 *
 * PRODUCTION ASSET: drop a transparent-background product cut-out at
 * `public/images/mechaavo-hero-lure.png`, lure facing RIGHT, line eyelet at the
 * nose. HeroProduct detects it, rejects it if its corners are opaque (a boxed
 * photo would read as a floating card), and otherwise uses it in place of the
 * procedural vector lure below.
 *
 * Retune `LURE_ANCHORS` to the real artwork when it lands — they decide where
 * the fishing line attaches and where the fish takes the hook.
 */
export const LURE_IMAGE_SRC = "/images/mechaavo-hero-lure.png";

/** viewBox of the procedural lure (LureArt.tsx). */
export const LURE_ART_SIZE = { width: 1000, height: 420 } as const;

/** Anchor positions as fractions (0–1) of the artwork box. */
export const LURE_ANCHORS = {
  /** line eyelet at the nose */
  tie: { x: 0.932, y: 0.414 },
  /** rear of the body, used to measure lure length */
  tail: { x: 0.074, y: 0.483 },
  /** centre of the belly treble hook — where the fish bites */
  hook: { x: 0.54, y: 0.838 },
} as const;

/** tie → tail distance as a fraction of artwork width. */
export const LURE_LENGTH_RATIO = LURE_ANCHORS.tie.x - LURE_ANCHORS.tail.x;

/** camera zoom → lure scale (the lure sits slightly nearer than mid-depth fish). */
export const LURE_ZOOM_GAIN = 1.05;

/**
 * How long the hero fish is next to the lure: its body length is this many lure
 * lengths. A lure is never bigger than the fish that takes it, so this stays
 * above 1; every other fish scales from the hero fish (lib/underwater/fish.ts),
 * and the fish that circle or pass the lure are never smaller than it.
 * Phones and portrait screens have no room for as long a fish beside the lure.
 */
export const FISH_TO_LURE = { split: 1.85, stacked: 1.6 } as const;

/**
 * Direction the fishing line leaves the nose, in canvas radians (0 = right,
 * negative = up): up and to the right at about 35 degrees, steep enough that a
 * good length of line stays in frame before it leaves at the edge. The line,
 * the lure's resting tilt and the hooked fish's heading all use it.
 */
export const LINE_ANGLE = -0.62;

/** On phones and portrait screens the lure sits near the right edge, so the line climbs more steeply to stay in frame longer. */
export const LINE_ANGLE_STACKED = -0.95;
