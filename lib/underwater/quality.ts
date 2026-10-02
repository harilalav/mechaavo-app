/**
 * Quality profiles. Every size keeps the whole concept (lure + hero fish +
 * strike + schooling baitfish) but runs a population that suits the screen:
 * the smaller the screen, the fewer BIG fish, because the fish are sized from
 * the lure and the lure from the width, so a crowd that looks calm on a wide
 * monitor fills a laptop or a phone. The small fish (far fish, baitfish schools)
 * carry the life of the water everywhere; the big ones are kept to a few.
 */
export type QualityTier = "phone" | "tablet" | "laptop" | "desktop" | "wide";

export interface QualityProfile {
  tier: QualityTier;
  /** Phone-class budget: fewer fish, motes and layers. */
  mobile: boolean;
  /** Stacked layout (phones and any portrait viewport): copy above, lure centred. */
  stacked: boolean;
  /** Upper bound for devicePixelRatio. */
  dprCap: number;
  /** Single swimmers crossing the frame, by depth. */
  far: number;
  mid: number;
  near: number;
  /** Extra mid fish that circle the lure as the story engages. */
  visitors: number;
  /** Baitfish schools, and fish per school. */
  schools: number;
  schoolSize: number;
  particles: number;
  seabedLayers: number;
  /** How much weed grows on the seabed, 0-1 (it is what crowds the bottom of a small screen). */
  weed: number;
  /** Spine segments per fish body. */
  segments: number;
  /** Out-of-focus foreground fish drawn into a small buffer and upscaled (cheap blur). */
  soft: boolean;
}

/** Must match the stacked-layout media query in src/styles/underwater.css. */
export const STACKED_QUERY = "(max-width: 767px), (max-aspect-ratio: 1/1)";

export function isStacked(width: number, height: number): boolean {
  return width < 768 || width <= height;
}

export function getQuality(width: number, height: number): QualityProfile {
  const stacked = isStacked(width, height);

  if (width < 768) {
    // phones: 5 far + 2 mid + 1 near + 2 visitors + 8 bait + hero = 19 fish
    return {
      tier: "phone",
      mobile: true,
      stacked,
      dprCap: 1.5,
      far: 5,
      mid: 2,
      near: 1,
      visitors: 2,
      schools: 1,
      schoolSize: 8,
      particles: 40,
      seabedLayers: 1,
      weed: 0.4,
      segments: 14,
      soft: false,
    };
  }

  if (stacked || width < 1280) {
    // tablets and small landscape windows: 6 far + 3 mid + 1 near + 2 visitors + 16 bait + hero
    return {
      tier: "tablet",
      mobile: false,
      stacked,
      dprCap: 2,
      far: 6,
      mid: 3,
      near: 1,
      visitors: 2,
      schools: 2,
      schoolSize: 8,
      particles: 75,
      seabedLayers: 2,
      weed: 0.6,
      segments: 14,
      soft: false,
    };
  }

  if (width < 1600) {
    // laptops, 13 to 16 inch: 7 far + 4 mid + 2 near + 2 visitors + 20 bait + hero = 36 fish
    return {
      tier: "laptop",
      mobile: false,
      stacked,
      dprCap: 2,
      far: 7,
      mid: 4,
      near: 2,
      visitors: 2,
      schools: 2,
      schoolSize: 10,
      particles: 96,
      seabedLayers: 2,
      weed: 0.75,
      segments: 16,
      soft: false,
    };
  }

  // desktop monitors: 8 far + 5 mid + 2 near + 3 visitors + 24 bait + hero = 43 fish
  return {
    tier: width < 2200 ? "desktop" : "wide",
    mobile: false,
    stacked,
    dprCap: 2,
    far: 8,
    mid: 5,
    near: 2,
    visitors: 3,
    schools: 2,
    schoolSize: 12,
    particles: 110,
    seabedLayers: 2,
    weed: 1,
    segments: 16,
    soft: true,
  };
}
