import { damp, easeOutCubic, pulse, turnToward, wobble } from "./motion";
import {
  beatTail,
  blankFish,
  fishLength,
  settleFacing,
  TILT,
  Z_LURE,
  type SimContext,
} from "./pose";
import { angleDiff, clamp, lerp, smoothstep, TAU } from "./rng";
import { STORY } from "./story";
import type { Fish } from "./types";

/**
 * The primary fish: a small state machine with natural, time-based motion.
 *
 * Scroll (`scene.story`) only decides WHAT the fish is doing. Every move is
 * made at the fish's own speed, in body lengths per second, with the tail in
 * step, so a slow scroll, a fast flick, a pause and a scroll back all look
 * like a real fish deciding things (nothing is scrubbed along a rail).
 *
 *   patrol    cruises a wide loop low in the water
 *   notice    slows and turns its head toward the lure, drifting closer
 *   inspect   hovers at a respectful distance, sculling, with an occasional feint
 *   circle    stalks around the lure on a tilted loop: behind it on the far side, in front on the near side
 *   windup    backs off and coils (C-shaped body, jaws open)
 *   strike    explosive burst to the hook, accelerating into the bite
 *   hooked    gulps the whole lure in (the mouth slides from the hook to the lure's nose, see `gulp`), then
 *             fights the line: head shakes, runs against it, thrashing tail, easing as the scene calms
 *   release   (scroll back) spits the hook and darts away, then resumes from wherever it is
 *
 * Positions are in LURE LENGTHS from the belly hook (x right, y down, z toward
 * the camera), so the choreography holds at any viewport size and while the
 * camera pushes in. If scroll runs ahead of the fish it hurries (acts faster)
 * rather than skipping what it was doing.
 */

export type PrimaryMode =
  | "patrol"
  | "notice"
  | "inspect"
  | "circle"
  | "windup"
  | "strike"
  | "hooked"
  | "release";

const ORDER: readonly PrimaryMode[] = [
  "patrol",
  "notice",
  "inspect",
  "circle",
  "windup",
  "strike",
  "hooked",
];

/**
 * Scroll thresholds for levels 1..4 (patrol is level 0). The strike lands a
 * moment after the last one, so the bite falls close to `STORY.caught`.
 */
const LEVELS = [STORY.curious - 0.02, STORY.approaching, STORY.striking - 0.04, STORY.striking + 0.01] as const;
/** Mode each level asks for: patrol, inspect, circle, windup, strike (hooked follows the strike). */
const LEVEL_MODE = [0, 2, 3, 4, 5] as const;
/** First level at which a hooked fish stays hooked. */
const HOLD_LEVEL = 4;
const HYSTERESIS = 0.015;

/** Fewest seconds spent in a mode before moving on to the next: a fish that bites quickly. */
const DWELL: Partial<Record<PrimaryMode, number>> = {
  notice: 0.6,
  inspect: 0.9,
  circle: 1.6,
  windup: 0.5,
};

interface Vec {
  x: number;
  y: number;
  z: number;
}

interface Geometry {
  patrol: { cx: number; cy: number; rx: number; rz: number; ry: number };
  inspect: Vec;
  feint: Vec;
  orbit: { cx: number; cy: number; rx: number; rz: number };
  windup: Vec;
  retreat: Vec;
}

// The hero fish is longer than the lure (FISH_TO_LURE), so the loops are wider
// than the lure is long: the fish stalks it from a distance and its body never
// hides the lure while it hovers.
const SPLIT: Geometry = {
  patrol: { cx: -0.6, cy: 0.4, rx: 0.55, rz: 0.3, ry: 0.04 },
  inspect: { x: -1.05, y: 0.12, z: 0.12 },
  feint: { x: -0.78, y: 0.04, z: 0.1 },
  orbit: { cx: -0.2, cy: 0.02, rx: 0.8, rz: 0.55 },
  windup: { x: -1.05, y: 0.22, z: -0.1 },
  retreat: { x: -0.95, y: 0.24, z: 0.06 },
};

