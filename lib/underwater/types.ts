import type { FishState } from "./story";

export type { FishState };

/** What drives a fish: a lane crosser, a baitfish in a school, a lure visitor, or the hero fish. */
export type FishKind = "lane" | "school" | "visitor" | "primary";

/** Visual tier (style + depth of field). `primary` is the single hero fish that takes the lure. */
export type FishTier = "far" | "mid" | "near" | "primary";

export type SpeciesKey = "bass" | "trout" | "pike" | "bait";

/** Crosses the frame on its own lane, at a speed measured in body lengths per second. */
export interface LaneBrain {
  dir: 1 | -1;
  /** Mean height of the lane, px. */
  laneY: number;
  speedBL: number;
  /** Vertical weave, in body lengths, and the distance (in body lengths) one weave takes. */
  bobAmp: number;
  bobWave: number;
  bobPhase: number;
  /** Slow vertical drift, in body lengths. */
  driftAmp: number;
  driftFreq: number;
  driftPhase: number;
  /** 1 = kick-and-glide swimmer, 0 = steady cruiser. */
  kick: number;
  kickPeriod: number;
  kickPhase: number;
  seed: number;
}

/** Circles the lure on a tilted loop; the loop tightens from a wide screen patrol as the story engages. */
export interface VisitorBrain {
  /** Loop radii around the lure when fully engaged, in lure lengths (across, and toward the camera). */
  ring: number;
  ringZ: number;
  /** Where the lure sits in the loop, in lure lengths from its centre. */
  offX: number;
  offY: number;
  /** Wide patrol loop before the story engages: centre and radii as fractions of the screen width. */
  patrolCx: number;
  patrolCy: number;
  patrolRx: number;
  patrolRz: number;
  dir: 1 | -1;
  angle: number;
  speedBL: number;
  bobPhase: number;
  baseDepth: number;
  baseScale: number;
}

/** One baitfish in a school: holds a loose place around the leader, with its own lag. */
export interface SchoolMember {
  school: number;
  /** Offsets from the leader, in this fish's own lengths (forward positive). */
  offX: number;
  offY: number;
  offZ: number;
  /** How quickly it follows the leader, 1/s. */
  lag: number;
  phase: number;
}

export interface Fish {
  id: number;
  kind: FishKind;
  species: SpeciesKey;
  tier: FishTier;
  state: FishState;

  // — pose (screen space, before the camera) —
  /** Head (nose) position, px. */
  x: number;
  y: number;
  /** 0 = far, 1 = near. Drives parallax, haze and which canvas it is drawn on. */
  depth: number;
  /** Body length relative to `World.unit`. */
  scale: number;
  /** Perspective multiplier on the drawn length (1 at the lure's depth). */
  persp: number;
  /** Heading in the horizontal plane: 0 = facing right, PI = facing left, +-PI/2 = toward or away from the camera. */
  yaw: number;
  /** Nose up is positive, radians. */
  pitch: number;
  /** Speed along the heading, px/s. */
  speed: number;
  opacity: number;

  // — look —
  /** Which way the head points on screen (flips only while foreshortened). */
  facing: 1 | -1;
  /** Apparent length from foreshortening: 0.3 (end-on) to 1 (side-on). */
  turn: number;
  /** Body curvature: wind-up and strike coil, turns. */
  bend: number;
  /** Jaw open, 0-1. */
  gape: number;
  tailPhase: number;
  tailFreq: number;
  tailAmp: number;
  /** 0-1 flash along the flank (baitfish catching the light). */
  glint: number;

  /** Position last frame, for velocity. */
  prevX: number;
  prevY: number;
  placed: boolean;

  lane: LaneBrain | null;
  visitor: VisitorBrain | null;
  member: SchoolMember | null;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Everything the simulation needs to know about the viewport. */
export interface World {
  width: number;
  height: number;
  /** Primary-fish body length in px; `Fish.scale` is relative to this. */
  unit: number;
  /** Lure rest centre in px: also the camera focus point. */
  focusX: number;
  focusY: number;
  /** Lure length (tie to tail) at rest, px. */
  lureLength: number;
  /** Where the line is tied to the lure's nose when the lure is at rest, px. */
  tieX: number;
  tieY: number;
  /** Where the belly hook is when the lure is at rest, px: the hero fish patrols around it until the lure comes to it. */
  hookX: number;
  hookY: number;
  /** Phones and portrait screens: copy above, lure centred. */
  stacked: boolean;
  /** Where the headline block sits (px), so fish can ease off under it. Null when not measured. */
  copy: Rect | null;
  /** Where the brand statement sits (px); it appears at the catch. Null when not measured. */
  statement: Rect | null;
  /** The navigation bar, which dark fish should not cross at full strength. */
  nav: Rect | null;
  /** Centre of the logo in the navigation (px): where the lure swims out from. Null when not found. */
  logo: { x: number; y: number } | null;
}

/** Live lure geometry, measured from DOM anchors each frame (px, canvas space). */
export interface LureFrame {
  tieX: number;
  tieY: number;
  hookX: number;
  hookY: number;
  tailX: number;
  tailY: number;
  centerX: number;
  centerY: number;
  /** Tie to tail distance, px. */
  length: number;
  /** length / world.lureLength: 1 at rest, grows with the camera push. */
  scale: number;
  /** Tilt of the lure's long axis from horizontal, radians (nose up is positive). */
  angle: number;
}

/** The moving parts of the lure, found by `data-lure-part`. Jointed parts exist for the vector art only. */
export interface LureRigParts {
  /** The whole lure: where it floats, its tilt and size, pivoting on its nose (line eyelet). */
  pull: HTMLElement;
  /** Tremor under tension. */
  shake: HTMLElement;
  mid: HTMLElement | null;
  tail: HTMLElement | null;
  hookBelly: HTMLElement | null;
  hookTail: HTMLElement | null;
  /** The feather dressing on the tail treble, and its long fibers (nested in it). */
  dress: HTMLElement | null;
  dressTip: HTMLElement | null;
  /** Specular band that slides along the body. */
  spec: HTMLElement | null;
  /** Soft cast shadow behind the lure. */
  shadow: HTMLElement | null;
}

/** DOM anchors rendered by HeroProduct that the engine measures and moves. */
export interface LureAnchors {
  slot: HTMLElement;
  art: HTMLElement;
  tie: HTMLElement;
  hook: HTMLElement;
  tail: HTMLElement;
  rig: LureRigParts;
}
