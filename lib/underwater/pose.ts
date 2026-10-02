import type { Current } from "./current";
import { damp } from "./motion";
import { clamp, TAU, type Rng } from "./rng";
import type { HeroScene } from "./story";
import type { Fish, FishKind, FishTier, LureFrame, SpeciesKey, World } from "./types";

/**
 * Shared pieces of the fish simulation: the per-frame context, the blank
 * fish, and the two small things every swimmer does the same way (settle which
 * way it faces, beat its tail in step with its speed).
 */

/** Depth of the lure's plane. Fish deeper than this pass behind it, shallower in front. */
export const Z_LURE = 0.62;

/** Foreshortening never goes below this, so a turning fish is never edge-on. */
export const MIN_TURN = 0.3;

/** How far the near side of a circling loop sits below the far side (camera looks slightly down). */
export const TILT = 0.16;

export interface SimContext {
  dt: number;
  time: number;
  world: World;
  scene: HeroScene;
  /** The water's push this frame (shared with the lure, the line, the weed and the motes). */
  current: Current;
  /** 0-1: how far the hooked fish has been drawn up out of the water (eased, gated by the fight). */
  reel: number;
  /** Live lure geometry (valid only when `lureValid`). */
  lure: LureFrame;
  lureValid: boolean;
  rng: Rng;
}

export function blankFish(
  id: number,
  kind: FishKind,
  tier: FishTier,
  species: SpeciesKey,
): Fish {
  return {
    id,
    kind,
    species,
    tier,
    state: "idle",
    x: 0,
    y: 0,
    depth: 0.5,
    scale: 0.5,
    persp: 1,
    yaw: 0,
    pitch: 0,
    speed: 0,
    opacity: 0.7,
    facing: 1,
    turn: 1,
    bend: 0,
    gape: 0,
    tailPhase: 0,
    tailFreq: 1.5,
    tailAmp: 0.8,
    glint: 0,
    prevX: 0,
    prevY: 0,
    placed: false,
    lane: null,
    visitor: null,
    member: null,
  };
}

/** Body length in px at the lure's depth. */
export const fishLength = (fish: Fish, world: World): number => fish.scale * world.unit;

/**
 * Which way the fish faces, with hysteresis: the head flips sides only after
 * the heading has clearly crossed the line of sight, at which point the body
 * is foreshortened (`turn`) so the flip is hidden inside the turn.
 */
export function settleFacing(fish: Fish, dt: number): void {
  const c = Math.cos(fish.yaw);
  if (c > MIN_TURN) fish.facing = 1;
  else if (c < -MIN_TURN) fish.facing = -1;
  fish.turn = damp(fish.turn, Math.max(MIN_TURN, Math.abs(c)), 12, dt);
}

/**
 * Tail beat in step with swimming: frequency rises with speed in body lengths
 * per second (fast fish beat fast, gliding fish barely at all), amplitude with
 * effort. Small baitfish beat faster than big fish at the same relative speed.
 */
export function beatTail(
  fish: Fish,
  dt: number,
  bodyLengthsPerSecond: number,
  freqScale = 1,
  ampScale = 1,
): void {
  const bl = Math.min(bodyLengthsPerSecond, 3);
  const base = fish.species === "bait" ? 3.2 + 2.0 * bl : 0.9 + 1.3 * bl;
  fish.tailFreq = base * freqScale;
  fish.tailAmp = clamp(0.6 + 0.28 * Math.min(bl, 1.6), 0.6, 1.1) * ampScale;
  fish.tailPhase += TAU * fish.tailFreq * dt;
}
