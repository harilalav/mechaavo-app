import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SECTION_IDS } from "../config/sections";
import { handoverLine } from "../utils/handoverLine";
import { scrubSeconds, sinkScrubSeconds } from "./scrub";
import { LURE_ZOOM_GAIN } from "../hero/lureConfig";
import { resetHeroScene, STORY, type HeroScene } from "../underwater/story";

export { createHeroScene, fishStateAt, STORY } from "../underwater/story";
export type { HeroScene } from "../underwater/story";

/**
 * The hero's choreography: ONE scrubbed ScrollTrigger timeline that drives the
 * DOM (headline, rays, camera, the lure's push-in) and the shared `HeroScene`
 * the Canvas engine reads (camera zoom, attention).
 *
 * Nothing is pinned by JavaScript. The hero is `position: sticky` inside its track
 * (.hero-track, src/styles/underwater.css): the hero's own screen, a spacer the story is
 * scrubbed over, and then the categories, which scroll up over the still-pinned hero
 * (the hero is their live backdrop: the plates rise through its water, client review
 * 2026-10-16). The story's length is `--hero-screens` minus two screens. The timeline is
 * 100 units long, so every position below is a percentage of that distance. Scroll
 * backwards and everything reverses.
 *
 * A second, shorter trigger plays while the categories come up: the camera sinks below
 * the catch (`--sink` work below), and the statement, the captions and the lure leave.
 *
 * What it deliberately does NOT drive: the fish, the lure's own motion, and the
 * catch. The primary fish reads `scene.story` to choose what to do and then
 * moves at its own natural speed (lib/underwater/primaryFish.ts); the lure's
 * float, twitches, jointed body and reactions are the engine's lure rig
 * (lib/underwater/lureRig.ts); and the brand statement arrives from the engine
 * the moment the fish is hooked (`data-caught`, see underwater.css), so a fast
 * scroll cannot skip the catch or the words that come with it. Scroll decides
 * the moment; physics decides the movement.
 *
 * Call inside a gsap.context / gsap.matchMedia callback so it is reverted for
 * you; the returned function resets the scene.
 */

export interface HeroTimelineOptions {
  root: HTMLElement;
  /** The tall element the hero sticks inside; its scroll distance is the story. */
  track: HTMLElement;
  scene: HeroScene;
  /** Stacked layout (phones / portrait): shorter story, gentler camera. */
  stacked: boolean;
}

interface HeroElements {
  bg: HTMLElement | null;
  /** The shafts' own boxes (their beams are the ambient tweens'; these carry only the sinking). */
  rayBoxes: HTMLElement[];
  caustics: HTMLElement | null;
  depth: HTMLElement | null;
  /** What leaves as the camera sinks: boxes with no other owner of their opacity (the captions' container, the lure's fade wrapper, the hero's own nav). */
  leaving: HTMLElement[];
  /** The statement's slot: its own opacity is the catch's (data-caught), so it gets `--leave`, read by its fade wrapper and its wash. */
  statementSlot: HTMLElement | null;
  rays: HTMLElement | null;
  beams: HTMLElement[];
  haze: HTMLElement | null;
  captions: HTMLElement[];
  canvases: HTMLElement[];
  lure: HTMLElement | null;
  titleGroup: HTMLElement | null;
  supportGroup: HTMLElement | null;
}

function collect(root: HTMLElement): HeroElements {
  const one = (key: string) => root.querySelector<HTMLElement>(`[data-hero="${key}"]`);
  const all = (key: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(`[data-hero="${key}"]`));
  return {
    bg: one("bg"),
    rayBoxes: Array.from(root.querySelectorAll<HTMLElement>(".hero-ray")),
    caustics: root.querySelector<HTMLElement>(".hero-caustics"),
    depth: root.querySelector<HTMLElement>(".hero-depth"),
    leaving: Array.from(root.querySelectorAll<HTMLElement>(".hero-captions, .hero-lure-fade, .hero-nav")),
    statementSlot: root.querySelector<HTMLElement>(".hero-statement-slot"),
    rays: one("rays"),
    beams: all("beam"),
    haze: one("haze"),
    captions: all("caption"),
    canvases: all("canvas"),
    lure: one("lure-wrapper"),
    titleGroup: one("title-group"),
    supportGroup: one("support-group"),
  };
}

