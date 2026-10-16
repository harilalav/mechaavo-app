/**
 * The inspector's flight: the whole plate leaves the grid and grows into the dialog, the photo flying
 * inside it to the top of the dialog; closing runs it back into the plate (client review 2026-10-16:
 * "the same animation for the whole card, scaled up to fit the content").
 *
 * Two layers do the flying, both fixed over everything and both removed when they land:
 * - the shell: a full-screen layer painted like the plate, of which only a clip-path window shows. The
 *   window travels from the plate's box to the dialog panel's box (and its fill from the plate's to the
 *   panel's). A reveal, not a scale: the corners and the edge never stretch, and the size it grows to is the
 *   panel's own, which its content set (at most 90dvh);
 * - the ghost: a clone of the photo, sized to where it is going and moved there by transform (and cut to
 *   the window's shape by clip-path), because the dialog's own photo sits inside a panel that clips what
 *   leaves it. The scale is uniform and the window is cropped, so the lure never squashes on the way.
 * The plate itself is hidden while it is "the dialog" (`data-morphing`, and at rest: `data-calm`), and the shell
 * cross-fades with it at both ends, since the shell is a blank card and the plate's text would otherwise pop in or
 * out in a single frame. When the shell and the ghost land in the dialog, the real panel and photo are
 * shown in the same frame and the ledger rises (CSS, keyed on `data-landed`: categories-inspector.css).
 *
 * Interruptible: closing during the opening lets the flight finish at once and runs the way back. No
 * flight (reduced motion, no Web Animations, a plate off the screen) is still a dialog that comes up and
 * goes: it never depends on the flight for state.
 */

const OPEN_MS = 640;
/** The way back: about 65% of the way in, after the ledger has faded. */
const CLOSE_MS = 420;
/** The ledger fades before the shell takes the panel's place on the way back. */
const LEDGER_OUT_MS = 140;
/**
 * The flying plate is a blank card (the plate's own name, ruler and action are not part of the flight), so it
 * cross-fades with the real plate at both ends instead of replacing it in one frame: it fades in over this long
 * as the flight starts (the plate is hidden once it is opaque), and fades out over the same on the way back (the
 * plate is shown under it as it starts to fade), so the text never pops in or out.
 */
const SHELL_FADE_MS = 170;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export interface InspectorMotion {
  /** Run the way out and resolve when the dialog may be removed. */
  close(): Promise<void>;
  /** Remove everything this put in the page (unmount, or React running the effect twice in development). */
  cancel(): void;
}

interface Options {
  dialog: HTMLElement;
  /** The dialog's panel (`.cat-modal__panel`): the box the plate grows into. */
  panel: HTMLElement | null;
  /** The dialog's own photo (`.cat-modal__photo`). */
  photo: HTMLElement | null;
  /** The plate that opened it. */
  opener: HTMLElement | null;
}

