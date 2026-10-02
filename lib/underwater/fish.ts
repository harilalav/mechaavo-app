import { damp, kickEnvelope, turnToward, wobble } from "./motion";
import {
  beatTail,
  blankFish,
  fishLength,
  settleFacing,
  TILT,
  Z_LURE,
  type SimContext,
} from "./pose";
import { createPrimaryBrain, createPrimaryFish, type PrimaryBrain } from "./primaryFish";
import type { QualityProfile } from "./quality";
import { clamp, createRng, lerp, range, smoothstep, TAU, type Rng } from "./rng";
import type { Fish, LaneBrain, SpeciesKey, VisitorBrain, World } from "./types";

/**
 * The ambient population. Nothing here is driven by scroll position: every
 * fish swims at its own speed, measured in BODY LENGTHS per second, with its tail beating in
 * step with that speed. Scroll only nudges `flow` (water speed) and `engage`
 * (how strongly visitors are drawn to the lure).
 *
 *   lane fish   cross the frame at a steady cruise (some kick and glide), weave gently,
 *               and re-enter from the far edge with fresh parameters, so the water is never empty
 *   baitfish    schools: a leader on a lane and followers that hold loose places around it,
 *               each with its own lag, so a turn ripples through the school
 *   visitors    circle the lure on a tilted loop that tightens as the story engages;
 *               they pass behind it on the far side and in front on the near side
 *
 * Headings stay within a shallow pitch (a fish never swims straight up or down)
 * and turns are depth turns: the fish swings toward or away from the camera.
 */

interface TierSpec {
  depth: readonly [number, number];
  /** Body length, in lure lengths. */
  lures: readonly [number, number];
  /** Cruise speed, body lengths per second. */
  speed: readonly [number, number];
  opacity: readonly [number, number];
  /** Share of fish that kick and glide. */
  kick: number;
}

type LaneTier = "far" | "mid" | "near";

/**
 * Sizes are in LURE lengths (converted to the hero fish's unit when a fish is
 * configured), so the relationships hold on every screen. A lure is never bigger
 * than the fish, so every fish that swims at or in front of the lure's depth
 * (mid, near, visitors) is at least as long as the lure; only the far fish and
 * the baitfish, which read as distant or as prey, are smaller. How MANY big fish
 * there are depends on the screen (lib/underwater/quality.ts): a small screen
 * gets few, so the water stays calm around the product.
 */
const TIERS: Record<LaneTier, TierSpec> = {
  far: { depth: [0.1, 0.3], lures: [0.25, 0.38], speed: [1.4, 2.2], opacity: [0.42, 0.58], kick: 0 },
  mid: { depth: [0.4, 0.62], lures: [0.95, 1.25], speed: [1.1, 1.7], opacity: [0.68, 0.86], kick: 0.35 },
  near: { depth: [0.8, 0.96], lures: [1.5, 1.85], speed: [0.85, 1.35], opacity: [0.55, 0.75], kick: 0.25 },
};

/** Fish that circle the lure, in lure lengths: about as long as the lure when they are beside it. */
const VISITOR_LURES: readonly [number, number] = [0.95, 1.2];

const SPECIES: Record<LaneTier, readonly SpeciesKey[]> = {
  far: ["trout", "bass", "pike", "trout"],
  mid: ["trout", "bass", "pike", "bass", "trout"],
  near: ["bass", "pike"],
};

/** Steepest ambient climb or dive: about 16 degrees (natural swimming angle). */
const PITCH_LANE = 0.28;

export interface School {
  /** Rides a lane like any other fish; never drawn. */
  leader: Fish;
  members: Fish[];
  /** 0-1: how far the school has burst apart (the primary fish strikes nearby). */
  scatter: number;
}

export interface Population {
  /** Everything that is drawn, primary first. */
  fish: Fish[];
  lanes: Fish[];
  visitors: Fish[];
  schools: School[];
  primary: Fish;
  /** The hero fish's state machine (what it is doing and what the lure should feel). */
  brain: PrimaryBrain;
}

function blankLane(): LaneBrain {
  return {
    dir: 1,
    laneY: 0,
    speedBL: 1,
    bobAmp: 0.12,
    bobWave: 6,
    bobPhase: 0,
    driftAmp: 0.4,
    driftFreq: 0.2,
    driftPhase: 0,
    kick: 0,
    kickPeriod: 4,
    kickPhase: 0,
    seed: 0,
  };
}