/**
 * Camera push-in. Environment zoom and lure scale are generated from one list.
 * It is a slow dolly, not a rush: the lure and the fish that takes it stay in
 * frame, whole, through the fight, and the lure never outgrows the fish.
 */
const ZOOM_KEYS = [
  { at: 0, duration: 6, to: 1.03, phone: 1.02, ease: "none" },
  { at: 6, duration: 14, to: 1.08, phone: 1.05, ease: "sine.inOut" },
  { at: 20, duration: 20, to: 1.13, phone: 1.08, ease: "sine.inOut" },
  { at: 40, duration: 60, to: 1.16, phone: 1.1, ease: "sine.out" },
] as const;

/**
 * The positions below were authored, in units of 1% of the story, for a story 4.1 screens long, with the
 * catch at unit 17. The story is shorter now (see STORY in lib/underwater/story.ts), so every unit is
 * mapped: up to the catch they are stretched by the same factor as the beats the fish reads (the approved
 * bite and everything before it keep the distance down the page they had), and what comes after the catch is
 * fitted into the rest. `at` maps a position, `span` a length starting at one.
 */
const AUTHORED_CAUGHT = 17;
const at = (unit: number): number => {
  const caught = STORY.caught * 100;
  return unit <= AUTHORED_CAUGHT
    ? unit * (caught / AUTHORED_CAUGHT)
    : caught + (unit - AUTHORED_CAUGHT) * ((100 - caught) / (100 - AUTHORED_CAUGHT));
};
const span = (from: number, length: number): number => at(from + length) - at(from);

let pluginsRegistered = false;

/** The catalog's snap can be switched off from outside (tests, measurements): localStorage `mechaavo-snap` = "off". */
function snapIsOff(): boolean {
  try {
    return window.localStorage.getItem("mechaavo-snap") === "off";
  } catch {
    return false;
  }
}

