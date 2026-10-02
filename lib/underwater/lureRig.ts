import { LINE_ANGLE } from "../hero/lureConfig";
import type { Current } from "./current";
import { easeOutCubic, springCoefficients, stepSpring, damp, type Spring } from "./motion";
import { clamp, createRng, lerp, range, smoothstep, TAU, type Rng } from "./rng";
import type { LureRigParts } from "./types";

/**
 * The lure's physics: why it reads as an object floating in water instead of a
 * sticker.
 *
 * It hangs from its nose on a line the angler holds, so it is a small floating
 * body on a spring: the current pushes it off to leeward and the line brings it
 * back, so it drifts, sways and bobs around its place instead of sitting on it.
 * The whole lure also tilts about the eyelet like a pendulum, the jointed body
 * follows with lag and overshoot (the tail wags in the current and whips on a
 * twitch), and the treble hooks swing from their rings. Light plays over it: a
 * specular band slides with its tilt and flashes on a twitch.
 *
 * Every push comes from the shared water `Current` (lib/underwater/current.ts),
 * the same signal that bows the line, bends the weed and carries the motes, so
 * the lure moves with its surroundings. The rest is the angler (a rod-tip
 * twitch every few seconds) and the fish (a bump, a bite, a hooked fish's pull
 * and head shakes).
 *
 * On arrival the lure swims in from the logo: a short scripted path with its
 * body swimming, after which the springs take over from rest.
 *
 * `stepLureRig` advances the state; `applyLureRig` writes it to the DOM as CSS
 * transforms on the nested lure layers (compositor only, no layout): `pull` is
 * the whole lure (where it floats, its tilt about the nose, its size while it
 * swims in), `shake` the tremor of a line under tension. The engine owns those
 * layers, so nothing else animates them.
 */

export interface LureIntro {
  /** Where the lure starts, in px from its resting place. */
  fromX: number;
  fromY: number;
  /** Bezier control points of the swim, in px from rest. */
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  /** Seconds before the swim begins, and how long it takes. */
  delay: number;
  duration: number;
}

export interface LureRig {
  /** Nose position relative to its resting place, in lure lengths (x right, y down). */
  px: Spring;
  py: Spring;
  /** Tilt about the nose, radians. Negative = tail down. */
  theta: Spring;
  mid: Spring;
  tail: Spring;
  hookA: Spring;
  hookB: Spring;
  /** The feather dressing on the tail treble: its short fibers, and the long ones beyond them. */
  dress: Spring;
  dressTip: Spring;
  /** 0-1: how much weight the lure carries (a hooked fish hangs from it). */
  hang: number;
  /** 0-1: light flash along the body. */
  flash: number;
  /** Time of the next rod-tip twitch, and which way it whips the tail. */
  twitchAt: number;
  twitchSide: 1 | -1;
  /** Set for one step when the angler twitches, so the engine can release a few bubbles. */
  twitched: boolean;
  /**
   * Drifting toward the fish: how far the lure has gone from its place (px, in its own
   * space) and where the engine wants it. The engine sets the goal (the fish's nose,
   * scaled by how far the scroll has got); the lure glides there on a slow critically
   * damped spring, so it drifts rather than darts.
   */
  trackX: Spring;
  trackY: Spring;
  trackGoalX: number;
  trackGoalY: number;
  /** Where the lure ends up when it has been reeled all the way out of the frame, px from its place. */
  reelX: number;
  reelY: number;
  /** The swim in from the logo. `introDone` once it has settled (always true without one). */
  intro: LureIntro | null;
  introClock: number;
  introU: number;
  introDone: boolean;
  rng: Rng;
}

export interface RigInput {
  dt: number;
  time: number;
  current: Current;
  /** Water speed (1 = normal). */
  flow: number;
  hooked: boolean;
  /** Signed pull of a hooked fish (-1 to 1), and head-shake energy (0-1). */
  pull: number;
  shake: number;
  /** 0-1 calm after the catch: the fight eases. */
  calm: number;
  /** 0-1: how far the hooked fish has been drawn up the line (the lure goes with it). */
  reel: number;
  /** The lure's length at rest, px: converts the rig's units to pixels. */
  length: number;
}

