/**
 * Media sources, in one place.
 *
 * The story loop is stored as plain grayscale (see docs/media-credits.md), so it
 * carries no color of its own; src/styles/story.css tints it with brand tokens.
 * Three renditions of the same loop exist so each screen downloads only what it
 * can show: the 4K file is for large or high-density displays.
 */
export interface VideoRendition {
  src: string;
  /** Smallest on-screen width, in device pixels, this rendition is meant for. */
  minDevicePx: number;
}

export const STORY_VIDEO = {
  poster: { src: "/videos/story-water-poster.jpg", width: 1920, height: 1080 },
  /** Ordered best to lightest. */
  renditions: [
    { src: "/videos/story-water-2160.mp4", minDevicePx: 2400 },
    { src: "/videos/story-water-1080.mp4", minDevicePx: 1100 },
    { src: "/videos/story-water-720.mp4", minDevicePx: 0 },
  ],
} as const satisfies {
  poster: { src: string; width: number; height: number };
  renditions: readonly VideoRendition[];
};

/**
 * The categories card plays the same water loop (the same files, so there is
 * nothing more to host or download). It has its own name so a dedicated clip is a
 * one-line swap here.
 */
export const CATEGORIES_VIDEO = STORY_VIDEO;

/**
 * Pick the lightest rendition that still fills the panel sharply.
 * Density counts up to 2x (a 3x phone does not need more pixels than a 2x one),
 * and data-saver always gets the lightest file.
 */
export function pickRendition(
  renditions: readonly VideoRendition[],
  cssWidth: number,
  devicePixelRatio: number,
  saveData: boolean,
): VideoRendition {
  const lightest = renditions[renditions.length - 1];
  if (saveData) return lightest;
  const devicePx = cssWidth * Math.min(devicePixelRatio || 1, 2);
  return renditions.find((r) => devicePx >= r.minDevicePx) ?? lightest;
}