// Phones and portrait screens: the lure fills the width, so everything is
// tighter, and the strike climbs from below-left at under 30 degrees.
const STACKED: Geometry = {
  patrol: { cx: -0.1, cy: 0.7, rx: 0.45, rz: 0.22, ry: 0.04 },
  inspect: { x: -0.68, y: 0.34, z: 0.1 },
  feint: { x: -0.42, y: 0.14, z: 0.1 },
  orbit: { cx: -0.05, cy: 0.05, rx: 0.6, rz: 0.45 },
  windup: { x: -0.74, y: 0.36, z: -0.08 },
  retreat: { x: -0.72, y: 0.34, z: 0.05 },
};

/** Where the mouth closes on the hook, a hair in front of the lure's plane. */
const HOOK: Vec = { x: 0, y: 0, z: 0.04 };

const STRIKE_SECONDS = 0.4;
const RELEASE_SECONDS = 0.55;
/** After the strike lands, how long the fish takes to draw the whole lure into its mouth. */
const GULP_SECONDS = 0.32;
/** How far past the lure's nose (eyelet) the mouth ends up, in lure lengths: the line then leaves the lips. */
const MOUTH_PAST = 0.06;
/** Steepest pitch while swimming freely: about 29 degrees. */
const PITCH_MAX = 0.5;

/**
 * The fight, in radians: the heading the fish settles on (nose up and toward the
 * line), head-shake amplitude, run amplitude, and the soft limit on the swing
 * about the hook. The limit keeps the whole body in frame and the fish well off
 * the vertical (heading stays between about -34 and +9 degrees).
 */
const HOOKED_HEADING = -0.22;
const SHAKE = 0.24;
const RUN = 0.55;
const SWING_LIMIT = 0.38;

export interface PrimaryBrain {
  mode: PrimaryMode;
  modeTime: number;
  level: number;
  entering: boolean;
  /** False until the fish has swum in from the left edge (it waits for the lure to arrive first). */
  entered: boolean;
  /** The scroll got far ahead of the fish: every step is hurried until it has caught up. */
  dash: boolean;
  /**
   * What `px, py` are measured from: 0 = the lure's resting hook (the fish patrols its own
   * stretch of water while the lure is still far off), 1 = the lure's live hook (once the fish
   * has noticed the lure it works around it, wherever it has drifted to).
   */
  frame: 0 | 1;

  /** Head position in lure space (lure lengths from the hook). */
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;

  patrolPhase: number;
  orbitAngle: number;
  feintClock: number;
  strikeFrom: Vec;
  releaseTo: Vec;
  hookedTime: number;

  // — outputs the engine reads —
  /** Counts up on every bite and every release; the engine reacts to the change. */
  hooks: number;
  releases: number;
  /** Signed pull on the line (-1 to 1): the swing of a fight. */
  pull: number;
  /** 0-1 energy of the head shake. */
  shake: number;
  /** 0-1 shock that sends nearby baitfish scattering. */
  scatter: number;
  /** 0-1 how much of the lure is inside the mouth: the engine fades the lure out as this nears 1. */
  gulp: number;
}

export function createPrimaryBrain(): PrimaryBrain {
  return {
    mode: "patrol",
    modeTime: 0,
    level: 0,
    entering: true,
    entered: false,
    dash: false,
    frame: 0,
    px: SPLIT.patrol.cx,
    py: SPLIT.patrol.cy,
    pz: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    patrolPhase: 0,
    orbitAngle: Math.PI,
    feintClock: 2.4,
    strikeFrom: { x: 0, y: 0, z: 0 },
    releaseTo: { x: 0, y: 0, z: 0 },
    hookedTime: 0,
    hooks: 0,
    releases: 0,
    pull: 0,
    shake: 0,
    scatter: 0,
    gulp: 0,
  };
}

