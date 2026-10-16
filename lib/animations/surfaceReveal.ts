/**
 * The surfacing entrance, for the content groups below the hero and the categories (the principles, the
 * contact tiles): the same buoyant arrival the category tiles have, without their bubbles, so the whole
 * page moves in one language and none of it is decoration.
 *
 * A group is `[data-surface-group]`, its members `[data-surface]`. A member rises a short way out of the
 * water (about a line of text, not a slide) and fades in once its top is a little way into the screen;
 * members that arrive together go one after another, 70 ms apart (the first eight only: later ones would
 * feel late). Played once, time-based, interruptible: focus, a press or a key anywhere in the group brings
 * every member up at once. Web Animations, transform and opacity only (CLS 0).
 *
 * The CSS (src/styles/surface.css) holds a member under the water until it has `data-up`, only under
 * (scripting: enabled) and (prefers-reduced-motion: no-preference), with a failsafe if this never runs;
 * the member stays in the tab order and the accessibility tree the whole time (opacity, never visibility).
 */

const EACH_MS = 70;
const MAX_STAGGER = 8;
const RISE_MS = 560;
const FADE_MS = 360;
/** Buoyant, with half the overshoot the category tiles have: these are rows of text, not objects. */
const RISE_EASE = "cubic-bezier(0.34, 1.18, 0.64, 1)";
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

export interface SurfaceReveal {
  stop(): void;
}

export function startSurfaceReveal(root: ParentNode = document): SurfaceReveal {
  const groups = Array.from(root.querySelectorAll<HTMLElement>("[data-surface-group]"));
  const showAll = (group: HTMLElement) => group.querySelectorAll<HTMLElement>("[data-surface]").forEach((m) => m.setAttribute("data-up", ""));

  if (typeof Element.prototype.animate !== "function" || !("IntersectionObserver" in window)) {
    groups.forEach(showAll);
    return { stop() {} };
  }

  const running = new Set<Animation>();
  const cleanups: (() => void)[] = [];

  for (const group of groups) {
    const members = Array.from(group.querySelectorAll<HTMLElement>("[data-surface]")).filter((m) => !m.hasAttribute("data-up"));
    if (!members.length) continue;
    const waiting = new Set(members);

    const bringUp = (batch: HTMLElement[], delayed: boolean) => {
      batch.forEach((member, i) => {
        member.setAttribute("data-up", "");
        if (!delayed) return;
        const delay = Math.min(i, MAX_STAGGER - 1) * EACH_MS;
        const track = (animation: Animation) => {
          running.add(animation);
          const drop = () => running.delete(animation);
          animation.finished.then(drop, drop);
        };
        track(member.animate([{ transform: "translateY(1.25rem)" }, { transform: "none" }], { duration: RISE_MS, delay, easing: RISE_EASE, fill: "backwards" }));
        track(member.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, delay, easing: EASE_OUT, fill: "backwards" }));
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const batch = entries
          .filter((e) => e.isIntersecting && waiting.has(e.target as HTMLElement))
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => members.indexOf(a) - members.indexOf(b));
        if (!batch.length) return;
        batch.forEach((m) => {
          waiting.delete(m);
          observer.unobserve(m);
        });
        bringUp(batch, true);
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    members.forEach((m) => observer.observe(m));

    // anything the reader does in the group before it has finished: bring every member up, now
    const finish = () => {
      observer.disconnect();
      waiting.clear();
      running.forEach((a) => a.finish());
      running.clear();
      showAll(group);
    };
    const interrupt = () => {
      if (waiting.size || running.size) finish();
    };
    group.addEventListener("focusin", interrupt);
    group.addEventListener("pointerdown", interrupt);
    group.addEventListener("keydown", interrupt);
    cleanups.push(() => {
      observer.disconnect();
      group.removeEventListener("focusin", interrupt);
      group.removeEventListener("pointerdown", interrupt);
      group.removeEventListener("keydown", interrupt);
    });
  }

  return {
    stop() {
      cleanups.forEach((c) => c());
      running.forEach((a) => a.cancel());
      running.clear();
      groups.forEach(showAll);
    },
  };
}