type Band = readonly [number, number];

/**
 * Where a lane can run, as vertical intervals. The big fish (everything but the
 * far fish) keep a corridor of clear water around the lure, so the product always
 * has clean water around it and nothing large crosses in front of it by accident:
 * only the hero fish and the visitors come near it, and they do it on purpose.
 */
function laneBands(tier: LaneTier, fish: Fish, world: World): Band[] {
  const h = world.height;
  if (tier === "near") return [[0.8 * h, 0.96 * h]];
  if (tier === "far") return [world.stacked ? [0.22 * h, 0.84 * h] : [0.12 * h, 0.82 * h]];

  const lo = (world.stacked ? 0.3 : 0.2) * h;
  const hi = (world.stacked ? 0.84 : 0.8) * h;
  const half = 0.34 * world.lureLength + 0.2 * fishLength(fish, world);
  const bands: Band[] = [];
  if (world.focusY - half - lo > 0.07 * h) bands.push([lo, world.focusY - half]);
  if (hi - (world.focusY + half) > 0.07 * h) bands.push([world.focusY + half, hi]);
  return bands.length > 0 ? bands : [[lo, hi]];
}

/** A random height from a set of intervals, each in proportion to its length. */
function randomY(bands: Band[], rng: Rng): number {
  let total = 0;
  for (const b of bands) total += b[1] - b[0];
  let pick = rng() * total;
  for (const b of bands) {
    const size = b[1] - b[0];
    if (pick <= size) return b[0] + pick;
    pick -= size;
  }
  return bands[bands.length - 1][1];
}

/**
 * Best of several random lanes: the one furthest, in fish heights, from the other
 * fish at a similar depth, so two big fish are not stacked on top of each other.
 */
function pickLaneY(fish: Fish, bands: Band[], others: Fish[], world: World, rng: Rng): number {
  const height = 0.34 * fishLength(fish, world);
  let best = bands[0][0];
  let bestScore = -Infinity;
  for (let i = 0; i < 10; i++) {
    const y = randomY(bands, rng);
    let score = Infinity;
    for (const other of others) {
      if (other === fish || !other.lane) continue;
      if (Math.abs(other.depth - fish.depth) > 0.3) continue;
      const gap = Math.abs(other.lane.laneY - y) - 0.5 * (height + 0.34 * fishLength(other, world));
      score = Math.min(score, gap);
    }
    if (score > bestScore) {
      bestScore = score;
      best = y;
    }
  }
  return best;
}

/** Give a lane fish a fresh set of parameters. `initial` scatters it across the frame; otherwise it enters from an edge. */
function configureLane(
  fish: Fish,
  tier: LaneTier,
  world: World,
  rng: Rng,
  others: Fish[],
  initial: boolean,
  time: number,
): void {
  const spec = TIERS[tier];
  const lane = fish.lane ?? (fish.lane = blankLane());
  // one in five mid fish passes in front of the lure instead of behind it
  const front = tier === "mid" && fish.id % 5 === 0;

  fish.scale = (range(rng, spec.lures[0], spec.lures[1]) * world.lureLength) / world.unit;
  fish.depth = front ? range(rng, 0.68, 0.74) : range(rng, spec.depth[0], spec.depth[1]);
  fish.opacity = range(rng, spec.opacity[0], spec.opacity[1]);
  fish.persp = 1;

  const len = fish.scale * world.unit;
  // keep the weave inside the band even for the big foreground fish
  const bandRoom = 0.12 * world.height;

  lane.dir = rng() < 0.5 ? 1 : -1;
  lane.speedBL = range(rng, spec.speed[0], spec.speed[1]);
  lane.bobAmp = Math.min(range(rng, 0.1, 0.2), (0.5 * bandRoom) / len);
  lane.bobWave = range(rng, 5, 8.5);
  lane.bobPhase = range(rng, 0, TAU);
  lane.driftAmp = Math.min(range(rng, 0.25, 0.9), bandRoom / len);
  lane.driftFreq = range(rng, 0.12, 0.3);
  lane.driftPhase = range(rng, 0, TAU);
  lane.kick = rng() < spec.kick ? 1 : 0;
  lane.kickPeriod = range(rng, 3.2, 6.4);
  lane.kickPhase = range(rng, 0, TAU);
  lane.seed = range(rng, 0, 100);
  lane.laneY = pickLaneY(fish, laneBands(tier, fish, world), others, world, rng);

  if (initial) fish.x = range(rng, -0.08, 1.08) * world.width;
  else fish.x = lane.dir > 0 ? -(30 + 0.1 * len) : world.width + 30 + 0.1 * len;
  fish.y =
    lane.laneY +
    len *
      (lane.bobAmp * Math.sin(lane.bobPhase) +
        lane.driftAmp * Math.sin(time * lane.driftFreq + lane.driftPhase));
  fish.yaw = lane.dir > 0 ? 0 : Math.PI;
  fish.facing = lane.dir;
  fish.turn = 1;
  fish.pitch = 0;
  fish.prevX = fish.x;
  fish.prevY = fish.y;
  fish.placed = false;
}