/** The hero fish. Always a bass, never re-picked. */
export function createPrimaryFish(): Fish {
  const fish = blankFish(0, "primary", "primary", "bass");
  fish.scale = 1;
  fish.depth = Z_LURE;
  fish.opacity = 0.96;
  return fish;
}

function setMode(b: PrimaryBrain, mode: PrimaryMode): void {
  b.mode = mode;
  b.modeTime = 0;
  b.entering = true;
  if (mode === "strike") {
    b.strikeFrom = { x: b.px, y: b.py, z: b.pz };
    b.scatter = 1;
  } else if (mode === "hooked") {
    b.hookedTime = 0;
    b.gulp = 0;
    b.hooks++;
  } else if (mode === "release") {
    b.releaseTo = { x: 0, y: 0, z: 0 };
    b.strikeFrom = { x: b.px, y: b.py, z: b.pz };
    b.releases++;
  }
}

/** Scroll level (0-5) for a story position. Already being past a threshold makes it slightly easier to stay past it. */
function levelAt(story: number, previous: number): number {
  let level = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (story >= LEVELS[i] - (previous > i ? HYSTERESIS : 0)) level = i + 1;
  }
  return level;
}

/** A critically damped spring toward a target with a speed cap and a limit on climbing or diving. */
function seek(
  b: PrimaryBrain,
  target: Vec,
  omega: number,
  maxSpeed: number,
  dt: number,
): void {
  b.vx += (omega * omega * (target.x - b.px) - 2 * omega * b.vx) * dt;
  b.vy += (omega * omega * (target.y - b.py) - 2 * omega * b.vy) * dt;
  b.vz += (omega * omega * (target.z - b.pz) - 2 * omega * b.vz) * dt;

  const speed = Math.hypot(b.vx, b.vy, b.vz);
  if (speed > maxSpeed) {
    const k = maxSpeed / speed;
    b.vx *= k;
    b.vy *= k;
    b.vz *= k;
  }
  // a fish never swims straight up or down: vertical speed is a fraction of horizontal
  const horizontal = Math.hypot(b.vx, b.vz);
  const vyMax = 0.45 * horizontal + 0.03;
  b.vy = clamp(b.vy, -vyMax, vyMax);

  b.px += b.vx * dt;
  b.py += b.vy * dt;
  b.pz += b.vz * dt;
}

/** Write the brain's lure-space position and the fish's screen pose. */
/** Where the fish's lure-space coordinates are measured from, in screen px. */
function anchorOf(ctx: SimContext, frame: 0 | 1): { x: number; y: number } {
  const { world, lure } = ctx;
  if (frame === 1) return { x: lure.hookX, y: lure.hookY };
  // the lure's resting hook, pushed out from its resting centre by the camera's zoom like the lure itself
  return {
    x: world.focusX + (world.hookX - world.focusX) * lure.scale,
    y: world.focusY + (world.hookY - world.focusY) * lure.scale,
  };
}

function place(fish: Fish, b: PrimaryBrain, ctx: SimContext): void {
  const { lure } = ctx;
  const anchor = anchorOf(ctx, b.frame);
  fish.x = anchor.x + b.px * lure.length;
  fish.y = anchor.y + (b.py + TILT * b.pz) * lure.length;
  fish.depth = clamp(Z_LURE + 0.28 * b.pz, 0.2, 0.95);
  fish.persp = 1 + 0.22 * b.pz;
}