export function createHeroTimeline({ root, track, scene, stacked }: HeroTimelineOptions): () => void {
  if (!pluginsRegistered) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    pluginsRegistered = true;
  }

  const el = collect(root);

  // starting states for everything that arrives later in the story
  gsap.set(el.captions.slice(1), { autoAlpha: 0 });

  // ———————————————————————— opening: arrive underwater ————————————————————————
  // Text, nav and lure arrive via CSS keyframes and the lure rig (see underwater.css),
  // so they paint at once; only the canvases, which cannot draw before hydration, fade in here.
  gsap.from(el.canvases, { autoAlpha: 0, duration: 2.2, ease: "power2.out" });

  // ———————————————————————— ambient water (never static) ————————————————————————
  // Light shafts sway and breathe on their own, out of phase with each other. They are a fraction of the
  // hero wide, so a sway of a few percent of a shaft was about 10 px in 15 s (client review 2026-10-15:
  // "the rays are so static"): now a shaft travels about half its own width and leans, over 7 to 17 s, and its
  // brightness moves with three incommensurate beats like the current's gusts (current.ts), not one.
  el.beams.forEach((beam, i) => {
    const dir = i % 2 ? 1 : -1;
    gsap.fromTo(
      beam,
      { xPercent: -dir * 38, skewX: -dir * 3.5, rotation: -dir * 1.2 },
      {
        xPercent: dir * 38,
        skewX: dir * 3.5,
        rotation: dir * 1.2,
        duration: 7 + i * 2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      },
    );
    gsap.to(beam, {
      opacity: 0.4,
      duration: 3.2 + i * 1.3,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  });

  // The light feels like it is in the water, not painted on the screen: on a fine pointer the shafts shift a
  // little against the scene as the pointer moves (parallax: the light is nearer the surface than the fish).
  // One passive listener, one write per frame, nothing on touch; reduced motion never builds this timeline.
  let shaftFrame = 0;
  let shaftShift = 0;
  const onPointer = (event: PointerEvent) => {
    shaftShift = (event.clientX / window.innerWidth - 0.5) * -28;
    if (shaftFrame) return;
    shaftFrame = requestAnimationFrame(() => {
      shaftFrame = 0;
      el.rays?.style.setProperty("--ray-shift", `${shaftShift.toFixed(1)}px`);
    });
  };
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (finePointer && el.rays) window.addEventListener("pointermove", onPointer, { passive: true });
  if (el.haze) {
    gsap.to(el.haze, { xPercent: 2.5, duration: 24, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }

  // ———————————————————————— the scrubbed story ————————————————————————
  // The track holds the hero's own screen, the spacer the story plays over and the categories after it, so its
  // height is no measure of the story any more: the story is --hero-screens (underwater.css) less two screens.
  const storyDistance = () => {
    const screens = Number.parseFloat(getComputedStyle(track).getPropertyValue("--hero-screens")) || 3.9;
    return Math.max(1, (screens - 2) * root.offsetHeight);
  };

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: track,
      start: "top top",
      end: () => `+=${storyDistance()}`,
      scrub: scrubSeconds(),
      invalidateOnRefresh: true,
    },
  });

  // the categories' ground turns to water only once this timeline runs: before it loads, or if it never does,
  // they keep a white ground (categories.css), and the hero is not a backdrop
  track.setAttribute("data-backdrop", "");

  // once the categories have come up over the hero to the handover line (handoverLine.ts, where SiteNavigation
  // shows the sticky bar) the hero is a backdrop: the engine keeps the water alive but
  // cheaply and lets the catch go (engine.ts), and the keyboard goes to the bar's nav
  const sheet =
    document.getElementById(SECTION_IDS.categories) ||
    document.getElementById(SECTION_IDS.story);
  const barLine = () => handoverLine(document.querySelector<HTMLElement>(".site-nav"));
  if (sheet) {
    ScrollTrigger.create({
      trigger: sheet,
      start: () => `top ${Math.round(barLine())}px`,
      end: "max",
      invalidateOnRefresh: true,
      onToggle: (self) => {
        scene.backdrop = self.isActive;
        // and nothing behind the catalog takes focus or clicks (the hero nav, the call to action)
        root.toggleAttribute("inert", self.isActive);
      },
    });
  }

  // ———————————————————————— the catalog hooks to the top ————————————————————————
  // While the catalog's top travels up the screen (from its bottom edge to the line an anchor jump lands it on,
  // just under the sticky bar) a reader who stops there is left with a screen of empty water above a heading
  // (client review 2026-10-16: "when we scroll to the categories it should hook automatically to the top of the
  // screen and show full content"). Once the scroll has rested, the page settles the catalog under the bar. Going
  // down it always completes the move; going up it takes the nearer end (the catalog's top at the bottom edge is
  // the hero's finished scene: the catch drawn up, the statement). Inside the catalog nothing snaps (the trigger
  // ends where the catalog's top meets the bar), and the jumps (sectionJump.ts) already land on that line. Touch and
  // wheel interrupt it. Not built under reduced motion or without script (this timeline is not), where the page just
  // scrolls. localStorage `mechaavo-snap` = "off" is the switch for tests and measurements that park the page on purpose.
  if (sheet) {
    const barHeight = () => Math.round(document.querySelector<HTMLElement>(".site-nav")?.offsetHeight ?? 0);
    ScrollTrigger.create({
      trigger: sheet,
      start: "top bottom",
      end: () => `top ${barHeight()}px`,
      invalidateOnRefresh: true,
      snap: {
        snapTo: (progress, self) => {
          if (snapIsOff()) return progress;
          return (self?.direction ?? 1) > 0 || progress > 0.5 ? 1 : 0;
        },
        delay: 0.3,
        duration: { min: 0.25, max: 0.6 },
        ease: "power2.out",
        inertia: false,
      },
    });
  }

  // the story section comes up over the hero once the catalog has ended (underwater.css, the track's last
  // screen): when it covers the whole of it, the engine rests
  const story = document.getElementById(SECTION_IDS.story);
  if (story) {
    ScrollTrigger.create({
      trigger: story,
      start: "top top",
      end: "max",
      invalidateOnRefresh: true,
      onToggle: (self) => {
        scene.covered = self.isActive;
      },
    });
  }

  // ———————————————————————— the camera sinks under the catalog ————————————————————————
  // While the categories come up (from their top entering the screen, over one screen of scroll: a fixed length,
  // so it never depends on how tall the catalog is) the camera sinks below the catch: the shafts drift up and
  // thin, the caustic light drifts up, a deeper water gathers, and what belonged to the catch (the statement,
  // the captions, the lure) leaves by opacity alone (no motion on text). One number, `sink`, written to
  // properties nothing else animates: each shaft's own `translate` and `opacity` (the beams inside are the
  // ambient tweens'), the caustics' `translate`, the new depth layer's and the fade wrappers' `opacity`.
  const sinking = { v: 0 };
  const writeSink = () => {
    const v = sinking.v;
    scene.sink = v;
    // the hero's words, nav and lure are gone by a third of the way in (they are dark ink: they must not be
    // over the deepening water), and the deep arrives over the next third, so the white heading that rises
    // into it has water it can be read on
    const leave = String(Math.min(1, Math.max(0, 1 - v * 2.8)));
    for (const ray of el.rayBoxes) {
      ray.style.translate = `0 ${(-v * 14).toFixed(2)}svh`;
      ray.style.opacity = String(1 - 0.6 * v);
    }
    if (el.caustics) el.caustics.style.translate = `0 ${(-v * 10).toFixed(2)}svh`;
    if (el.depth) {
      const t = Math.min(1, Math.max(0, (v - 0.1) / 0.4));
      el.depth.style.opacity = String((0.92 * t * t * (3 - 2 * t)).toFixed(3));
    }
    for (const node of el.leaving) node.style.opacity = leave;
    el.statementSlot?.style.setProperty("--leave", leave);
  };
  const sink = sheet
    ? gsap.to(sinking, {
        v: 1,
        ease: "none",
        onUpdate: writeSink,
        scrollTrigger: {
          trigger: sheet,
          start: "top bottom",
          end: () => `+=${window.innerHeight}`,
          scrub: sinkScrubSeconds(),
          invalidateOnRefresh: true,
        },
      })
    : null;

  // A jump straight to a section (the hero's call to action, the nav) lands under the veil
  // (lib/animations/sectionJump.ts): bring both scrubs to where the page now is at once, so the catch, the
  // reel and the statement do not play out behind the glass plates after the veil has lifted.
  const onJump = () => {
    ScrollTrigger.update();
    tl.scrollTrigger?.getTween()?.progress(1);
    sink?.scrollTrigger?.getTween()?.progress(1);
  };
  window.addEventListener("section-jump", onJump);

  // master clock: gives the timeline its 100-unit length; the fish read it to choose what to do
  tl.to(scene, { story: 1, duration: 100 }, 0);
  tl.to(scene, { descend: 1, duration: 100 }, 0);

  // the very first notch of the wheel sets the lure drifting toward the fish, so the page answers at once
  tl.to(scene, { lead: 1, duration: STORY.leadEnd * 100, ease: "sine.out" }, 0);

  // camera: wide, then closer at the catch, then a slow dolly while the fish fights
  for (const key of ZOOM_KEYS) {
    const zoom = stacked ? key.phone : key.to;
    tl.to(scene, { zoom, duration: span(key.at, key.duration), ease: key.ease }, at(key.at));
    if (el.lure) {
      tl.to(
        el.lure,
        { scale: 1 + (zoom - 1) * LURE_ZOOM_GAIN, duration: span(key.at, key.duration), ease: key.ease },
        at(key.at),
      );
    }
  }

  // water & attention (the water stays lively through the fight; visitors leave the lure at the bite)
  tl.to(scene, { flow: 1.3, duration: span(2, 8), ease: "sine.inOut" }, at(2))
    .to(scene, { flow: 1, duration: span(10, 8), ease: "sine.inOut" }, at(10))
    .to(scene, { flow: 0.85, duration: span(17, 6), ease: "sine.out" }, at(17))
    .to(scene, { flow: 0.95, duration: span(30, 20), ease: "sine.inOut" }, at(30));
  tl.to(scene, { engage: 0.7, duration: span(1, 5), ease: "sine.inOut" }, at(1))
    .to(scene, { engage: 1, duration: span(6, 6), ease: "sine.inOut" }, at(6))
    .to(scene, { engage: 0, duration: span(16, 5), ease: "sine.inOut" }, at(16));

  // after the fight, more scroll draws the hooked fish up out of the water along the line; scrolling
  // back lowers it again. (The engine eases this and holds it until the fish has fought a while.)
  tl.to(
    scene,
    { reel: 1, duration: (STORY.reelEnd - STORY.reelStart) * 100, ease: "none" },
    STORY.reelStart * 100,
  );

  // copy: the headline makes way for the fish (the brand statement is not here: it arrives with the catch)
  if (el.supportGroup) {
    tl.to(
      el.supportGroup,
      { autoAlpha: 0, y: -22, duration: span(stacked ? 0.5 : 1, 6), ease: "power1.in" },
      at(stacked ? 0.5 : 1),
    );
  }
  if (el.titleGroup) {
    tl.to(
      el.titleGroup,
      { autoAlpha: 0, xPercent: -6, y: -28, duration: span(stacked ? 1.5 : 2, 7), ease: "power1.in" },
      at(stacked ? 1.5 : 2),
    );
  }
  // while the headline is up, fish ease off underneath it (the engine reads `scene.copy`)
  tl.to(scene, { copy: 0, duration: span(stacked ? 1.5 : 2, 7), ease: "power1.in" }, at(stacked ? 1.5 : 2));

  // captions: one phrase at a time, each naming what the camera is looking at
  const [capRest, capWater, capStrike] = el.captions;
  if (capRest) tl.to(capRest, { autoAlpha: 0, duration: span(3, 2) }, at(3));
  if (capWater) {
    tl.to(capWater, { autoAlpha: 1, duration: span(5, 2) }, at(5)).to(capWater, { autoAlpha: 0, duration: span(11, 2) }, at(11));
  }
  if (capStrike) {
    tl.to(capStrike, { autoAlpha: 1, duration: span(13, 2) }, at(13)).to(capStrike, { autoAlpha: 0, duration: span(19, 2) }, at(19));
  }

  // environment: shafts dim as we descend and the haze thickens
  if (el.rays) {
    tl.to(el.rays, { opacity: 0.4, yPercent: -3, duration: span(0, 70) }, 0).to(
      el.rays,
      { opacity: 0.22, duration: span(70, 30) },
      at(70),
    );
  }
  if (el.haze) tl.to(el.haze, { opacity: 1, duration: span(40, 60) }, at(40));
  if (el.bg) {
    tl.to(el.bg, { scale: 1.12, transformOrigin: "64% 48%", duration: 100 }, 0);
  }

  return () => {
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("section-jump", onJump);
    if (shaftFrame) cancelAnimationFrame(shaftFrame);
    root.removeAttribute("inert");
    track.removeAttribute("data-backdrop");
    for (const ray of el.rayBoxes) {
      ray.style.removeProperty("translate");
      ray.style.removeProperty("opacity");
    }
    el.caustics?.style.removeProperty("translate");
    el.depth?.style.removeProperty("opacity");
    for (const node of el.leaving) node.style.removeProperty("opacity");
    el.statementSlot?.style.removeProperty("--leave");
    resetHeroScene(scene);
  };
}