function onScreen(r: DOMRect): boolean {
  return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

/** The category photos are 2:1 (docs/make-category-images.mjs). */
const SRC_ASPECT = 2;

interface GhostBox {
  left: number;
  top: number;
  w: number;
  h: number;
}
interface Placement {
  transform: string;
  clip: string;
}

/**
 * The ghost is the WHOLE picture (2:1), the width of the dialog's photo and centred on it. The plate's window and
 * the dialog's photo are two different `object-fit: cover` crops of that one picture (a plate window is 1.8:1 to
 * 2.4:1, the dialog's 2.4:1: each shows a different part of it), so a ghost that was only the dialog's crop could
 * never show what the plate shows, and the picture re-framed in the frame it landed on the plate. With the
 * whole picture, both ends are windows cut out of it.
 */
function ghostBoxOf(photoBox: DOMRect): GhostBox {
  const h = photoBox.width / SRC_ASPECT;
  return { left: photoBox.left, top: photoBox.top + (photoBox.height - h) / 2, w: photoBox.width, h };
}

/**
 * Where the ghost has to be, and which part of it shows, for the picture to fill `window` the way `object-fit:
 * cover` fills it: the largest centred window of that shape in the picture, scaled (uniformly) onto the box, with
 * the corners given on the screen (top-left, top-right, bottom-right, bottom-left, in px).
 */
function place(window: DOMRect, g: GhostBox, radius: [number, number, number, number]): Placement {
  const aspect = window.width / window.height;
  const cropW = aspect >= SRC_ASPECT ? g.w : g.h * aspect;
  const cropH = aspect >= SRC_ASPECT ? g.w / aspect : g.h;
  const k = window.width / cropW;
  const dx = window.left + window.width / 2 - (g.left + g.w / 2);
  const dy = window.top + window.height / 2 - (g.top + g.h / 2);
  const ix = (g.w - cropW) / 2;
  const iy = (g.h - cropH) / 2;
  const r = radius.map((v) => `${(v / k).toFixed(2)}px`).join(" ");
  return {
    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${k.toFixed(5)})`,
    clip: `inset(${iy.toFixed(2)}px ${ix.toFixed(2)}px ${iy.toFixed(2)}px ${ix.toFixed(2)}px round ${r})`,
  };
}

function makeGhost(host: HTMLElement, src: string, g: GhostBox): HTMLElement {
  const ghost = document.createElement("div");
  ghost.className = "cat-ghost";
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.left = `${g.left}px`;
  ghost.style.top = `${g.top}px`;
  ghost.style.width = `${g.w}px`;
  ghost.style.height = `${g.h}px`;
  ghost.style.transformOrigin = "50% 50%";
  const img = document.createElement("img");
  img.className = "cat-ghost__img";
  img.alt = "";
  img.decoding = "async";
  img.src = src;
  ghost.appendChild(img);
  host.appendChild(ghost);
  return ghost;
}

/** The full-screen layer painted like a plate, of which only a clip-path window shows. */
function makeShell(host: HTMLElement): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "cat-shell";
  shell.setAttribute("aria-hidden", "true");
  host.appendChild(shell);
  return shell;
}

/** A box as an `inset()` window of the full-screen shell, with its own corner. */
function windowOf(box: DOMRect, shell: HTMLElement, radius: number): string {
  const w = shell.clientWidth || window.innerWidth;
  const h = shell.clientHeight || window.innerHeight;
  const r = `${radius.toFixed(1)}px`;
  return `inset(${box.top.toFixed(1)}px ${(w - box.right).toFixed(1)}px ${(h - box.bottom).toFixed(1)}px ${box.left.toFixed(1)}px round ${r} ${r} ${r} ${r})`;
}

const radiusOf = (el: Element | null, fallback: number) =>
  el ? Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || fallback : fallback;

/** The sharpest copy of the photo that is already in the page: the dialog's own if it has loaded, else the plate's. */
function sourceOf(photo: HTMLElement | null, stage: HTMLElement | null): string | null {
  const own = photo?.querySelector<HTMLImageElement>("img");
  if (own && own.complete && own.naturalWidth > 0 && own.currentSrc) return own.currentSrc;
  const tile = stage?.querySelector<HTMLImageElement>("img");
  if (tile && tile.complete && tile.naturalWidth > 0 && tile.currentSrc) return tile.currentSrc;
  return null;
}

export function startInspectorMotion({ dialog, panel, photo, opener }: Options): InspectorMotion | null {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  if (typeof Element.prototype.animate !== "function") return null;

  const stage = opener?.querySelector<HTMLElement>(".cat-card__stage") ?? null;
  let shell: HTMLElement | null = null;
  let ghost: HTMLElement | null = null;
  let flights: Animation[] = [];
  let landed = false;
  /** Set by cancel(): a flight that was cancelled must not land (React runs effects twice in development). */
  let dead = false;
  let hideTimer = 0;
  let showTimer = 0;
  let restored = false;

  /**
   * While it is "the dialog" the plate in the grid is hidden (still in the layout and the accessibility tree) and
   * at rest (`data-calm`: categories-inspector.css), so what the way back lands on is the plate at rest, not
   * whatever hover or focus had made of it.
   */
  const hidePlate = () => {
    window.clearTimeout(hideTimer);
    opener?.setAttribute("data-morphing", "");
    opener?.setAttribute("data-calm", "");
  };
  /**
   * The plate comes back and stays calm until the pointer moves (categories-inspector.css, data-calm): the pointer
   * is usually still over it, and hover or focus would otherwise make it move in the frame it lands.
   */
  const restorePlate = () => {
    window.clearTimeout(showTimer);
    if (!opener || restored) return;
    restored = true;
    opener.removeAttribute("data-morphing");
    if (!opener.hasAttribute("data-calm")) return;
    const release = () => opener.removeAttribute("data-calm");
    document.addEventListener("pointermove", release, { once: true, passive: true });
    document.addEventListener("keydown", release, { once: true });
  };

  // measure before anything moves: the sheet is about to come up from a little below its place
  const plateBox = opener?.getBoundingClientRect() ?? null;
  const panelBox = panel?.getBoundingClientRect() ?? null;
  const stageBox = stage?.getBoundingClientRect() ?? null;
  const photoBox = photo?.getBoundingClientRect() ?? null;
  // the plate's photo as it is right now (zoomed a little if the plate is touched): the flight starts from exactly that
  const stageImg = stage?.querySelector<HTMLImageElement>("img") ?? null;
  const imgFrom = stageImg ? getComputedStyle(stageImg).transform : "none";
  const plateFill = opener ? getComputedStyle(opener).backgroundColor : "";
  const panelFill = panel ? getComputedStyle(panel).backgroundColor : "";
  const plateRadius = radiusOf(opener, 16);
  const panelRadius = radiusOf(panel, 16);
  const canMorph = !!(opener && panel && plateBox && panelBox && onScreen(plateBox) && onScreen(panelBox));

  dialog.setAttribute("data-motion", "");

  const land = () => {
    if (landed || dead) return;
    landed = true;
    // the real panel and photo are shown in this frame (data-landed), and the flying layers go in the same one
    dialog.setAttribute("data-landed", "");
    shell?.remove();
    ghost?.remove();
    shell = null;
    ghost = null;
    flights = [];
  };

  if (canMorph && plateBox && panelBox && opener) {
    dialog.setAttribute("data-morph", "");

    shell = makeShell(dialog);
    flights.push(
      shell.animate(
        [
          { clipPath: windowOf(plateBox, shell, plateRadius), backgroundColor: plateFill },
          { clipPath: windowOf(panelBox, shell, panelRadius), backgroundColor: panelFill },
        ],
        { duration: OPEN_MS, easing: EASE, fill: "both" },
      ),
      // it fades in over the real plate, which goes (hidden, and at rest) once the shell is opaque
      shell.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SHELL_FADE_MS, easing: "linear", fill: "both" }),
    );
    hideTimer = window.setTimeout(hidePlate, SHELL_FADE_MS);

    const src = sourceOf(photo, stage);
    if (src && stageBox && photoBox && onScreen(stageBox)) {
      const g = ghostBoxOf(photoBox);
      const stageRadius = radiusOf(stage, 10);
      const from = place(stageBox, g, [stageRadius, stageRadius, stageRadius, stageRadius]);
      const to = place(photoBox, g, [panelRadius, panelRadius, 0, 0]);
      ghost = makeGhost(dialog, src, g);
      flights.push(
        ghost.animate(
          [
            { transform: from.transform, clipPath: from.clip },
            { transform: to.transform, clipPath: to.clip },
          ],
          { duration: OPEN_MS, easing: EASE, fill: "both" },
        ),
        // the picture inside it settles from the plate photo's own transform to none (the dialog's photo has none)
        (ghost.firstElementChild as HTMLElement).animate([{ transform: imgFrom }, { transform: "none" }], {
          duration: OPEN_MS,
          easing: EASE,
          fill: "both",
        }),
        // it comes in over the plate's own photo (the same pixels), so the plate's index chip, which is on that
        // photo, goes with the plate's fade and does not vanish in the first frame
        ghost.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SHELL_FADE_MS, easing: "linear", fill: "both" }),
      );
    }
    Promise.all(flights.map((f) => f.finished)).then(land, () => land());
  } else {
    // no flight: the dialog comes up on its own and the ledger rises at once
    land();
  }

  let closing: Promise<void> | null = null;

  return {
    close() {
      if (closing) return closing;
      // let an opening in flight arrive first (a quick Escape): the way back starts from the dialog, in its place
      flights.forEach((f) => f.finish());
      land();
      // (closed before the shell was opaque: the plate is hidden and at rest now all the same)
      if (dialog.hasAttribute("data-morph")) hidePlate();
      dialog.setAttribute("data-closing", "");

      const morphing = dialog.hasAttribute("data-morph");
      const backBox = opener?.getBoundingClientRect() ?? null;
      if (!morphing || !opener || !panel || !backBox || !onScreen(backBox)) {
        // no way back to the plate on screen: the dialog fades on its own (CSS), and the plate is simply there
        restorePlate();
        closing = new Promise<void>((resolve) => window.setTimeout(resolve, 260));
        return closing;
      }

      closing = new Promise<void>((resolve) => {
        // the ledger fades first (CSS, data-closing); then the shell takes the panel's place, in the same frame,
        // and shrinks back into the plate while the photo flies back into its window
        window.setTimeout(() => {
          if (dead) return resolve();
          const fromBox = panel.getBoundingClientRect();
          const toBox = opener.getBoundingClientRect();
          const fromPhoto = photo?.getBoundingClientRect() ?? null;
          const toStage = stage?.getBoundingClientRect() ?? null;
          const src = sourceOf(photo, stage);

          shell = makeShell(dialog);
          const back: Animation[] = [
            shell.animate(
              [
                { clipPath: windowOf(fromBox, shell, panelRadius), backgroundColor: panelFill },
                { clipPath: windowOf(toBox, shell, plateRadius), backgroundColor: plateFill },
              ],
              { duration: CLOSE_MS, easing: EASE, fill: "both" },
            ),
            // ...and fades out over the real plate, which is shown under it as the fade starts, so the plate's text
            // comes in with it instead of appearing in the last frame
            shell.animate([{ opacity: 1 }, { opacity: 0 }], {
              duration: SHELL_FADE_MS,
              delay: CLOSE_MS - SHELL_FADE_MS,
              easing: "linear",
              fill: "both",
            }),
          ];
          showTimer = window.setTimeout(restorePlate, CLOSE_MS - SHELL_FADE_MS);
          if (src && fromPhoto && toStage && onScreen(fromPhoto)) {
            const g = ghostBoxOf(fromPhoto);
            const stageRadius = radiusOf(stage, 10);
            const from = place(fromPhoto, g, [panelRadius, panelRadius, 0, 0]);
            const to = place(toStage, g, [stageRadius, stageRadius, stageRadius, stageRadius]);
            // the plate is calm by now, so its photo's transform is the resting one: the picture lands on that
            const imgRest = stageImg ? getComputedStyle(stageImg).transform : "none";
            ghost = makeGhost(dialog, src, g);
            back.push(
              ghost.animate(
                [
                  { transform: from.transform, clipPath: from.clip },
                  { transform: to.transform, clipPath: to.clip },
                ],
                { duration: CLOSE_MS, easing: EASE, fill: "both" },
              ),
              (ghost.firstElementChild as HTMLElement).animate([{ transform: "none" }, { transform: imgRest }], {
                duration: CLOSE_MS,
                easing: EASE,
                fill: "both",
              }),
              // it lifts off the plate's own photo (the same pixels) with the shell, so the plate's index chip, which
              // is on that photo, comes in with the plate and does not appear in the last frame
              ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
                duration: SHELL_FADE_MS,
                delay: CLOSE_MS - SHELL_FADE_MS,
                easing: "linear",
                fill: "both",
              }),
            );
          }
          // the panel goes in this frame: the shell (and the ghost) are what is seen now
          dialog.setAttribute("data-ghosting", "");
          Promise.all(back.map((f) => f.finished.catch(() => undefined))).then(() => {
            // the shell is clear by now and the plate is back (a safeguard if the timer was cut short)
            restorePlate();
            shell?.remove();
            ghost?.remove();
            shell = null;
            ghost = null;
            resolve();
          });
        }, LEDGER_OUT_MS);
      });
      return closing;
    },
    cancel() {
      dead = true;
      window.clearTimeout(hideTimer);
      flights.forEach((f) => f.cancel());
      flights = [];
      shell?.remove();
      ghost?.remove();
      shell = null;
      ghost = null;
      restorePlate();
      dialog.removeAttribute("data-motion");
      dialog.removeAttribute("data-morph");
      dialog.removeAttribute("data-landed");
      dialog.removeAttribute("data-closing");
      dialog.removeAttribute("data-ghosting");
    },
  };
}