/** What the DOM needs, in CSS units. */
export interface RigPose {
  /** Where the nose is, px from its resting place: the float plus, while it swims in, the path from the logo. */
  x: number;
  y: number;
  /** Only the float, without the swim in: what the cast shadow follows. */
  floatX: number;
  floatY: number;
  /** Tilt about the nose, degrees. */
  pullDeg: number;
  scale: number;
  opacity: number;
  /** Extra fade of the two treble hooks (and the feather on the tail one), on top of `opacity`. */
  hooksOpacity: number;
  tremorX: number;
  tremorY: number;
  tremorDeg: number;
  midDeg: number;
  tailDeg: number;
  hookADeg: number;
  hookBDeg: number;
  dressDeg: number;
  dressTipDeg: number;
  /** Specular band offset, percent of the lure's width. */
  specX: number;
  specOpacity: number;
}

const DEG = 180 / Math.PI;

// natural frequency (Hz) and damping ratio of each moving part
const [K_X, C_X] = springCoefficients(0.17, 0.3);
const [K_Y, C_Y] = springCoefficients(0.22, 0.34);
const [K_THETA, C_THETA] = springCoefficients(0.3, 0.3);
const [K_MID, C_MID] = springCoefficients(0.9, 0.3);
const [K_TAIL, C_TAIL] = springCoefficients(1.0, 0.28);
const [K_TRACK, C_TRACK] = springCoefficients(0.3, 1);
const [K_HOOK_A, C_HOOK_A] = springCoefficients(1.3, 0.18);
const [K_HOOK_B, C_HOOK_B] = springCoefficients(1.1, 0.2);
const [K_DRESS, C_DRESS] = springCoefficients(1.5, 0.22);
const [K_TIP, C_TIP] = springCoefficients(2.1, 0.17);

/** Resting tilt: the line pulls the nose up and to the right, so the tail hangs a hair low. */
const REST = -0.04;

/** How far (in lure lengths) a gust can carry the lure from its place, and how strongly it pushes. */
const GUST_PUSH_X = 0.17;
const GUST_PUSH_Y = 0.1;

const spring = (): Spring => ({ x: 0, v: 0 });

export function createLureRig(seed: number): LureRig {
  const rng = createRng(seed);
  return {
    px: spring(),
    py: spring(),
    theta: { x: REST, v: 0 },
    mid: spring(),
    tail: spring(),
    hookA: spring(),
    hookB: spring(),
    dress: spring(),
    dressTip: spring(),
    hang: 0,
    flash: 0,
    twitchAt: range(rng, 4.5, 7),
    twitchSide: 1,
    twitched: false,
    trackX: spring(),
    trackY: spring(),
    trackGoalX: 0,
    trackGoalY: 0,
    reelX: 0,
    reelY: 0,
    intro: null,
    introClock: 0,
    introU: 1,
    introDone: true,
    rng,
  };
}

/** Begin the swim in from the logo (or skip it with `null`). */
export function startIntro(rig: LureRig, intro: LureIntro | null): void {
  rig.intro = intro;
  rig.introClock = intro ? -intro.delay : 0;
  rig.introU = intro ? 0 : 1;
  rig.introDone = !intro;
}

/** The lure is where it belongs already (reduced motion, and a resize while it is settled). */
export function finishIntro(rig: LureRig): void {
  rig.introClock = rig.intro ? rig.intro.duration : 0;
  rig.introU = 1;
  rig.introDone = true;
}

/** Knock the lure: `omega` is an angular kick in rad/s (negative drops the tail). */
export function kickRig(rig: LureRig, omega: number, flash = 0.8): void {
  rig.theta.v += omega;
  rig.flash = Math.max(rig.flash, flash);
}

/** Shove the lure: velocity in lure lengths per second. */
export function bumpRig(rig: LureRig, vx: number, vy: number): void {
  rig.px.v += vx;
  rig.py.v += vy;
}

const smootherstep = (t: number): number => t * t * t * (t * (6 * t - 15) + 10);

/**
 * A point and its direction on the swim path, at parameter `t` (0 at the logo,
 * 1 at rest). A cubic Bezier whose last point is the origin, so that point adds
 * nothing to the position.
 */
