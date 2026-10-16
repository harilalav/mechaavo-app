/**
 * Media sources, in one place.
 *
 * There is no video on the site (the water loop was removed 2026-10-16: the water is token-graded CSS and the
 * hero's canvas). What is left here is the photo of each product category.
 */

/**
 * The photo of each product category (the plates in components/showcase/CategoryCard.tsx and the
 * inspector in CategoryInspector.tsx), keyed by the
 * category's id. They are stock placeholders, all public domain or CC0, from Wikimedia Commons (the
 * credits are in docs/media-credits.md): to use the brand's own product photo, drop it into
 * docs/category-sources and run docs/make-category-images.mjs, then change the alt text here. (A set of
 * Gemini-generated studio images was tried on 2026-10-16 and put back: its originals are in
 * docs/category-sources/ai/, its prompts in docs/category-image-prompts.md.)
 *
 * The files are 2:1 (1600 x 800) in their own colour: nothing in the CSS tints or greys them. The alt text
 * says what the photo shows (it is not always the category: the frog lure's photo is of topwater lures,
 * until there is one of a frog). Inside a plate the photo is decoration (the button already has the
 * category's name) and the alt is not used; in the inspector it is the image's description.
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