export function updatePrimary(
  b: PrimaryBrain,
  fish: Fish,
  ctx: SimContext,
): void {
  const { dt, time, world, scene, lure } = ctx;
  if (dt <= 0) return;

  const geo = world.stacked ? STACKED : SPLIT;
  // body length as a fraction of the lure's length (FISH_TO_LURE): converts body lengths per second to lure lengths per second
  const fl = (fishLength(fish, world) * lure.scale) / Math.max(lure.length, 1);

  // the fish first swims in from beyond the left edge, once the lure has arrived
  if (!b.entered) {
    b.entered = true;
    const edge = -(anchorOf(ctx, 0).x / Math.max(lure.length, 1)) - fl - 0.3;
    b.px = Math.min(geo.patrol.cx - geo.patrol.rx - 0.2, edge);
    b.py = geo.patrol.cy;
    b.pz = 0;
    b.vx = b.vy = b.vz = 0;
  }

  // — which mode does the scroll ask for? —
  b.level = levelAt(scene.story, b.level);
  const targetIdx = LEVEL_MODE[b.level];
  const currentIdx =
    b.mode === "release" ? 3 : ORDER.indexOf(b.mode);
  const gap = targetIdx - currentIdx;
  // Scroll far ahead of the fish (three or more steps) makes it dash, and it keeps dashing until it
  // has caught up: every step is short and it swims fast, so even a flick straight to the end of
  // the story shows the whole catch (circle, wind-up, strike, hooked) within about two seconds.
  // A smaller lead only hurries it a little, so a slow scroll never rushes the build-up.
  if (gap >= 3) b.dash = true;
  else if (gap <= 0) b.dash = false;
  const hurry = b.dash ? Math.max(5, 1 + 1.6 * (gap - 1)) : gap > 1 ? clamp(1 + 1.6 * (gap - 1), 1, 6) : 1;
  const hurrySpeed = Math.min(hurry, 3.2);
  // springs toward targets stiffen with the hurry too, or the fish would never arrive in time
  const eager = Math.sqrt(hurrySpeed);

  b.modeTime += dt;
  b.scatter = damp(b.scatter, 0, 0.7, dt);

  // — mode transitions —
  if (b.mode === "hooked") {
    if (b.level < HOLD_LEVEL) setMode(b, "release");
  } else if (b.mode !== "strike" && b.mode !== "release") {
    // Fast-scroll safe: if user scrolled to or past strike, immediately trigger strike burst!
    if (targetIdx >= 5 && currentIdx < 5) {
      setMode(b, "strike");
    } else {
      const dwell = (DWELL[b.mode] ?? 0) / hurry;
      if (gap > 0 && b.modeTime >= dwell) setMode(b, ORDER[currentIdx + 1]);
      else if (gap < 0 && b.modeTime >= 0.45) setMode(b, ORDER[currentIdx - 1]);
    }
  }

  // Patrolling, the fish keeps to its own water (frame 0) while the lure drifts toward it; from the moment it
  // notices the lure it works around the lure itself (frame 1). Re-measure from the new anchor so it never jumps.
  const wantFrame = b.mode === "patrol" ? 0 : 1;
  if (b.frame !== wantFrame) {
    const from = anchorOf(ctx, b.frame);
    const to = anchorOf(ctx, wantFrame);
    b.px += (from.x - to.x) / Math.max(lure.length, 1);
    b.py += (from.y - to.y) / Math.max(lure.length, 1);
    b.frame = wantFrame;
  }

  b.pull = damp(b.pull, 0, 6, dt);
  b.shake = damp(b.shake, 0, 6, dt);
  // the lure comes back out of the mouth when the fish lets go (release) and is never inside it before the bite
  if (b.mode !== "hooked") b.gulp = damp(b.gulp, 0, 6, dt);

  let state: Fish["state"] = "idle";
  let bodyLengthsPerSecond = 0;
  let scripted = false;

  switch (b.mode) {
    case "patrol": {
      const p = geo.patrol;
      if (b.entering) {
        b.patrolPhase = Math.atan2(b.pz / p.rz, (b.px - p.cx) / p.rx);
        b.entering = false;
      }
      const speed = 0.5 * fl; // 0.5 body lengths per second
      b.patrolPhase += (speed / Math.sqrt((p.rx * p.rx + p.rz * p.rz) / 2)) * dt;
      const target = {
        x: p.cx + p.rx * Math.cos(b.patrolPhase),
        y: p.cy + p.ry * Math.sin(2 * b.patrolPhase) + 0.02 * wobble(time * 0.5, 1.3),
        z: p.rz * Math.sin(b.patrolPhase),
      };
      seek(b, target, 3, 1.1 * fl, dt);
      state = "idle";
      break;
    }

    case "notice": {
      b.entering = false;
      const target: Vec = {
        x: geo.inspect.x + 0.04 * Math.sin(time * 0.7),
        y: geo.inspect.y + 0.03 * Math.sin(time * 0.9 + 1),
        z: geo.inspect.z,
      };
      seek(b, target, 2.2 * eager, 0.55 * fl * hurrySpeed, dt);
      state = "curious";
      break;
    }

    case "inspect": {
      b.entering = false;
      // a fish holding station is never quite still; every few seconds it edges in for a closer look, then backs off
      b.feintClock += dt;
      const feint = pulse(b.feintClock % 5.8, 3.4, 5.0);
      const target: Vec = {
        x: lerp(geo.inspect.x, geo.feint.x, feint) + 0.03 * Math.sin(time * 0.55),
        y: lerp(geo.inspect.y, geo.feint.y, feint) + 0.02 * Math.sin(time * 0.8 + 0.6),
        z: lerp(geo.inspect.z, geo.feint.z, feint) + 0.03 * Math.sin(time * 0.43),
      };
      seek(b, target, 2.6 * eager, (0.4 + 0.6 * feint) * fl * hurrySpeed, dt);
      state = "curious";
      break;
    }

    case "circle": {
      const o = geo.orbit;
      if (b.entering) {
        b.orbitAngle = Math.atan2(-b.pz / o.rz, clamp((b.px - o.cx) / o.rx, -1, 1));
        b.entering = false;
      }
      // keep the loop on screen when the lure sits close to an edge
      const roomRight = (world.width - lure.hookX) / Math.max(lure.length, 1) - 0.1;
      const rx = Math.min(o.rx, Math.max(0.3, roomRight - o.cx));
      const speed = 0.62 * fl * hurrySpeed;
      b.orbitAngle += (speed / Math.sqrt((rx * rx + o.rz * o.rz) / 2)) * dt;
      const target = {
        x: o.cx + rx * Math.cos(b.orbitAngle),
        y: o.cy + 0.04 * Math.sin(2 * b.orbitAngle),
        z: -o.rz * Math.sin(b.orbitAngle),
      };
      seek(b, target, 3 * eager, 1.25 * fl * hurrySpeed, dt);
      state = "approaching";
      break;
    }

    case "windup": {
      b.entering = false;
      const target: Vec = {
        x: geo.windup.x + 0.02 * Math.sin(time * 1.3),
        y: geo.windup.y + 0.015 * Math.sin(time * 1.7),
        z: geo.windup.z,
      };
      seek(b, target, 2.2 * eager, 0.8 * fl * hurrySpeed, dt);
      state = "approaching";
      break;
    }

    case "strike": {
      scripted = true;
      b.entering = false;
      state = "striking";
      const duration = STRIKE_SECONDS / Math.min(hurrySpeed, 1.6);
      const t = clamp(b.modeTime / duration, 0, 1);
      // accelerates into the bite: slowest at the start of the burst, fastest at the mouth
      const u = Math.pow(t, 1.35);
      const prev = { x: b.px, y: b.py, z: b.pz };
      b.px = lerp(b.strikeFrom.x, HOOK.x, u);
      b.py = lerp(b.strikeFrom.y, HOOK.y, u);
      b.pz = lerp(b.strikeFrom.z, HOOK.z, u);
      b.vx = (b.px - prev.x) / dt;
      b.vy = (b.py - prev.y) / dt;
      b.vz = (b.pz - prev.z) / dt;
      bodyLengthsPerSecond = Math.hypot(b.vx, b.vy, b.vz) / fl;
      if (t >= 1) setMode(b, "hooked");
      break;
    }

    case "hooked": {
      scripted = true;
      b.entering = false;
      state = "caught";
      b.hookedTime += dt;
      break;
    }

    case "release": {
      scripted = true;
      b.entering = false;
      state = "approaching";
      const t = clamp(b.modeTime / RELEASE_SECONDS, 0, 1);
      const u = easeOutCubic(t);
      const away = geo.retreat;
      const prev = { x: b.px, y: b.py, z: b.pz };
      b.px = lerp(b.strikeFrom.x, away.x, u);
      b.py = lerp(b.strikeFrom.y, away.y, u);
      b.pz = lerp(b.strikeFrom.z, away.z, u);
      b.vx = (b.px - prev.x) / dt;
      b.vy = (b.py - prev.y) / dt;
      b.vz = (b.pz - prev.z) / dt;
      bodyLengthsPerSecond = Math.hypot(b.vx, b.vy, b.vz) / fl;
      if (t >= 1) {
        setMode(b, ORDER[clamp(targetIdx, 0, 4)]);
      }
      break;
    }
  }

  fish.state = state;

  // ————— pose, orientation, body —————
  if (b.mode === "hooked") {
    applyFight(b, fish, ctx);
  } else {
    if (!scripted) bodyLengthsPerSecond = Math.hypot(b.vx, b.vy, b.vz) / fl;
    place(fish, b, ctx);

    // heading: along the swim direction, or toward the lure when hovering
    const horizontal = Math.hypot(b.vx, b.vz);
    const towardLure = b.px <= 0 ? 0 : Math.PI;
    const alongPath = Math.atan2(b.vz, b.vx);
    const w = smoothstep(0.03, 0.12, horizontal / fl);
    const yawTarget = towardLure + angleDiff(towardLure, alongPath) * w;
    const yawRate = b.mode === "strike" ? 9 : b.mode === "release" ? 6 : 1.7 * hurrySpeed;
    fish.yaw = fish.placed ? turnToward(fish.yaw, yawTarget, yawRate * dt) : yawTarget;

    const pitchTarget = clamp(
      Math.atan2(-b.vy, horizontal + 0.12 * fl),
      -PITCH_MAX,
      b.mode === "strike" ? 0.62 : PITCH_MAX,
    );
    fish.pitch = fish.placed ? damp(fish.pitch, pitchTarget, b.mode === "strike" ? 12 : 4, dt) : pitchTarget;
    fish.speed = Math.hypot(b.vx, b.vy, b.vz) * lure.length;

    // body language
    const coil = b.mode === "windup" ? 0.35 : 0;
    const strikeSnap = b.mode === "strike" ? 0.5 * (1 - smoothstep(0, 0.35, b.modeTime / STRIKE_SECONDS)) : 0;
    fish.bend = damp(fish.bend, coil + strikeSnap, b.mode === "strike" ? 18 : 3.5, dt);
    const gapeTarget =
      b.mode === "windup" ? 0.45 : b.mode === "strike" ? 1 : b.mode === "release" ? 0.6 : 0;
    fish.gape = damp(fish.gape, gapeTarget, b.mode === "strike" ? 14 : 5, dt);

    if (b.mode === "strike") {
      // explosive: fast, full-amplitude beats for the whole burst
      fish.tailFreq = 6.6;
      fish.tailAmp = 1.2;
      fish.tailPhase += TAU * fish.tailFreq * dt;
    } else {
      const coiled = b.mode === "windup" ? 0.5 : 1;
      beatTail(fish, dt, bodyLengthsPerSecond, 1, coiled);
    }
    settleFacing(fish, dt);
  }
  fish.placed = true;
}