function introPath(intro: LureIntro, t: number): { x: number; y: number; dx: number; dy: number } {
  const m = 1 - t;
  const a = m * m * m;
  const b = 3 * m * m * t;
  const c = 3 * m * t * t;
  const x = a * intro.fromX + b * intro.c1x + c * intro.c2x;
  const y = a * intro.fromY + b * intro.c1y + c * intro.c2y;
  const dx = 3 * m * m * (intro.c1x - intro.fromX) + 6 * m * t * (intro.c2x - intro.c1x) - 3 * t * t * intro.c2x;
  const dy = 3 * m * m * (intro.c1y - intro.fromY) + 6 * m * t * (intro.c2y - intro.c1y) - 3 * t * t * intro.c2y;
  return { x, y, dx, dy };
}

export function stepLureRig(rig: LureRig, input: RigInput): void {
  const { dt, time, current, flow, hooked, pull, shake, calm, reel } = input;
  rig.twitched = false;

  // — the swim in from the logo —
  if (!rig.introDone && rig.intro) {
    rig.introClock += dt;
    rig.introU = clamp(rig.introClock / rig.intro.duration, 0, 1);
    if (rig.introU >= 1) rig.introDone = true;
  }
  const arrived = rig.introDone;

  // the rod tip twitches now and then, like an angler working the lure: it darts toward the rod and whips its tail
  if (arrived && !hooked && time >= rig.twitchAt) {
    const side = rig.twitchSide;
    bumpRig(rig, 0.2 * Math.cos(LINE_ANGLE), 0.2 * Math.sin(LINE_ANGLE));
    kickRig(rig, -0.1, 1);
    rig.mid.v += 0.9 * side;
    rig.tail.v += 1.5 * side;
    rig.dress.v += 1.3 * side;
    rig.dressTip.v += 2.6 * side;
    rig.twitchSide = side === 1 ? -1 : 1;
    rig.twitchAt = time + range(rig.rng, 5.5, 9);
    rig.twitched = true;
  }

  rig.hang = damp(rig.hang, hooked ? 1 : 0, hooked ? 3 : 2, dt);
  rig.flash = damp(rig.flash, 0, 2.2, dt);

  // a hooked fish pulls the lure around, and its head shake rattles the line
  const fight = hooked ? 1 - 0.7 * calm : 0;
  const pullTorque = -pull * 0.42 * fight;
  const shakeTorque = shake * Math.sin(time * TAU * 3.4) * 2.6 * fight;

  if (arrived) {
    // the water's push, taken about its average so the lure drifts around its place rather than away from it
    const gust = current.x - current.mean;
    const forceX = GUST_PUSH_X * gust - 0.35 * pull * fight;
    const forceY = GUST_PUSH_Y * current.y + 0.045 * Math.sin(time * 0.9 + 0.8);
    stepSpring(rig.px, -0.11 * rig.hang, K_X, C_X, dt, forceX);
    stepSpring(rig.py, 0.13 * rig.hang, K_Y, C_Y, dt, forceY);
    rig.px.x = clamp(rig.px.x, -0.32, 0.32);
    rig.py.x = clamp(rig.py.x, -0.26, 0.26);

    // tilt about the nose: eddies, plus the tail lagging behind whenever the nose rises or sinks
    const eddy = 0.045 * flow * (0.6 * Math.sin(time * 0.7) + 0.4 * Math.sin(time * 1.9 + 1));
    const trailing = 0.8 * rig.py.v;
    // drifting toward the fish on a slack line
    stepSpring(rig.trackX, rig.trackGoalX, K_TRACK, C_TRACK, dt);
    stepSpring(rig.trackY, rig.trackGoalY, K_TRACK, C_TRACK, dt);
    const drifted = Math.min(1, Math.hypot(rig.trackX.x, rig.trackY.x) / (0.9 * input.length));

    // drawn up the line, the lure noses up toward the rod; drifting off from the rod it hangs a little nose up too
    stepSpring(
      rig.theta,
      REST - 0.06 * rig.hang - 0.32 * reel - 0.1 * drifted,
      K_THETA,
      C_THETA,
      dt,
      eddy + trailing + pullTorque + shakeTorque,
    );
    rig.theta.x = clamp(rig.theta.x, -0.6, 0.24);
  } else {
    // swimming in: the springs hold at rest while the path moves the lure
    rig.px.x = rig.px.v = 0;
    rig.py.x = rig.py.v = 0;
    rig.theta.x = REST;
    rig.theta.v = 0;
  }

  // jointed body: follows the pendulum a beat late, plus a natural swimbait wag in the current
  const wag = 0.06 + 0.08 * current.gust;
  const wave = Math.sin(time * TAU * 0.6);
  const flutter = shake * Math.sin(time * TAU * 6) * 0.08 * fight;
  const stroke = arrived ? 0 : 0.3 * 4 * rig.introU * (1 - rig.introU);
  const swimMid = stroke * Math.sin(time * TAU * 2.8);
  const swimTail = stroke * Math.sin(time * TAU * 2.8 - 0.9);
  stepSpring(rig.mid, -0.15 * rig.theta.v + wag * wave + flutter + 0.9 * swimMid, K_MID, C_MID, dt);
  stepSpring(
    rig.tail,
    -0.24 * rig.theta.v + 2.4 * wag * Math.sin(time * TAU * 0.6 - 0.9) + 2.0 * flutter + 1.5 * swimTail,
    K_TAIL,
    C_TAIL,
    dt,
  );
  // hooks swing from their rings: they lean against the tilt and swing on a kick
  stepSpring(rig.hookA, -0.7 * (rig.theta.x - REST) - 0.1 * rig.theta.v - 0.35 * rig.px.v, K_HOOK_A, C_HOOK_A, dt);
  stepSpring(rig.hookB, -0.5 * (rig.theta.x - REST) - 0.14 * rig.theta.v - 0.3 * rig.px.v, K_HOOK_B, C_HOOK_B, dt);
  // the dressing streams behind the treble and lags it (it is carried on the treble's own swing, so it leans back against it);
  // its long fibers flutter on the water's beat, harder in a gust and when a fish is on
  stepSpring(rig.dress, -0.5 * rig.hookB.x - 0.12 * rig.theta.v + 0.8 * flutter + 0.9 * swimTail, K_DRESS, C_DRESS, dt);
  stepSpring(
    rig.dressTip,
    -0.6 * rig.dress.x + (0.1 + 0.16 * current.gust + 0.12 * fight) * Math.sin(time * TAU * 1.5 + 0.8) + 1.4 * flutter,
    K_TIP,
    C_TIP,
    dt,
  );
}

