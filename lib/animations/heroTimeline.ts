import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SECTION_IDS } from "../config/sections";
import { LURE_ZOOM_GAIN } from "../hero/lureConfig";
import { resetHeroScene, STORY, type HeroScene } from "../underwater/story";

export { createHeroScene, fishStateAt, STORY } from "../underwater/story";
export type { HeroScene } from "../underwater/story";

/**
 * The hero's choreography: ONE scrubbed ScrollTrigger timeline that drives the
 * DOM (headline, rays, camera, the lure's push-in) and the shared `HeroScene`
 * the Canvas engine reads (camera zoom, attention).
 *
 * Nothing is pinned by JavaScript. The hero is `position: sticky` inside a tall
 * track (.hero-track, sized in src/styles/underwater.css), and this timeline is
 * scrubbed over that track's scroll distance, minus the last screen, which is
 * the next section sliding up over the hero. The timeline is 100 units long, so
 * every position below is a percentage of that distance. Scroll backwards and
 * everything reverses.
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

let pluginsRegistered = false;

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
  // light shafts shimmer and sway on their own, out of phase with each other
  el.beams.forEach((beam, i) => {
    gsap.to(beam, {
      xPercent: i % 2 ? 7 : -7,
      skewX: i % 2 ? -2 : 2,
      duration: 11 + i * 2.3,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    gsap.to(beam, {
      opacity: 0.55,
      duration: 6 + i * 1.7,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  });
  if (el.haze) {
    gsap.to(el.haze, { xPercent: 2.5, duration: 24, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }

  // ———————————————————————— the scrubbed story ————————————————————————
  // The track holds the hero's own screen, the story, and one last screen for the
  // curtain (the next section sliding over the hero); the story is what is left.
  const storyDistance = () => Math.max(1, track.offsetHeight - 2 * root.offsetHeight);

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: track,
      start: "top top",
      end: () => `+=${storyDistance()}`,
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });

  // once the next section has slid all the way over the hero (its top edge at the top of the
  // screen) the hero is hidden behind it for another screen of scrolling: let the engine rest
  const sheet =
    document.getElementById(SECTION_IDS.categories) ||
    document.getElementById(SECTION_IDS.story);
  if (sheet) {
    ScrollTrigger.create({
      trigger: sheet,
      start: "top top",
      end: "max",
      onToggle: (self) => {
        scene.covered = self.isActive;
        // and nothing under the sheet should take focus or clicks (the nav, the call to action)
        root.toggleAttribute("inert", self.isActive);
      },
    });
  }

  // master clock: gives the timeline its 100-unit length; the fish read it to choose what to do
  tl.to(scene, { story: 1, duration: 100 }, 0);
  tl.to(scene, { descend: 1, duration: 100 }, 0);

  // the very first notch of the wheel sets the lure drifting toward the fish, so the page answers at once
  tl.to(scene, { lead: 1, duration: STORY.leadEnd * 100, ease: "sine.out" }, 0);

  // camera: wide, then closer at the catch, then a slow dolly while the fish fights
  for (const key of ZOOM_KEYS) {
    const zoom = stacked ? key.phone : key.to;
    tl.to(scene, { zoom, duration: key.duration, ease: key.ease }, key.at);
    if (el.lure) {
      tl.to(
        el.lure,
        { scale: 1 + (zoom - 1) * LURE_ZOOM_GAIN, duration: key.duration, ease: key.ease },
        key.at,
      );
    }
  }

  // water & attention (the water stays lively through the fight; visitors leave the lure at the bite)
  tl.to(scene, { flow: 1.3, duration: 8, ease: "sine.inOut" }, 2)
    .to(scene, { flow: 1, duration: 8, ease: "sine.inOut" }, 10)
    .to(scene, { flow: 0.85, duration: 6, ease: "sine.out" }, 17)
    .to(scene, { flow: 0.95, duration: 20, ease: "sine.inOut" }, 30);
  tl.to(scene, { engage: 0.7, duration: 5, ease: "sine.inOut" }, 1)
    .to(scene, { engage: 1, duration: 6, ease: "sine.inOut" }, 6)
    .to(scene, { engage: 0, duration: 5, ease: "sine.inOut" }, 16);

  // after the fight, more scroll draws the hooked fish up out of the water along the line; scrolling
  // back lowers it again. (The engine eases this and holds it until the fish has fought a while.)
  tl.to(
    scene,
    { reel: 1, duration: (STORY.reelEnd - STORY.reelStart) * 100, ease: "none" },
    STORY.reelStart * 100,
  );

  // copy: the headline makes way for the fish (the brand statement is not here: it arrives with the catch)
  if (el.supportGroup) {
    tl.to(el.supportGroup, { autoAlpha: 0, y: -22, duration: 6, ease: "power1.in" }, stacked ? 0.5 : 1);
  }
  if (el.titleGroup) {
    tl.to(
      el.titleGroup,
      { autoAlpha: 0, xPercent: -6, y: -28, duration: 7, ease: "power1.in" },
      stacked ? 1.5 : 2,
    );
  }
  // while the headline is up, fish ease off underneath it (the engine reads `scene.copy`)
  tl.to(scene, { copy: 0, duration: 7, ease: "power1.in" }, stacked ? 1.5 : 2);

  // captions: one phrase at a time, each naming what the camera is looking at
  const [capRest, capWater, capStrike] = el.captions;
  if (capRest) tl.to(capRest, { autoAlpha: 0, duration: 2 }, 3);
  if (capWater) {
    tl.to(capWater, { autoAlpha: 1, duration: 2 }, 5).to(capWater, { autoAlpha: 0, duration: 2 }, 11);
  }
  if (capStrike) {
    tl.to(capStrike, { autoAlpha: 1, duration: 2 }, 13).to(capStrike, { autoAlpha: 0, duration: 2 }, 19);
  }

  // environment: shafts dim as we descend and the haze thickens
  if (el.rays) {
    tl.to(el.rays, { opacity: 0.4, yPercent: -3, duration: 70 }, 0).to(
      el.rays,
      { opacity: 0.22, duration: 30 },
      70,
    );
  }
  if (el.haze) tl.to(el.haze, { opacity: 1, duration: 60 }, 40);
  if (el.bg) {
    tl.to(el.bg, { scale: 1.12, transformOrigin: "64% 48%", duration: 100 }, 0);
  }

  return () => {
    root.removeAttribute("inert");
    resetHeroScene(scene);
  };
}
