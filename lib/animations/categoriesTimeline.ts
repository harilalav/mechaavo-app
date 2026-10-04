import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrubSeconds } from "./scrub";

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
 *   52-100  held open, so the catalog can be used before the stage lets go; 56-96 of it, on a
 *           screen too short for all eight tiles, slides the content up by what does not fit
 *           (nothing inside the card scrolls on its own: a touch that began on the catalog was
 *           caught by it and the page did not move, see src/styles/categories.css)
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
/** Where focusing a tile scrolls to: the start of the hold, with the catalog fully in and nothing slid yet. */
const FOCUS_OPENS_AT = 0.56;
/** The hold's slide: from here to there (share of the track's scroll), the content moves up by what does not fit. */
const SLIDE_FROM = 0.56;
const SLIDE_TO = 0.96;

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
  const glass = one("glass");
  const slide = one("catalog-slide");
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
      scrub: scrubSeconds(),
      // the slide's distance depends on the screen (it is measured, below)
      invalidateOnRefresh: true,
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
  if (glass) tl.fromTo(glass, { opacity: 0 }, { opacity: 1, duration: 22, ease: "power2.out" }, 30);
  if (catalogInner) {
    tl.fromTo(catalogInner, { y: 36 }, { y: 0, duration: 22, ease: "power2.out" }, 30);
  }

  // The content that does not fit the screen (the catalog's padding included) slides up while the card is held
  // open, over the page's own scroll: the page moves, nothing inside the card has to be scrolled by itself.
  const padding = () => {
    const style = getComputedStyle(catalog);
    return parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  };
  const overflow = () =>
    catalogInner && slide ? Math.max(0, Math.ceil(catalogInner.offsetHeight + padding() - catalog.clientHeight)) : 0;
  if (slide) {
    tl.fromTo(
      slide,
      { y: 0 },
      { y: () => -overflow(), duration: (SLIDE_TO - SLIDE_FROM) * 100, ease: "none" },
      SLIDE_FROM * 100,
    );
  }

  // fixes the length at 100 units: the end is a hold
  tl.set({}, {}, 100);

  // A keyboard reaches the tiles at any scroll position, so focusing one brings it into view: the page scrolls
  // to where the card is open and the content has slid just far enough that the tile is on screen (and
  // it does nothing when the tile already is, so tabbing through the visible tiles never moves the page).
  const onFocusIn = (event: FocusEvent) => {
    const tile = event.target instanceof HTMLElement ? event.target : null;
    const total = overflow();
    const slid = -(Number(gsap.getProperty(slide ?? catalog, "y")) || 0);
    let want = slid;
    if (tile && slide && total > 0) {
      const origin = catalog.getBoundingClientRect().top;
      const rect = tile.getBoundingClientRect();
      // where the tile would be with nothing slid, in the catalog's own coordinates
      const top = rect.top - origin + slid;
      const bottom = rect.bottom - origin + slid;
      const room = catalog.clientHeight - parseFloat(getComputedStyle(catalog).paddingBottom);
      const least = Math.min(total, Math.max(0, bottom - room));
      const most = Math.min(total, Math.max(0, top - 8));
      want = Math.min(Math.max(slid, least), Math.max(least, most));
    }
    const open = track.hasAttribute("data-open");
    if (open && Math.abs(want - slid) < 1) return;
    const progress = total > 0 ? SLIDE_FROM + (SLIDE_TO - SLIDE_FROM) * (want / total) : FOCUS_OPENS_AT;
    const range = track.offsetHeight - window.innerHeight;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + range * Math.max(open ? 0 : FOCUS_OPENS_AT, progress), behavior: "instant" });
  };
  catalog.addEventListener("focusin", onFocusIn);

  return () => {
    catalog.removeEventListener("focusin", onFocusIn);
    track.removeAttribute("data-open");
  };
}