export function readRigPose(
  rig: LureRig,
  input: Pick<RigInput, "time" | "flow" | "length" | "reel"> & {
    shake: number;
    /** 0-1: how far the lure has gone into a fish's mouth. Faded by opacity only: its size and anchors must stay as measured. */
    gulp?: number;
  },
): RigPose {
  const { time, flow, length, shake, reel, gulp = 0 } = input;
  // Dynamic buoyancy: realistic gentle floating bob & current sway
  const buoyancyBobY = (Math.sin(time * 1.6) * 0.045 + Math.sin(time * 2.8 + 1.2) * 0.02) * length;
  const buoyancySwayX = (Math.sin(time * 0.95) * 0.035 + Math.sin(time * 1.9 + 0.6) * 0.018) * length;
  const floatX = rig.px.x * length + buoyancySwayX;
  const floatY = rig.py.x * length + buoyancyBobY;
  // drawn up the line: it picks up speed as it goes, like a fish being hauled in
  const lift = Math.pow(clamp(reel, 0, 1), 1.8);
  let x = floatX + rig.trackX.x + rig.reelX * lift;
  let y = floatY + rig.trackY.x + rig.reelY * lift;
  let scale = 1;
  let opacity = 1;
  let tilt = 0;

  if (!rig.introDone && rig.intro) {
    const u = rig.introU;
    const path = introPath(rig.intro, smootherstep(u));
    x += path.x;
    y += path.y;
    // it grows as it swims toward the camera, and appears out of the logo in the first few frames
    scale = lerp(0.16, 1, easeOutCubic(clamp(u / 0.82, 0, 1)));
    opacity = smoothstep(0, 0.07, u);
    // nose along the way it is going, levelling out as it arrives
    tilt = Math.atan2(path.dy, Math.max(path.dx, 1e-3)) * 0.75 * (1 - smoothstep(0.62, 1, u));
  }

  // the body goes once the mouth has closed over it; the hooks and feather hang outside the fish, so they go first
  opacity *= 1 - smoothstep(0.4, 0.9, gulp);
  const hooksOpacity = 1 - smoothstep(0.15, 0.7, gulp);

  // a hooked fish drags the lure low and back; tremor is the line humming under tension
  const tremor = shake * (0.6 + 0.4 * Math.sin(time * 9));
  const pitchRock = Math.sin(time * 1.4) * 2.2 + Math.sin(time * 2.7 + 0.8) * 1.2;
  return {
    x,
    y,
    floatX,
    floatY,
    pullDeg: (rig.theta.x + tilt) * DEG + pitchRock,
    scale,
    opacity,
    hooksOpacity,
    tremorX: Math.sin(time * 37) * tremor * 1.4,
    tremorY: Math.sin(time * 41 + 0.6) * tremor * 1.1,
    tremorDeg: Math.sin(time * 33 + 1.1) * tremor * 0.4,
    midDeg: rig.mid.x * DEG,
    tailDeg: rig.tail.x * DEG,
    hookADeg: rig.hookA.x * DEG,
    hookBDeg: rig.hookB.x * DEG,
    dressDeg: rig.dress.x * DEG,
    dressTipDeg: rig.dressTip.x * DEG,
    // the highlight drifts along the body and slides with the tilt
    specX: 12 * Math.sin(time * 0.35 * (0.6 + 0.4 * flow)) + (rig.theta.x - REST) * 160,
    specOpacity: 0.55 + 0.45 * rig.flash,
  };
}

