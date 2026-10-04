#!/usr/bin/env node
/**
 * Offline check of the hero fish's behaviour (npm run fish:sim).
 *
 * Runs the real `updatePrimary` (lib/underwater/primaryFish.ts, loaded through jiti, so no
 * build and no browser) against a fixed lure, at a split and at a stacked layout, and
 * measures what a viewer sees as "natural": does the fish face where it swims, does it turn
 * at a rate a fish can, does its head flip from side to side, does it stay clear of the lure
 * while it has not noticed it. Everything is in lure lengths and body lengths, so the
 * layout's pixel size does not matter (only its proportions do, see FISH_TO_LURE).
 *
 * Scenarios (60 frames a second):
 *   idle      story 0: 70 s of patrol after the fish has swum in (the page left alone)
 *   circle    story eased to the circle beat (a slow scroll) and held for 12 s
 *   rejoin    scrolled back to 0 from the circle: it must resume patrolling cleanly
 *
 * Thresholds are the acceptance numbers of the hero-fish plan; a failure exits 1.
 * Usage: npm run fish:sim            (add --verbose for a per-second trace of the idle run)
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(`${ROOT}/scripts/fish-sim.mjs`, { fsCache: false, moduleCache: false });
const { createPrimaryBrain, createPrimaryFish, updatePrimary, YAW_RATE } = jiti(`${ROOT}/lib/underwater/primaryFish.ts`);
const { createHeroScene, STORY } = jiti(`${ROOT}/lib/underwater/story.ts`);
const { createCurrent } = jiti(`${ROOT}/lib/underwater/current.ts`);
const { createRng, angleDiff } = jiti(`${ROOT}/lib/underwater/rng.ts`);
const { TILT } = jiti(`${ROOT}/lib/underwater/pose.ts`);
const { FISH_TO_LURE, LURE_ANCHORS, LURE_LENGTH_RATIO } = jiti(`${ROOT}/lib/hero/lureConfig.ts`);

const VERBOSE = process.argv.includes("--verbose");
const DT = 1 / 60;

const LIMITS = {
  /** share of moving frames whose heading differs from the swim direction by more than 30 degrees */
  misaligned: 0.05,
  /** 95th percentile of the turn rate, as a share of the cap (YAW_RATE in primaryFish.ts, per mode) */
  yawShare: 0.75,
  /** the head flipping from one side to the other (a flip hides inside a turn), per minute */
  flipsPerMinute: 10,
  /** how far the head travels along x, in body lengths: a fish that swims somewhere, not one that spins (it was 0.4) */
  travelBL: 0.75,
  /** gap between the body and the lure while it patrols, in lure lengths */
  clearance: 0.3,
};

/** The lure's box, in lure lengths from its hook (x right, y down), from LURE_ANCHORS. */
const artW = 1 / LURE_LENGTH_RATIO;
const artH = (420 / 1000) * artW;
const LURE_BOX = {
  x0: (0.0 - LURE_ANCHORS.hook.x) * artW + 0.08,
  x1: (1.0 - LURE_ANCHORS.hook.x) * artW - 0.08,
  y0: (0.0 - LURE_ANCHORS.hook.y) * artH,
  y1: (1.0 - LURE_ANCHORS.hook.y) * artH,
};

/**
 * The two narrowest layouts of each kind, with the proportions measured on the live page (a 1024 x 690 laptop
 * and a 390 x 664 phone): how many lure lengths lie between the resting hook and the left edge of the screen,
 * and how high the hook sits.
 */
function layout(stacked) {
  const L = stacked ? 112 : 150;
  const art = L * artW;
  const world = {
    width: stacked ? 390 : 1024,
    height: stacked ? 664 : 690,
    unit: L * (stacked ? FISH_TO_LURE.stacked : FISH_TO_LURE.split),
    focusX: 0,
    focusY: 0,
    lureLength: L,
    stacked,
    copy: null,
    statement: null,
    nav: null,
    logo: null,
  };
  const roomLeft = stacked ? 1.96 : 5.4;
  const hookFromTop = 0.53 * world.height;
  world.focusX = roomLeft * L - (LURE_ANCHORS.hook.x - 0.5) * art;
  world.focusY = hookFromTop - (LURE_ANCHORS.hook.y - 0.5) * artH;
  const at = (a) => [world.focusX + (a.x - 0.5) * art, world.focusY + (a.y - 0.5) * artH];
  [world.tieX, world.tieY] = at(LURE_ANCHORS.tie);
  [world.hookX, world.hookY] = at(LURE_ANCHORS.hook);
  const [tailX, tailY] = at(LURE_ANCHORS.tail);
  const lure = {
    tieX: world.tieX,
    tieY: world.tieY,
    hookX: world.hookX,
    hookY: world.hookY,
    tailX,
    tailY,
    centerX: (world.tieX + tailX) / 2,
    centerY: (world.tieY + tailY) / 2,
    length: L,
    scale: 1,
    angle: 0,
  };
  return { world, lure, fl: stacked ? FISH_TO_LURE.stacked : FISH_TO_LURE.split };
}

const gap = (a0, a1, b0, b1) => Math.max(a0 - b1, b0 - a1, 0);

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