/** True once a lane fish has swum fully out of frame (body and tail included). */
function isGone(fish: Fish, world: World): boolean {
  const len = fishLength(fish, world);
  const margin = 40 + 0.3 * len;
  return fish.lane!.dir > 0
    ? fish.x - 1.25 * len > world.width + margin
    : fish.x + 1.25 * len < -margin;
}

/** Advance a lane fish. Returns true when it left the frame and was re-launched. */
export function updateLane(fish: Fish, ctx: SimContext, others: Fish[]): boolean {
  const lane = fish.lane!;
  const { dt, time, world, scene } = ctx;
  const len = fishLength(fish, world);

  const kick = lane.kick > 0 ? kickEnvelope(time, lane.kickPeriod, lane.kickPhase) : 0;
  const burst = lane.kick > 0 ? 0.72 + 0.58 * kick : 1;
  const wander = 1 + 0.08 * Math.sin(time * 0.31 + lane.seed);
  const bodyLengths = lane.speedBL * burst * wander * scene.flow;
  // a small surge with every tail beat
  fish.speed = bodyLengths * len * (1 + 0.06 * Math.sin(fish.tailPhase * 2));

  fish.x += lane.dir * fish.speed * dt;
  lane.bobPhase += TAU * (bodyLengths / lane.bobWave) * dt;
  const y =
    lane.laneY +
    len *
      (lane.bobAmp * Math.sin(lane.bobPhase) +
        lane.driftAmp * Math.sin(time * lane.driftFreq + lane.driftPhase));
  const vy = fish.placed ? (y - fish.y) / Math.max(dt, 1e-4) : 0;
  fish.y = y;

  fish.yaw = (lane.dir > 0 ? 0 : Math.PI) + 0.1 * wobble(time * 0.4, lane.seed);
  const pitch = clamp(Math.atan2(-vy, Math.max(fish.speed, 1)), -PITCH_LANE, PITCH_LANE);
  fish.pitch = fish.placed ? damp(fish.pitch, pitch, 5, dt) : pitch;

  beatTail(
    fish,
    dt,
    fish.speed / Math.max(len, 1),
    lane.kick > 0 ? 0.8 + 0.5 * kick : 1,
    lane.kick > 0 ? 0.55 + 0.6 * kick : 1,
  );
  settleFacing(fish, dt);
  fish.placed = true;

  if (isGone(fish, world)) {
    configureLane(fish, fish.tier as LaneTier, world, ctx.rng, others, false, time);
    return true;
  }
  return false;
}

// ————————————————————————— visitors —————————————————————————

function createVisitor(index: number, fish: Fish, rng: Rng): VisitorBrain {
  const odd = index % 2 === 1;
  return {
    ring: 0.95 + 0.3 * index,
    ringZ: 0.5 + 0.12 * index,
    offX: odd ? 0.14 : -0.22,
    offY: odd ? 0.12 : -0.08,
    patrolCx: odd ? 0.62 : 0.4,
    patrolCy: odd ? 0.58 : 0.46,
    patrolRx: odd ? 0.32 : 0.4,
    patrolRz: odd ? 0.18 : 0.22,
    dir: odd ? -1 : 1,
    angle: range(rng, 0, TAU),
    speedBL: range(rng, 1.15, 1.65),
    bobPhase: range(rng, 0, TAU),
    baseDepth: Z_LURE,
    baseScale: fish.scale,
  };
}

