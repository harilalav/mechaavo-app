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

/**
 * The photo of each product category (components/showcase/ProductCategories.tsx), keyed by the
 * category's id. They are stock placeholders, all public domain or CC0, from Wikimedia Commons (the
 * credits are in docs/media-credits.md): to use the brand's own product photo, drop it into
 * docs/category-sources and run docs/make-category-images.mjs, then change the alt text here.
 *
 * The files are plain grayscale at 2:1 (1600 x 800); src/styles/categories.css tints them with the
 * brand tokens, so they carry no colour of their own. The alt text says what the photo shows (it is
 * not always the category: the frog lure's photo is of topwater lures, until there is one of a frog).
 * Inside a tile the photo is decoration (the button already has the category's name) and the alt is
 * not used; in the inspector it is the image's description.
 */
export interface CategoryPhoto {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export const CATEGORY_MEDIA: Readonly<Record<string, CategoryPhoto>> = {
  "frog-lure": {
    src: "/images/categories/frog-lure.jpg",
    width: 1600,
    height: 800,
    alt: "A topwater popper lure with feathered hooks on a plain background",
  },
  "soft-lure": {
    src: "/images/categories/soft-lure.jpg",
    width: 1600,
    height: 800,
    alt: "A soft plastic swimbait shaped like a pike, on a plain background",
  },
  "plastic-lure": {
    src: "/images/categories/plastic-lure.jpg",
    width: 1600,
    height: 800,
    alt: "Two hard plastic minnow lures with treble hooks on a plain background",
  },
  "wood-lure": {
    src: "/images/categories/wood-lure.jpg",
    width: 1600,
    height: 800,
    alt: "A balsa wood topwater lure with propellers and treble hooks",
  },
  spinner: {
    src: "/images/categories/spinner.jpg",
    width: 1600,
    height: 800,
    alt: "Two inline spinners with metal blades and feathered hooks",
  },
  "metal-jig": {
    src: "/images/categories/metal-jig.jpg",
    width: 1600,
    height: 800,
    alt: "A metal spoon lure with a treble hook",
  },
  "jig-head": {
    src: "/images/categories/jig-head.jpg",
    width: 1600,
    height: 800,
    alt: "A lead jig head with a hook, fitted with a soft plastic worm",
  },
  "assist-hook": {
    src: "/images/categories/assist-hook.jpg",
    width: 1600,
    height: 800,
    alt: "Three fish hooks of different sizes on a plain background",
  },
};
