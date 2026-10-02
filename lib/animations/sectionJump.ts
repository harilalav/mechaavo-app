import { SECTION_IDS } from "../config/sections";

/**
 * Jumping to a section from the nav (or the hero call to action, or the bar's logo, which
 * goes to the top) dips through the
 * page's own white instead of cutting: a veil fades in over the old view, the
 * browser does the jump while it is covered, the veil lifts off the new one.
 *
 * Why a fade and not a fast scroll: every target lies past two scrubbed, pinned
 * stages (the hero track, about six screens, then the categories card, three). Scrolling
 * through them would play the whole catch and the card opening at ten
 * times speed to get somewhere else. A cut would hide all of that, but it reads as a bug.
 *
 * - Plain `<a href="#id">` links stay the source of truth: no script, a modifier click
 *   (new tab) or reduced motion all fall through to the browser's own jump.
 * - The jump itself is `location.hash = id`, so the history entry, `:target` and the
 *   keyboard's next Tab stop (it continues from the section) are the browser's, as for a click.
 * - A link to this page's own address (the logo, `/`) goes to the top the same way. The
 *   listener runs in the capture phase, ahead of next/link, which skips a click that
 *   something has already handled.
 * - Opacity on one fixed layer, nothing that lays out. The veil never takes pointer
 *   input, and a second click mid-way picks the veil up where it is and goes to the new target.
 */

const SECTIONS = new Set<string>(Object.values(SECTION_IDS));

/** the old view leaves (about 65% of the arrival, the rule for exits) */
const COVER_MS = 260;
/** the new view arrives (a panel-sized move) */
const REVEAL_MS = 420;
/** longest wait for the two frames the jump needs to paint (a hidden tab never gets them) */
const PAINT_WAIT_MS = 100;

function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, PAINT_WAIT_MS);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.clearTimeout(timer);
        resolve();
      }),
    );
  });
}

/** Starts the jumps; the returned function stops them. `veil` is the fixed, white, `opacity: 0` layer. */
export function startSectionJumps(veil: HTMLElement): () => void {
  if (typeof veil.animate !== "function") return () => {};

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let run = 0;

  /** `id` of a section, or null for the top of the page */
  const jump = async (id: string | null) => {
    const mine = ++run;
    const ease = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";

    // pick the veil up wherever an earlier jump left it
    const from = Number.parseFloat(getComputedStyle(veil).opacity) || 0;
    veil.getAnimations().forEach((animation) => animation.cancel());

    try {
      await veil.animate(
        { opacity: [from, 1] },
        { duration: COVER_MS * (1 - from), easing: ease, fill: "forwards" },
      ).finished;
      if (mine !== run) return;

      if (id === null) {
        window.scrollTo({ top: 0, behavior: "instant" });
        if (window.location.hash) window.history.pushState(null, "", window.location.pathname + window.location.search);
      } else if (window.location.hash === `#${id}`) {
        // the browser does nothing for a hash it already has (the reader scrolled away since): go there ourselves
        document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "start" });
      } else {
        window.location.hash = id;
      }
      await afterPaint();
      if (mine !== run) return;

      await veil.animate({ opacity: [1, 0] }, { duration: REVEAL_MS, easing: ease, fill: "forwards" }).finished;
      if (mine === run) veil.getAnimations().forEach((animation) => animation.cancel());
    } catch {
      // cancelled by a newer jump, which now owns the veil
    }
  };

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (reducedMotion.matches) return;

    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search) return;

    let id: string | null = null;
    if (url.hash) {
      id = decodeURIComponent(url.hash.slice(1));
      if (!SECTIONS.has(id) || !document.getElementById(id)) return;
    } else if (window.scrollY < 8) {
      return; // already at the top: nothing to dip for
    }

    event.preventDefault();
    void jump(id);
  };

  document.addEventListener("click", onClick, true);
  return () => {
    document.removeEventListener("click", onClick, true);
    run += 1;
    veil.getAnimations().forEach((animation) => animation.cancel());
  };
}
