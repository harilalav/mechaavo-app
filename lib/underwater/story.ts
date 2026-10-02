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
 * roughly the first seven notches (about a seventh of the way through). The catch then
 * has a long stretch of scroll to itself (the fight, the brand statement), after
 * which the fish is drawn up out of the water (`reel`) before the next section
 * slides over the hero.
 */
export const STORY = {
  engageStart: 0.01,
  curious: 0.04,
  approaching: 0.08,
  striking: 0.14,
  caught: 0.17,
  /** The lure has drifted all the way to the fish by here. */
  leadEnd: 0.06,
  /** The hooked fish starts to be drawn out of the water, and is gone by `reelEnd`. */
  reelStart: 0.45,
  reelEnd: 0.75,
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
