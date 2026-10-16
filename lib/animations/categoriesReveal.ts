/**
 * The categories surface: each plate rises into place, and as it does the water drains off its
 * photo window: a line of light travels up through the window and the photo is revealed behind it,
 * then the depth ruler draws itself and the index chip arrives.
 *
 * Time-based, not scrubbed, and played once: a row starts the moment it comes
 * into view, however fast the page is moving, so a flick past the hero still
 * shows every plate arriving. Plates that enter together (a whole grid on a
 * desktop, a row or two on a phone) rise as one wave from the top-left plate
 * outward, like GSAP's `stagger: { grid: "auto", from: "start" }`.
 *
 * Web Animations (as the section jump's veil, sectionJump.ts), transform, opacity and one clip-path,
 * so nothing is laid out while it plays (CLS 0). Interruptible: a press, a key or focus anywhere in
 * the grid completes every wave at once.
 *
 * The CSS (categories.css) holds a plate until it has `data-up`; the section's `data-shown` lets every
 * plate up (reduced motion, a failure, the end); `data-revealing` turns the plates' own transitions
 * off while a wave runs (a CSS transition outranks an animation in the cascade).
 * (There used to be a plume of bubbles from each plate here: on the white page they were white on white,
 * and the page has one bubble look, the hero's, so they went.)
 */

/** Seconds of delay per grid step away from the wave's first tile. */
const EACH = 0.1;
const RISE_MS = 780;
const FADE_MS = 380;
/** The water draining off the photo window: the line of light and the clip that follows it. */
const WIPE_AFTER_MS = 170;
const WIPE_MS = 920;
/** The depth ruler draws itself once the photo is mostly in. */
const RULER_AFTER_MS = 600;
const RULER_MS = 760;
const CHIP_AFTER_MS = 480;
/** The photo at rest is a touch larger than its window (categories-plate.css), so the end of its settle is that, not 1. */
const PHOTO_REST = "scale(1.02)";
/** Buoyant: overshoots its resting place a touch and settles back, like something light coming up through water. */
const RISE_EASE = "cubic-bezier(0.34, 1.32, 0.64, 1)";
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

export interface CategoriesReveal {
  /** Complete every wave now and let every tile up (focus, a press, a key). */
  finish(): void;
  /** Undo everything (unmount): tiles shown, nothing left running. */
  stop(): void;
}