/**
 * The fight. The head is pinned to the hook, so the body swings about it:
 * quick head shakes on top of slower runs against the line, a thrashing tail
 * and an S-bend flapping through the body. It all eases as the scene calms but
 * never stops, and it feeds the lure rig (`pull`, `shake`) so the lure and
 * line are tugged by what the fish does.
 */
function applyFight(b: PrimaryBrain, fish: Fish, ctx: SimContext): void {
  const { dt, scene, reel } = ctx;
  const t = b.hookedTime;
  // being drawn up out of the water, the fish thrashes harder
  const struggle = Math.min(1.35, Math.max(0.35, 1 - 0.7 * scene.calm) + 0.3 * reel);
  // the first second after the bite is the hardest
  const fresh = 1 + 0.35 * (1 - smoothstep(0, 1.2, t));

  const headShake = Math.sin(TAU * 3.8 * t) * SHAKE * struggle * fresh;
  const run =
    (Math.sin(TAU * 0.45 * t + 0.4) * 0.6 + Math.sin(TAU * 0.75 * t + 1.3) * 0.25) *
    RUN *
    struggle *
    fresh;

  // Natural horizontal fight heading: body swings laterally across hook, strictly natural angle!
  const heading = clamp(
    HOOKED_HEADING * 0.4 + 0.12 * Math.sin(TAU * 0.5 * t) + 0.22 * Math.tanh((headShake + run) / SWING_LIMIT),
    -0.25,
    0.25,
  );

  // The gulp: the strike lands on the hook (mid-lure) exactly as before, then the mouth slides forward over the
  // lure to just past its nose, so the whole lure ends up inside the fish and the line leaves the lips.
  // Measured live from the lure's anchors, so it follows the lure's float, tilt and the bite's yank.
  const gulp = easeOutCubic(clamp(t / GULP_SECONDS, 0, 1));
  b.gulp = gulp;
  const { lure } = ctx;
  const len = Math.max(lure.length, 1);
  const mouthX = (lure.tieX - lure.hookX + (lure.tieX - lure.tailX) * MOUTH_PAST) / len;
  const mouthY = (lure.tieY - lure.hookY + (lure.tieY - lure.tailY) * MOUTH_PAST) / len;

  // mouth shake: the head jitters on the lure
  const jitterX = Math.sin(TAU * 6.4 * t) * 0.014 * struggle;
  const jitterY = Math.sin(TAU * 4.9 * t + 1) * 0.011 * struggle;
  b.px = HOOK.x + mouthX * gulp + jitterX;
  b.py = HOOK.y + mouthY * gulp + jitterY;
  b.pz = HOOK.z;
  b.vx = b.vy = b.vz = 0;
  place(fish, b, ctx);

  // Keep pitch strictly horizontal and natural (never swims vertically!)
  const pitchGoal = clamp(-heading * 0.45, -0.22, 0.22);
  fish.pitch = damp(fish.pitch, pitchGoal, 14, dt);
  fish.yaw = turnToward(fish.yaw, 0.28 * Math.sin(TAU * 0.6 * t) * struggle, 5 * dt);
  fish.speed = 0;
  // Natural S-curve spine struggle
  fish.bend = 0.42 * Math.sin(TAU * 2.2 * t + 0.5) * struggle;
  // jaws stay wide while the lure goes in, then close on it
  fish.gape = damp(fish.gape, 0.35 + 0.65 * (1 - smoothstep(0.55, 1, gulp)), 8, dt);
  fish.tailFreq = 3.2 + 2.6 * struggle;
  fish.tailAmp = 0.85 + 0.4 * struggle;
  fish.tailPhase += TAU * fish.tailFreq * dt;
  settleFacing(fish, dt);

  // what the lure feels
  b.pull = clamp(run / (RUN * 0.8), -1, 1);
  b.shake = clamp(Math.abs(headShake) / SHAKE, 0, 1);
}
