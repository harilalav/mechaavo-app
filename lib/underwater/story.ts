/**
 * Shared story contract between the scroll timeline (DOM + GSAP) and the
 * underwater Canvas engine. Pure data + functions: no GSAP, no DOM.
 *
 * `HeroScene` is a plain mutable object. The scrubbed GSAP timeline tweens its
 * numbers; the Canvas engine reads them every animation frame. It is never put
 * in React state, so scrolling causes zero React renders.
 *
 * Scroll decides WHERE in the story we are (`story`, plus the camera and
 * attention values). It never drives a fish's position: the primary fish reads
 * `story` to pick what it is doing, then moves at its own natural speed.
 *
 * Going the other way, the engine owns `calm` and `statement`: how the fight
 * has eased, and whether the catch has happened. Both follow the fish's own
 * clock, never the scroll position, so a fast scroll cannot skip the fight or
 * cut it short.
 */

export type FishState =
  | "idle"
  | "curious"
  | "approaching"
  | "striking"
  | "caught";

/**
 * Master-timeline positions (0-1) where the fishing story changes beat. The
 * very first scroll sets the lure drifting toward the fish (`lead`), so the page
 * answers at once; the fish notices it at once, circles and strikes within
 * roughly the first seven notches. After the bite the story is short on purpose: the
 * lure is drawn up out of the water (`reel`) a quarter of a screen of scroll after the
 * bite and is gone a little over half a screen later, then the next section slides over
 * the hero.
 *
 * The story is 1.9 screens of scroll long on a landscape layout and 1.5 on a stacked one
 * (`--hero-screens` in src/styles/underwater.css minus the hero's own screen and the
 * curtain's). Every beat is a share of it, so the bite lands the same distance down the
 * page on both (about 0.6 screens, plus the scrub's lag): these are the numbers of the
 * earlier 4.1-screen story, scaled by 2.15, so the approved bite did not move. Anything
 * after the bite is measured in screens from it: sweep gate G16 (scripts/design-sweep.mjs)
 * fails if the budget is broken.
 */
export const STORY = {
  engageStart: 0.02,
  curious: 0.086,
  approaching: 0.172,
  striking: 0.3,
  caught: 0.365,
  /** The lure has drifted all the way to the fish by here. */
  leadEnd: 0.129,
  /**
   * The thresholds the primary fish reads (see `LEVELS` in primaryFish.ts): it notices the lure, stalks
   * it, winds up and strikes. The strike lands a moment after the last, close to `caught`.
   */
  notice: 0.043,
  windup: 0.215,
  strike: 0.322,
  /** Already being past a threshold makes it slightly easier to stay past it. */
  hysteresis: 0.032,
  /** The hooked fish starts to be drawn out of the water, and is gone by `reelEnd`. */
  reelStart: 0.45,
  reelEnd: 0.82,
} as const;

/** The beat for a scroll position (the brief's five fish states). */
export function fishStateAt(story: number): FishState {
  if (story >= STORY.caught) return "caught";
  if (story >= STORY.striking) return "striking";
  if (story >= STORY.approaching) return "approaching";
  if (story >= STORY.curious) return "curious";
  return "idle";
}

export interface HeroScene {
  /** Master scroll progress, 0-1 (linear with the pinned timeline). */
  story: number;
  /** 0-1: how strongly ambient "visitor" fish are drawn toward the lure. */
  engage: number;
  /** Ambient swim-speed multiplier (water flow). */
  flow: number;
  /** 0-1: how far the fight has eased. Set by the engine from the time since the bite, not from the scroll. */
  calm: number;
  /** Camera push-in. 1 = wide view. */
  zoom: number;
  /** 0-1: camera descent through the water column (vertical parallax). */
  descend: number;
  /** 1 while the headline is on screen, 0 once it has left. Fish fade under the copy while it is up. */
  copy: number;
  /** 0-1: the brand statement is up. Set by the engine when the fish is hooked, so the words arrive with the catch. */
  statement: number;
  /**
   * 0-1: how far the lure has drifted toward the hero fish (it tracks the fish's
   * nose and holds still once the fish has noticed it). Scroll sets it from the very
   * first notch of the wheel, so the page answers at once.
   */
  lead: number;
  /**
   * 0-1: how far the hooked fish has been drawn up out of the water. Scroll
   * decides how far (the timeline tweens it); the engine decides how fast it
   * can happen (it only reels a fish that has been fighting a while, and eases
   * toward the target), so a fast scroll still shows the fish being lifted out.
   */
  reel: number;
  /** True once the next section has slid fully over the hero: nothing here is visible, so the engine rests. */
  covered: boolean;
  /** True when the user prefers reduced motion (engine renders a still). */
  reduced: boolean;
}

export function createHeroScene(): HeroScene {
  return {
    story: 0,
    engage: 0,
    flow: 1,
    calm: 0,
    zoom: 1,
    descend: 0,
    copy: 1,
    statement: 0,
    lead: 0,
    reel: 0,
    covered: false,
    reduced: false,
  };
}

export function resetHeroScene(scene: HeroScene): void {
  Object.assign(scene, createHeroScene());
}