export function startCategoriesReveal({ section, grid }: { section: HTMLElement; grid: HTMLElement }): CategoriesReveal {
  const tiles = Array.from(grid.querySelectorAll<HTMLElement>(".cat-card"));
  const showAll = () => section.setAttribute("data-shown", "");

  if (section.hasAttribute("data-shown")) return { finish: () => {}, stop: () => {} };
  if (typeof Element.prototype.animate !== "function" || !("IntersectionObserver" in window) || !tiles.length) {
    showAll();
    return { finish: showAll, stop: () => {} };
  }

  const running = new Set<Animation>();
  const timers = new Set<number>();
  let waves = 0;

  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  const track = (animation: Animation) => {
    running.add(animation);
    const drop = () => running.delete(animation);
    animation.finished.then(drop, drop);
    return animation;
  };

  const wave = (batch: HTMLElement[]) => {
    // read everything first (one layout), then write
    const rects = batch.map((tile) => tile.getBoundingClientRect());
    const colWidth = rects[0].width || 1;
    const rowHeight = rects[0].height || 1;
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    // arriving through the section jump's veil: wait for it to lift a little first
    const veil = document.querySelector<HTMLElement>(".section-veil");
    const hold = veil && Number.parseFloat(getComputedStyle(veil).opacity) > 0.1 ? 320 : 0;

    waves += 1;
    section.setAttribute("data-revealing", "");

    let maxDelay = 0;
    batch.forEach((tile, i) => {
      const r = rects[i];
      const col = Math.round((r.left - left) / colWidth);
      const row = Math.round((r.top - top) / rowHeight);
      const delay = hold + Math.hypot(col, row) * EACH * 1000;
      // alternate the lean, so the row does not tilt as one block
      const lean = (Math.round(r.left / colWidth) + row) % 2 ? 0.9 : -0.9;
      maxDelay = Math.max(maxDelay, delay);

      tile.setAttribute("data-up", "");
      track(
        tile.animate(
          [{ transform: `translateY(2.25rem) scale(0.95) rotate(${lean}deg)` }, { transform: "none" }],
          { duration: RISE_MS, delay, easing: RISE_EASE, fill: "backwards" },
        ),
      );
      track(tile.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, delay, easing: EASE_OUT, fill: "backwards" }));

      // the water draining off the photo window: the clip's top edge and the line of light travel up together
      // (the same duration, delay and easing, so the line is always on the edge), the photo settles from larger
      const wipe = { duration: WIPE_MS, delay: delay + WIPE_AFTER_MS, easing: EASE_OUT, fill: "backwards" } as const;
      const img = tile.querySelector<HTMLElement>(".cat-card__img");
      if (img) {
        track(
          img.animate(
            [
              { clipPath: "inset(100% 0 0 0)", transform: "scale(1.14)" },
              { clipPath: "inset(0% 0 0 0)", transform: PHOTO_REST },
            ],
            wipe,
          ),
        );
      }
      const surface = tile.querySelector<HTMLElement>(".cat-card__surface");
      if (surface) {
        track(surface.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0%)" }], wipe));
        track(surface.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], wipe));
      }
      const bar = tile.querySelector<HTMLElement>(".cat-gauge__bar");
      if (bar) {
        track(
          bar.animate([{ transform: "scaleX(0)" }, { transform: "none" }], {
            duration: RULER_MS,
            delay: delay + RULER_AFTER_MS,
            easing: EASE_OUT,
            fill: "backwards",
          }),
        );
      }
      const chip = tile.querySelector<HTMLElement>(".cat-card__index");
      if (chip) {
        track(
          chip.animate([{ opacity: 0, transform: "translateY(0.25rem)" }, { opacity: 1, transform: "none" }], {
            duration: 300,
            delay: delay + CHIP_AFTER_MS,
            easing: EASE_OUT,
            fill: "backwards",
          }),
        );
      }
    });

    const settle = () => {
      waves -= 1;
      if (waves <= 0) section.removeAttribute("data-revealing");
    };
    // the last thing to finish is the last plate's ruler
    later(maxDelay + RULER_AFTER_MS + RULER_MS + 80, settle);
  };

  // tiles already up (a remount: React runs effects twice in development) stay up
  const waiting = new Set(tiles.filter((tile) => !tile.hasAttribute("data-up")));
  const observer = new IntersectionObserver(
    (entries) => {
      const batch = entries
        .filter((entry) => entry.isIntersecting && waiting.has(entry.target as HTMLElement))
        .map((entry) => entry.target as HTMLElement);
      if (!batch.length) return;
      batch.forEach((tile) => {
        waiting.delete(tile);
        observer.unobserve(tile);
      });
      // in reading order, so the wave starts at the top-left tile of the batch
      batch.sort((a, b) => tiles.indexOf(a) - tiles.indexOf(b));
      wave(batch);
      if (!waiting.size) observer.disconnect();
    },
    // a tile starts once its top is a little way into the screen
    { rootMargin: "0px 0px -10% 0px" },
  );
  tiles.forEach((tile) => observer.observe(tile));

  const clear = () => {
    observer.disconnect();
    waiting.clear();
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  };

  const finish = () => {
    clear();
    running.forEach((animation) => animation.finish());
    running.clear();
    waves = 0;
    // every tile up at once, with the tiles' own transitions still off for this frame,
    // so the ones that had not started yet do not glide up through a hover transition
    section.setAttribute("data-revealing", "");
    showAll();
    requestAnimationFrame(() => requestAnimationFrame(() => section.removeAttribute("data-revealing")));
  };

  // anything the reader does in the grid while it is still coming up: bring it all up at once
  const interrupt = () => {
    if (running.size || waiting.size) finish();
  };
  grid.addEventListener("focusin", interrupt);
  grid.addEventListener("pointerdown", interrupt);
  grid.addEventListener("keydown", interrupt);

  return {
    finish,
    stop() {
      clear();
      running.forEach((animation) => animation.cancel());
      running.clear();
      section.removeAttribute("data-revealing");
      grid.removeEventListener("focusin", interrupt);
      grid.removeEventListener("pointerdown", interrupt);
      grid.removeEventListener("keydown", interrupt);
    },
  };
}
