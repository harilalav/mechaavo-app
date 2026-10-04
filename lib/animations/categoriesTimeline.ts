import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * The categories card opening: ONE scrubbed ScrollTrigger timeline.
 *
 * Nothing is pinned by JavaScript. The section is a tall track and the stage is
 * `position: sticky` inside it (src/styles/categories.css), so this timeline is
 * scrubbed over the track's scroll distance and the browser does the sticking.
 * Scroll backwards and everything reverses.
 *
 * The timeline is 100 units long, so every position below is a percentage of that
 * distance (1.25 screens of scroll: --cat-screens in categories.css, minus the stage's own screen):
 *   0-4     the closed portrait card at rest, preview on it
 *   4-50    the card opens: `--open` goes 0 to 1 (the window's insets and radius, the
 *           water's scale, the shadow and the pause button all follow in CSS)
 *   4-26    the white preview shrinks and fades
 *   30-52   the catalog (frosted glass) fades in, its content rising a little, and
 *           (from the 42% mark) its heading plays its arrival
 *   52-100  held open, so the catalog can be used before the stage lets go
 *
 * The card's size is NOT tweened here, and nothing in the layout moves (a card
 * that grew by width and height counted as layout shift on every frame of the
 * scroll): the units (clamp, vw, svh) stay in CSS and this only moves the one
 * number the CSS reads. Elements are found by
 * `data-cat="<key>"`, not by ref or class (the same convention as the hero).
 *
 * Call inside a gsap.context / gsap.matchMedia callback so it is reverted for
 * you (which also clears the inline styles, handing the card back to the CSS).
 */

export interface CategoriesTimelineOptions {
  /** The section: the tall element the stage sticks inside. */
  track: HTMLElement;
}

let pluginsRegistered = false;

/** Share of the track's scroll at which the catalog counts as open: the tiles take pointer input from here (data-open). */
const OPEN_AT = 0.42;
/** Where focusing a tile scrolls to: inside the hold, with the catalog fully in. */
const FOCUS_OPENS_AT = 0.75;

export function createCategoriesTimeline({ track }: CategoriesTimelineOptions): () => void {
  if (!pluginsRegistered) {
    gsap.registerPlugin(ScrollTrigger);
    // the same setting as the hero: a phone's address bar showing and hiding is not a resize
    ScrollTrigger.config({ ignoreMobileResize: true });
    pluginsRegistered = true;
  }

  const one = (key: string) => track.querySelector<HTMLElement>(`[data-cat="${key}"]`);
  const frame = one("frame");
  const preview = one("preview");
  const catalog = one("catalog");
  const catalogInner = one("catalog-inner");
  const shadow = one("shadow");
  const media = one("media");
  const toggle = one("toggle");
  if (!frame || !preview || !catalog) return () => {};
  // its heading (components/ui/Tide.tsx) plays once, when the catalog is half in, not when the page scrolls
  const heading = catalog.querySelector<HTMLElement>("[data-tide-manual]");

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      onUpdate: (self) => {
        if (heading && self.progress > OPEN_AT && !heading.hasAttribute("data-inview")) {
          heading.setAttribute("data-inview", "");
        }
        track.toggleAttribute("data-open", self.progress >= OPEN_AT);
      },
    },
  });

  // the card opens, and the water with it: the window (frame), its shadow, the water's scale and the pause
  // button's ride to the corner all read --open from their own element, so each is tweened itself
  const openers = [frame, shadow, media, toggle].filter((el): el is HTMLElement => el !== null);
  tl.fromTo(openers, { "--open": 0 }, { "--open": 1, duration: 46, ease: "power2.inOut" }, 4);

  // the white card makes way ...
  tl.fromTo(
    preview,
    { autoAlpha: 1, scale: 1 },
    { autoAlpha: 0, scale: 0.88, duration: 22, ease: "power1.in" },
    4,
  );

  // ... and the catalog arrives on the glass (opacity on the glass itself, so the blur fades in with it).
  // Opacity, not autoAlpha: visibility would take the eight tiles out of the tab order and the
  // accessibility tree until the card was open. They stay in the page, and take pointer input
  // from data-open (set above).
  tl.fromTo(catalog, { opacity: 0 }, { opacity: 1, duration: 22, ease: "power2.out" }, 30);
  if (catalogInner) {
    tl.fromTo(catalogInner, { y: 36 }, { y: 0, duration: 22, ease: "power2.out" }, 30);
  }

  // fixes the length at 100 units: the end is a hold
  tl.set({}, {}, 100);

  // A keyboard reaches the tiles at any scroll position, so focusing one brings the card open
  // (scrolls into the hold) instead of leaving focus on something that is not on screen yet.
  const onFocusIn = () => {
    if (track.hasAttribute("data-open")) return;
    const range = track.offsetHeight - window.innerHeight;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + range * FOCUS_OPENS_AT, behavior: "instant" });
  };
  catalog.addEventListener("focusin", onFocusIn);

  return () => {
    catalog.removeEventListener("focusin", onFocusIn);
    track.removeAttribute("data-open");
  };
}