/**
 * A visitor rides a tilted elliptical loop. Before the story engages the loop
 * is a wide patrol across the frame; as `engage` rises the centre drifts to
 * the lure and the radii shrink to a ring around it. Its speed stays constant
 * in body lengths per second throughout, and its heading is the loop's
 * tangent, so it turns by swinging toward and away from the camera.
 */
export function updateVisitor(fish: Fish, ctx: SimContext): void {
  const v = fish.visitor!;
  const { dt, time, world, scene, lure, lureValid } = ctx;
  const len = fishLength(fish, world);
  const e = smoothstep(0.05, 0.95, scene.engage);

  const lureLen = lureValid ? lure.length : world.lureLength;
  const focusX = lureValid ? lure.centerX : world.focusX;
  const focusY = lureValid ? lure.centerY : world.focusY;

  const cx = lerp(v.patrolCx * world.width, focusX + v.offX * lureLen, Math.max(0.15, e));
  const cy = lerp(v.patrolCy * world.height, focusY + v.offY * lureLen, Math.max(0.15, e));
  // keep the loop on screen
  const room = Math.min(cx + 0.08 * world.width, 1.08 * world.width - cx);
  const rx = Math.max(60, Math.min(lerp(v.patrolRx * world.width, v.ring * lureLen, e), room));
  const rz = lerp(v.patrolRz * world.width, v.ringZ * lureLen, e);

  const speed = v.speedBL * len * (1 - 0.15 * e) * scene.flow;
  const meanRadius = Math.sqrt((rx * rx + rz * rz) / 2) + 1;
  const omega = v.dir * (speed / meanRadius);
  v.angle += omega * dt;

  const sin = Math.sin(v.angle);
  const cos = Math.cos(v.angle);
  const x = cx + rx * cos;
  const z = rz * sin; // toward the camera
  const y = cy + 0.2 * len * Math.sin(time * 0.42 + v.bobPhase) + TILT * z;

  const vx = fish.placed ? (x - fish.x) / Math.max(dt, 1e-4) : 0;
  const vy = fish.placed ? (y - fish.y) / Math.max(dt, 1e-4) : 0;
  fish.x = x;
  fish.y = y;

  // tangent of the loop gives the heading: facing left on the near side, right on the far side
  const tangentX = -rx * sin * omega;
  const tangentZ = rz * cos * omega;
  const yawTarget = Math.atan2(tangentZ, tangentX);
  fish.yaw = fish.placed ? turnToward(fish.yaw, yawTarget, 2.4 * dt) : yawTarget;

  const horizontal = Math.hypot(tangentX, tangentZ);
  const pitch = clamp(Math.atan2(-vy, Math.max(horizontal, 1)), -0.24, 0.24);
  fish.pitch = fish.placed ? damp(fish.pitch, pitch, 5, dt) : pitch;
  fish.speed = Math.hypot(vx, vy);

  fish.depth = clamp(Z_LURE + 0.14 * sin, 0.1, 0.9);
  fish.persp = 1 + 0.9 * (fish.depth - Z_LURE);

  beatTail(fish, dt, horizontal / Math.max(len, 1), 1.25, 1.1);
  settleFacing(fish, dt);
  fish.placed = true;

  fish.state =
    e > 0.35 && Math.hypot(x - focusX, y - focusY) < 2.2 * lureLen ? "curious" : "idle";
}

// ————————————————————————— schools —————————————————————————

function createSchool(
  index: number,
  quality: QualityProfile,
  world: World,
  rng: Rng,
  firstId: number,
  lanes: Fish[],
): School {
  const leader = blankFish(firstId, "lane", "far", "bait");
  leader.lane = blankLane();
  configureBaitLane(leader, world, rng, lanes, true);

  const members: Fish[] = [];
  for (let i = 0; i < quality.schoolSize; i++) {
    const fish = blankFish(firstId + 1 + i, "school", "far", "bait");
    fish.scale = leader.scale * range(rng, 0.88, 1.18);
    fish.depth = leader.depth;
    fish.opacity = range(rng, 0.65, 0.85);
    fish.member = {
      school: index,
      offX: range(rng, -5, 3),
      offY: range(rng, -2.2, 2.2),
      offZ: range(rng, -1, 1),
      lag: range(rng, 2.6, 5.2),
      phase: range(rng, 0, TAU),
    };
    members.push(fish);
  }
  return { leader, members, scatter: 0 };
}