const px = (value: number) => value.toFixed(2);

/** Write the pose to the DOM. Transforms and opacity only. */
export function applyLureRig(parts: LureRigParts, pose: RigPose): void {
  // origin is the nose (CSS), so the tilt and the size both pivot on the eyelet
  parts.pull.style.transform =
    `translate3d(${px(pose.x)}px, ${px(pose.y)}px, 0) rotate(${pose.pullDeg.toFixed(3)}deg)` +
    (pose.scale === 1 ? "" : ` scale(${pose.scale.toFixed(4)})`);
  parts.pull.style.opacity = pose.opacity >= 0.999 ? "" : pose.opacity.toFixed(3);
  parts.shake.style.transform = `translate3d(${px(pose.tremorX)}px, ${px(pose.tremorY)}px, 0) rotate(${pose.tremorDeg.toFixed(3)}deg)`;
  if (parts.mid) parts.mid.style.transform = `rotate(${pose.midDeg.toFixed(3)}deg)`;
  if (parts.tail) parts.tail.style.transform = `rotate(${pose.tailDeg.toFixed(3)}deg)`;
  const hooksFade = pose.hooksOpacity >= 0.999 ? "" : pose.hooksOpacity.toFixed(3);
  if (parts.hookBelly) {
    parts.hookBelly.style.transform = `rotate(${pose.hookADeg.toFixed(3)}deg)`;
    parts.hookBelly.style.opacity = hooksFade;
  }
  if (parts.hookTail) {
    parts.hookTail.style.transform = `rotate(${pose.hookBDeg.toFixed(3)}deg)`;
    parts.hookTail.style.opacity = hooksFade;
  }
  if (parts.dress) parts.dress.style.transform = `rotate(${pose.dressDeg.toFixed(3)}deg)`;
  if (parts.dressTip) parts.dressTip.style.transform = `rotate(${pose.dressTipDeg.toFixed(3)}deg)`;
  if (parts.spec) {
    parts.spec.style.transform = `translate3d(${pose.specX.toFixed(2)}%, 0, 0)`;
    parts.spec.style.opacity = pose.specOpacity.toFixed(3);
  }
  // the cast shadow falls on water further away, so it trails the lure a little
  if (parts.shadow) {
    parts.shadow.style.transform = `translate3d(${px(-pose.floatX * 0.4)}px, ${px(-pose.floatY * 0.3)}px, 0) rotate(${(pose.pullDeg * 0.3).toFixed(3)}deg)`;
  }
}

/** Put every moving part back to rest (reduced motion, teardown). */
export function resetLureRig(parts: LureRigParts): void {
  for (const el of [
    parts.pull,
    parts.shake,
    parts.mid,
    parts.tail,
    parts.hookBelly,
    parts.hookTail,
    parts.dress,
    parts.dressTip,
    parts.spec,
    parts.shadow,
  ]) {
    if (!el) continue;
    el.style.transform = "";
    if (el === parts.spec || el === parts.pull || el === parts.hookBelly || el === parts.hookTail) el.style.opacity = "";
  }
}