/** Run one stretch of story and measure the second half of what the fish does in it. */
function runScenario(stacked, steps) {
  const { world, lure, fl } = layout(stacked);
  const scene = createHeroScene();
  const ctx = { dt: DT, time: 0, world, scene, current: createCurrent(), reel: 0, lure, lureValid: true, rng: createRng(7) };
  const brain = createPrimaryBrain();
  const fish = createPrimaryFish();
  const out = {};

  let frame = 0;
  for (const step of steps) {
    const frames = Math.round(step.seconds * 60);
    const from = scene.story;
    const sample = {
      moving: 0,
      misaligned: 0,
      flips: 0,
      lastFacing: null,
      yawRates: [],
      xMin: Infinity,
      xMax: -Infinity,
      clearance: Infinity,
      frames: 0,
      modes: new Set(),
    };
    let prevYaw = null;
    for (let i = 0; i < frames; i++, frame++) {
      scene.story = step.to === undefined ? from : from + (step.to - from) * ((i + 1) / frames);
      ctx.time = frame * DT;
      updatePrimary(brain, fish, ctx);
      if (i < (step.settle ?? 0) * 60) {
        prevYaw = fish.yaw;
        sample.lastFacing = fish.facing;
        continue;
      }
      sample.frames++;
      sample.modes.add(brain.mode);
      const horizontal = Math.hypot(brain.vx, brain.vz) / fl;
      if (horizontal > 0.1) {
        sample.moving++;
        if (Math.abs(angleDiff(fish.yaw, Math.atan2(brain.vz, brain.vx))) > Math.PI / 6) sample.misaligned++;
      }
      if (prevYaw !== null) sample.yawRates.push(Math.abs(angleDiff(prevYaw, fish.yaw)) / DT);
      prevYaw = fish.yaw;
      if (sample.lastFacing !== null && fish.facing !== sample.lastFacing) sample.flips++;
      sample.lastFacing = fish.facing;
      sample.xMin = Math.min(sample.xMin, brain.px);
      sample.xMax = Math.max(sample.xMax, brain.px);
      if (brain.mode === "patrol") {
        const body = fl * fish.turn;
        const x0 = fish.facing > 0 ? brain.px - body : brain.px;
        const x1 = fish.facing > 0 ? brain.px : brain.px + body;
        const y = brain.py + TILT * brain.pz;
        const half = 0.16 * fl;
        const dx = gap(x0, x1, LURE_BOX.x0, LURE_BOX.x1);
        const dy = gap(y - half, y + half, LURE_BOX.y0, LURE_BOX.y1);
        sample.clearance = Math.min(sample.clearance, Math.hypot(dx, dy));
      }
      if (VERBOSE && step.name === "idle" && i % 60 === 0) {
        console.log(
          `  ${(i / 60).toFixed(0).padStart(3)}s ${brain.mode} px=${brain.px.toFixed(2)} pz=${brain.pz.toFixed(2)} yaw=${((fish.yaw * 180) / Math.PI).toFixed(0).padStart(4)} speed=${horizontal.toFixed(2)}BL/s facing=${fish.facing}`,
        );
      }
    }
    if (step.name) {
      out[step.name] = {
        ...sample,
        seconds: sample.frames / 60,
        fl,
        misalignedShare: sample.moving ? sample.misaligned / sample.moving : 0,
        yawP95: percentile(sample.yawRates, 0.95),
        flipsPerMinute: (sample.flips / Math.max(sample.frames / 60, 1e-6)) * 60,
        travelBL: (sample.xMax - sample.xMin) / fl,
      };
    }
  }
  return out;
}

const failures = [];
const check = (label, ok, detail) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${detail}`);
  if (!ok) failures.push(`${label}: ${detail}`);
};

for (const stacked of [false, true]) {
  const name = stacked ? "stacked" : "split";
  console.log(`\n${name} layout (fish ${stacked ? FISH_TO_LURE.stacked : FISH_TO_LURE.split} lure lengths long)`);
  const result = runScenario(stacked, [
    { seconds: 10 }, // the fish swims in from the left edge and settles into its water
    { name: "idle", seconds: 70 },
    // a slow scroll to the circle beat (levels in primaryFish.ts), then held
    { seconds: 10, to: STORY.approaching + 0.005 },
    { name: "circle", seconds: 12, settle: 3 },
    // back to the top: it must go back to patrolling without a lurch
    { seconds: 3, to: 0 },
    { seconds: 6 },
    { name: "rejoin", seconds: 30 },
  ]);

  for (const [scenario, r] of Object.entries(result)) {
    console.log(` ${scenario} (${r.seconds.toFixed(0)} s, modes: ${[...r.modes].join(", ")})`);
    check(
      "heading follows the swim direction",
      r.misalignedShare <= LIMITS.misaligned,
      `${(100 * r.misalignedShare).toFixed(1)}% of moving frames are more than 30 deg off (limit ${(100 * LIMITS.misaligned).toFixed(0)}%)`,
    );
    const cap = scenario === "circle" ? YAW_RATE.circle : YAW_RATE.base;
    check(
      "turn rate",
      r.yawP95 <= LIMITS.yawShare * cap,
      `p95 ${r.yawP95.toFixed(2)} rad/s (limit ${(LIMITS.yawShare * cap).toFixed(2)}, cap ${cap})`,
    );
    if (scenario !== "circle") {
      check(
        "head flips",
        r.flipsPerMinute <= LIMITS.flipsPerMinute,
        `${r.flipsPerMinute.toFixed(0)} per minute (limit ${LIMITS.flipsPerMinute})`,
      );
      check(
        "swims somewhere",
        r.travelBL >= LIMITS.travelBL,
        `the head travels ${r.travelBL.toFixed(2)} body lengths along x (at least ${LIMITS.travelBL})`,
      );
      check(
        "stays clear of the lure",
        r.clearance >= LIMITS.clearance,
        `closest the body gets is ${r.clearance.toFixed(2)} lure lengths (at least ${LIMITS.clearance})`,
      );
    }
  }
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