/** The leader of a school: a quick lane fish with a slow weave. */
function configureBaitLane(
  leader: Fish,
  world: World,
  rng: Rng,
  lanes: Fish[],
  initial: boolean,
): void {
  const lane = leader.lane ?? (leader.lane = blankLane());
  leader.scale = range(rng, 0.16, 0.23);
  leader.depth = range(rng, 0.25, 0.42);
  leader.opacity = 0.72;
  const len = leader.scale * world.unit;

  lane.dir = rng() < 0.5 ? 1 : -1;
  lane.speedBL = range(rng, 2.0, 2.8);
  lane.bobAmp = range(rng, 0.8, 1.6); // baitfish weave in whole lengths
  lane.bobWave = range(rng, 14, 24);
  lane.bobPhase = range(rng, 0, TAU);
  lane.driftAmp = range(rng, 1.5, 3.5);
  lane.driftFreq = range(rng, 0.15, 0.3);
  lane.driftPhase = range(rng, 0, TAU);
  lane.kick = 0;
  lane.seed = range(rng, 0, 100);
  const band: readonly [number, number] = world.stacked
    ? [0.3 * world.height, 0.82 * world.height]
    : [0.16 * world.height, 0.78 * world.height];
  lane.laneY = pickLaneY(leader, [band], lanes, world, rng);

  const spread = 9 * len; // a school is about nine lengths long
  if (initial) leader.x = range(rng, 0, 1) * world.width;
  else leader.x = lane.dir > 0 ? -(60 + spread) : world.width + 60 + spread;
  leader.y = lane.laneY;
  leader.yaw = lane.dir > 0 ? 0 : Math.PI;
  leader.facing = lane.dir;
  leader.placed = false;
}

function updateSchool(
  school: School,
  ctx: SimContext,
  scatter: number,
  lanes: Fish[],
): void {
  const { dt, time, world, lure, lureValid } = ctx;
  const leader = school.leader;
  const lane = leader.lane!;

  // a school only bursts apart when the strike is close to it
  const lureX = lureValid ? lure.centerX : world.focusX;
  const lureY = lureValid ? lure.centerY : world.focusY;
  const reach = (lureValid ? lure.length : world.lureLength) * 2.4;
  const near = 1 - smoothstep(0.6, 1, Math.hypot(leader.x - lureX, leader.y - lureY) / reach);
  school.scatter = damp(school.scatter, scatter * near, scatter > school.scatter ? 9 : 1.4, dt);

  // the leader rides its lane: reuse the lane update, but re-launch with school parameters
  const len = fishLength(leader, world);
  const bodyLengths = lane.speedBL * (1 + 0.1 * Math.sin(time * 0.37 + lane.seed)) * ctx.scene.flow;
  leader.speed = bodyLengths * len;
  leader.x += lane.dir * leader.speed * dt;
  lane.bobPhase += TAU * (bodyLengths / lane.bobWave) * dt;
  leader.y =
    lane.laneY +
    len *
      (lane.bobAmp * Math.sin(lane.bobPhase) +
        lane.driftAmp * Math.sin(time * lane.driftFreq + lane.driftPhase));
  leader.placed = true;

  const spread = 1 + 2.2 * school.scatter;
  const spreadPx = 9 * len * spread;
  const gone =
    lane.dir > 0
      ? leader.x - spreadPx > world.width + 60
      : leader.x + spreadPx < -60;
  if (gone) configureBaitLane(leader, world, ctx.rng, lanes, false);
  const snap = gone || school.members.some((m) => !m.placed);

  const dir = lane.dir;
  for (const fish of school.members) {
    const m = fish.member!;
    const length = fishLength(fish, world);
    const tx = leader.x + dir * (m.offX * length * spread + 0.4 * length * Math.sin(time * 0.8 + m.phase));
    const ty = leader.y + m.offY * length * spread + 0.35 * length * Math.sin(time * 1.15 + m.phase * 1.7);

    let vx = 0;
    let vy = 0;
    if (snap || !fish.placed) {
      fish.x = tx;
      fish.y = ty;
    } else {
      const k = 1 - Math.exp(-m.lag * dt);
      const nx = fish.x + (tx - fish.x) * k;
      const ny = fish.y + (ty - fish.y) * k;
      vx = (nx - fish.x) / Math.max(dt, 1e-4);
      vy = (ny - fish.y) / Math.max(dt, 1e-4);
      fish.x = nx;
      fish.y = ny;
    }

    fish.depth = clamp(leader.depth + m.offZ * 0.05, 0.05, 0.5);
    fish.yaw = (dir > 0 ? 0 : Math.PI) + 0.12 * wobble(time * 0.7, m.phase);
    const pitch = clamp(Math.atan2(-vy, Math.max(Math.abs(vx), 20)), -0.5, 0.5);
    fish.pitch = fish.placed ? damp(fish.pitch, pitch, 6, dt) : 0;
    fish.speed = Math.hypot(vx, vy) + leader.speed * 0.5;
    beatTail(fish, dt, fish.speed / Math.max(length, 1));
    fish.glint = Math.max(0, Math.sin(time * (1.5 + (m.phase % 1)) + m.phase * 3)) ** 6;
    settleFacing(fish, dt);
    fish.placed = true;
  }
}

// ————————————————————————— population —————————————————————————

export function createPopulation(quality: QualityProfile, world: World, seed: number): Population {
  const rng = createRng(seed);
  const primary = createPrimaryFish();
  const lanes: Fish[] = [];
  const visitors: Fish[] = [];
  const schools: School[] = [];
  let id = 1;

  const spawnLanes = (tier: LaneTier, count: number, visitorCount = 0) => {
    for (let i = 0; i < count; i++) {
      const species = SPECIES[tier][(id + i) % SPECIES[tier].length];
      const isVisitor = i < visitorCount;
      const fish = blankFish(id++, isVisitor ? "visitor" : "lane", tier, species);
      if (isVisitor) {
        // visitors are mid fish that ride a loop around the lure instead of a lane
        fish.scale = (range(rng, VISITOR_LURES[0], VISITOR_LURES[1]) * world.lureLength) / world.unit;
        fish.depth = Z_LURE;
        fish.opacity = range(rng, TIERS.mid.opacity[0], TIERS.mid.opacity[1]);
        fish.visitor = createVisitor(i, fish, rng);
        visitors.push(fish);
      } else {
        configureLane(fish, tier, world, rng, lanes, true, 0);
        lanes.push(fish);
      }
    }
  };

  spawnLanes("far", Math.max(0, quality.far));
  spawnLanes("mid", quality.mid + quality.visitors, quality.visitors);
  spawnLanes("near", quality.near);

  for (let s = 0; s < quality.schools; s++) {
    const school = createSchool(s, quality, world, rng, id, lanes);
    id += 1 + quality.schoolSize;
    schools.push(school);
  }

  const fish = [
    primary,
    ...lanes,
    ...visitors,
    ...schools.flatMap((school) => school.members),
  ];
  return { fish, lanes, visitors, schools, primary, brain: createPrimaryBrain() };
}

/** Advance every ambient fish. `scatter` is the primary fish's strike shock (0-1). */
export function stepPopulation(pop: Population, ctx: SimContext, scatter: number): void {
  for (const fish of pop.lanes) updateLane(fish, ctx, pop.lanes);
  for (const fish of pop.visitors) updateVisitor(fish, ctx);
  for (const school of pop.schools) updateSchool(school, ctx, scatter, pop.lanes);
}

/** Keep fish in their relative places when the viewport changes size. */
export function rescalePopulation(
  pop: Population,
  from: { width: number; height: number },
  to: { width: number; height: number },
): void {
  if (!from.width || !from.height) return;
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const scaleFish = (fish: Fish) => {
    fish.x *= sx;
    fish.y *= sy;
    fish.prevX *= sx;
    fish.prevY *= sy;
    if (fish.lane) fish.lane.laneY *= sy;
  };
  for (const fish of pop.lanes) scaleFish(fish);
  for (const school of pop.schools) {
    scaleFish(school.leader);
    for (const fish of school.members) scaleFish(fish);
  }
}
