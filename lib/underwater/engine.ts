import { FISH_TO_LURE, LINE_ANGLE, LINE_ANGLE_STACKED, LURE_ANCHORS, LURE_LENGTH_RATIO } from "../hero/lureConfig";
import type { BrandPalette } from "../theme/brand";
import {
  clearBubbles,
  createBubblePool,
  drawBubbles,
  emitBubbles,
  emitRipple,
  emitSplash,
  emitStream,
  updateBubbles,
} from "./bubbles";
import { createCausticTile } from "./caustics";
import { createCurrent, stepCurrent } from "./current";
import { createPopulation, rescalePopulation, stepPopulation, type Population } from "./fish";
import { createSpriteFishRenderer, FISH_SPRITE_SOURCES, loadFishSprites } from "./fishAssets";
import {
  applyLureRig,
  bumpRig,
  createLureRig,
  finishIntro,
  kickRig,
  readRigPose,
  resetLureRig,
  startIntro,
  stepLureRig,
  type LureIntro,
} from "./lureRig";
import { damp } from "./motion";
import { createParticleField, shoveParticles, updateParticles, type ParticleField } from "./particles";
import { Z_LURE, type SimContext } from "./pose";
import { updatePrimary } from "./primaryFish";
import { getQuality, type QualityProfile } from "./quality";
import { createProceduralFishRenderer, type FishRenderer, type FishView } from "./renderFish";
import { clamp, createRng, smoothstep, TAU } from "./rng";
import { createSeabed, drawWeed, type SeabedLayer } from "./seabed";
import type { HeroScene } from "./story";
import type { Fish, LureAnchors, LureFrame, Rect, World } from "./types";

/**
 * Underwater Canvas engine, framework free.
 *
 * Two stacked canvases share one simulation:
 *   back  (below the lure): seabed, far fish and baitfish, fish passing behind
 *         the lure, motes, the line and the lure's glow
 *   front (above the lure): fish passing in front of it, the hero fish when it
 *         is on the near side, bubbles, near motes
 * A fish is drawn on whichever side of the lure's plane it is on, so a circling
 * fish genuinely passes behind the lure and then in front of it.
 *
 * Per frame: advance the water's current, step the lure's physics and write it to
 * the DOM, measure where the lure now is, step the fish against that, react to
 * bites, draw. The current is the one signal that moves the lure, bows its line,
 * bends the weed and carries the motes, so they all lean together. Everything is
 * driven by `HeroScene` (tweened by the scroll timeline) and the live lure
 * geometry. No React state is touched here.
 *
 * The engine tells the page about the catch by setting `data-caught` on the hero
 * root when a fish is hooked (and clearing it on a release): the brand statement
 * arrives with the bite, whatever the scroll speed did. It also sets `data-lure`
 * once the lure's swim in from the logo begins.
 */

export interface EngineOptions {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  /** Hero root; its client size is the world size. */
  root: HTMLElement;
  scene: HeroScene;
  anchors: LureAnchors;
  palette: BrandPalette;
}

export interface UnderwaterEngine {
  /** Re-measure the hero and rebuild size-dependent buffers. */
  resize(): void;
  /** The lure's DOM was replaced (a photo cut-out was rejected for the vector lure): follow the new anchors. */
  setAnchors(anchors: LureAnchors): void;
  setVisible(visible: boolean): void;
  setReducedMotion(reduced: boolean): void;
  destroy(): void;
}

const unionRect = (a: Rect | null, b: Rect | null): Rect | null =>
  a && b
    ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }
    : (a ?? b);

/** The lure length (px) the bubbles, ripples and shoves were drawn for; their size follows the real lure from here. */
const FX_LURE = 296;

/** Where the waves sit in the nav logo, as a fraction of its height (the wordmark is below): the lure and the hover bubbles start there. */
const LOGO_MARK_Y = 0.32;

const SEED = 20260524;
const WARM_FRAMES = 150;
/**
 * Out-of-focus foreground fish are drawn at this fraction of the size, averaged
 * down once more, then upscaled: two cheap resamples give a smooth blur without
 * `ctx.filter` (which some browsers lack) and without a full-screen resample.
 */
const SOFT_SCALE = 0.3;
const SOFT_BLUR_SCALE = SOFT_SCALE / 2;
const MAX_STEP = 0.04;

/** Depth to parallax strength. Far layers barely move; near layers rush past. */
const parallax = (depth: number): number => 0.25 + 1.25 * depth;

export function createUnderwaterEngine(options: EngineOptions): UnderwaterEngine {
  const { back, front, root, scene, palette } = options;
  let anchors = options.anchors;
  const backCtx = back.getContext("2d");
  const frontCtx = front.getContext("2d");
  if (!backCtx || !frontCtx) {
    return { resize() {}, setAnchors() {}, setVisible() {}, setReducedMotion() {}, destroy() {} };
  }

  const copyElement = root.querySelector<HTMLElement>(".hero-copy");
  const statementHeading = root.querySelector<HTMLElement>(".hero-statement");
  const statementSub = root.querySelector<HTMLElement>(".hero-statement__sub");
  const navElement = root.querySelector<HTMLElement>(".hero-nav");
  const logoElement = root.querySelector<HTMLElement>(".hero-nav__logo");

  let width = 0;
  let height = 0;
  let dpr = 1;
  let degrade = 0;
  let quality: QualityProfile = getQuality(1280, 800);

  const world: World = {
    width: 0,
    height: 0,
    unit: 320,
    focusX: 0,
    focusY: 0,
    lureLength: 500,
    tieX: 0,
    tieY: 0,
    hookX: 0,
    hookY: 0,
    stacked: false,
    copy: null,
    statement: null,
    nav: null,
    logo: null,
  };
  const lure: LureFrame = {
    tieX: 0,
    tieY: 0,
    hookX: 0,
    hookY: 0,
    tailX: 0,
    tailY: 0,
    centerX: 0,
    centerY: 0,
    length: 500,
    scale: 1,
    angle: 0,
  };
  let lureValid = false;

  let pop: Population | null = null;
  let particles: ParticleField | null = null;
  let activeParticles = 0;
  let seabed: SeabedLayer[] = [];
  const bubbles = createBubblePool(120, SEED + 7);
  const rig = createLureRig(SEED + 13);
  const current = createCurrent();
  const simRng = createRng(SEED + 3);

  // out-of-focus buffer for the big foreground fish
  const soft = document.createElement("canvas");
  const softCtx = soft.getContext("2d");
  const softBlur = document.createElement("canvas");
  const softBlurCtx = softBlur.getContext("2d");

  let renderer: FishRenderer = createProceduralFishRenderer(palette, quality.segments);
  let proceduralRenderer = renderer;
  let rendererSegments = quality.segments;
  const view: FishView = { x: 0, y: 0, length: 0, alpha: 1 };
  const proj = { x: 0, y: 0, s: 1 };
  const simContext: SimContext = {
    dt: 0,
    time: 0,
    world,
    scene,
    current,
    reel: 0,
    lure,
    lureValid: false,
    rng: simRng,
  };

  let time = 0;
  let last = 0;
  let raf = 0;
  let visible = true;
  let reduced = false;
  let destroyed = false;
  let frames = 0;
  let frameMsTotal = 0;

  let seenHooks = 0;
  let seenReleases = 0;
  let lastFightBubble = 0;
  /** Short jolt of the whole scene when a fish takes the hook: 1 at the bite, easing out. */
  let jolt = 0;
  let introBegun = false;
  /** The splash as the lure enters the water has happened (once per arrival). */
  let splashed = false;
  /** How far the hooked fish has been drawn up out of the water (eased), and whether it has left the frame. */
  let reelShown = 0;
  let reelLeft = false;
  /** Distance along the line from the lure's place to out of the frame, and the line's direction (set when measuring). */
  let reelOut = 0;
  let reelDirX = 1;
  let reelDirY = 0;
  /**
   * Where the lure wants to drift to (px from its place, in its own space) to sit just ahead of the hero fish's
   * nose: followed while the fish patrols, held from the moment it notices the lure.
   */
  let trackOffX = 0;
  let trackOffY = 0;
  /** Time since the last bubble was left behind by the lure as it dives in, and by a fish being drawn up. */
  let diveClock = 0;
  let reelClock = 0;
  // a few frames of the hero fish's recent poses, for the strike's motion blur
  const trail = [
    { x: 0, y: 0, pitch: 0 },
    { x: 0, y: 0, pitch: 0 },
    { x: 0, y: 0, pitch: 0 },
  ];

  const backList: Fish[] = [];
  const frontList: Fish[] = [];
  const softList: Fish[] = [];

  // optional sprite assets
  if (FISH_SPRITE_SOURCES.length > 0) {
    void loadFishSprites(FISH_SPRITE_SOURCES).then((sprites) => {
      if (destroyed || sprites.length === 0) return;
      renderer = createSpriteFishRenderer(sprites, proceduralRenderer);
    });
  }

  // caustic light: one seamless tile, built in slices off the critical path, then faded in by CSS
  // (set on the document, so the story section below the hero can lay the same light over its water)
  const page = document.documentElement;
  void createCausticTile(320, palette.rgb("white"), () => destroyed).then((tile) => {
    if (!tile || destroyed) return;
    page.style.setProperty("--caustic-tile", `url("${tile}")`);
    page.setAttribute("data-caustic", "");
  });

  const measureWorld = () => {
    const rootRect = root.getBoundingClientRect();
    const slot = anchors.slot.getBoundingClientRect();
    world.width = width;
    world.height = height;
    world.focusX = slot.left - rootRect.left + slot.width / 2;
    world.focusY = slot.top - rootRect.top + slot.height / 2;
    const artWidth = anchors.art.offsetWidth;
    const artHeight = anchors.art.offsetHeight;
    world.lureLength = Math.max(90, artWidth * LURE_LENGTH_RATIO);
    // where the line is tied when the lure is at rest: the art box is centred on the slot
    world.tieX = world.focusX + (LURE_ANCHORS.tie.x - 0.5) * artWidth;
    world.tieY = world.focusY + (LURE_ANCHORS.tie.y - 0.5) * artHeight;
    world.hookX = world.focusX + (LURE_ANCHORS.hook.x - 0.5) * artWidth;
    world.hookY = world.focusY + (LURE_ANCHORS.hook.y - 0.5) * artHeight;
    world.stacked = quality.stacked;
    // the hero fish is longer than the lure; every other fish scales from it
    // (no upper limit: a cap would let the lure outgrow the fish on a very large screen)
    world.unit = Math.max(
      150,
      world.lureLength * (world.stacked ? FISH_TO_LURE.stacked : FISH_TO_LURE.split),
    );

    const rectOf = (el: HTMLElement | null, pad: number) => {
      const r = el?.getBoundingClientRect();
      return r
        ? {
            x0: r.left - rootRect.left - pad,
            y0: r.top - rootRect.top - pad,
            x1: r.right - rootRect.left + pad,
            y1: r.bottom - rootRect.top + pad,
          }
        : null;
    };
    world.copy = rectOf(copyElement, 24);
    world.statement = unionRect(rectOf(statementHeading, 24), rectOf(statementSub, 24));
    world.nav = rectOf(navElement, 12);
    // how far along the line the lure (and the fish hanging from it) must go to be clear of the frame
    const angle = world.stacked ? LINE_ANGLE_STACKED : LINE_ANGLE;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const margin = 1.7 * world.unit + 1.2 * world.lureLength;
    const reachRight = dirX > 0 ? (width + margin - world.tieX) / dirX : Infinity;
    const reachTop = dirY < 0 ? (world.tieY + margin) / -dirY : Infinity;
    reelOut = Math.min(reachRight, reachTop) * 1.04;
    reelDirX = dirX;
    reelDirY = dirY;
    const logo = logoElement?.getBoundingClientRect();
    world.logo = logo ? { x: logo.left - rootRect.left + logo.width / 2, y: logo.top - rootRect.top + logo.height * LOGO_MARK_Y } : null;
  };

  const readLure = () => {
    const origin = back.getBoundingClientRect();
    const read = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2 - origin.left, r.top + r.height / 2 - origin.top] as const;
    };
    const tie = read(anchors.tie);
    const hook = read(anchors.hook);
    const tail = read(anchors.tail);
    lure.tieX = tie[0];
    lure.tieY = tie[1];
    lure.hookX = hook[0];
    lure.hookY = hook[1];
    lure.tailX = tail[0];
    lure.tailY = tail[1];
    lure.centerX = (tie[0] + tail[0]) / 2;
    lure.centerY = (tie[1] + tail[1]) / 2;
    lure.length = Math.hypot(tie[0] - tail[0], tie[1] - tail[1]);
    lure.scale = lure.length / world.lureLength;
    lure.angle = Math.atan2(tail[1] - tie[1], tie[0] - tail[0]);
    lureValid = lure.length > 8 && Number.isFinite(lure.length);
    simContext.lureValid = lureValid;
  };

  const applyCanvasSize = () => {
    dpr = Math.max(
      1,
      Math.min(window.devicePixelRatio || 1, quality.dprCap) * (degrade === 0 ? 1 : degrade === 1 ? 0.8 : 0.65),
    );
    for (const canvas of [back, front]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    soft.width = Math.max(2, Math.ceil(width * SOFT_SCALE));
    soft.height = Math.max(2, Math.ceil(height * SOFT_SCALE));
    softBlur.width = Math.max(2, Math.ceil(width * SOFT_BLUR_SCALE));
    softBlur.height = Math.max(2, Math.ceil(height * SOFT_BLUR_SCALE));
  };

  const rebuild = (fresh: boolean) => {
    const nextQuality = getQuality(width, height);
    const qualityChanged = nextQuality.tier !== quality.tier || nextQuality.stacked !== quality.stacked;
    quality = nextQuality;

    if (rendererSegments !== quality.segments) {
      rendererSegments = quality.segments;
      proceduralRenderer = createProceduralFishRenderer(palette, quality.segments);
      renderer = proceduralRenderer;
    }

    const previous = { width: world.width, height: world.height };
    applyCanvasSize();
    measureWorld();

    if (fresh || qualityChanged || !pop) {
      pop = createPopulation(quality, world, SEED);
      seenHooks = pop.brain.hooks;
      seenReleases = pop.brain.releases;
      particles = createParticleField(quality.particles, width, height, SEED + 11);
    } else {
      rescalePopulation(pop, previous, { width, height });
      if (particles && particles.count !== quality.particles) {
        particles = createParticleField(quality.particles, width, height, SEED + 11);
      }
    }
    activeParticles = Math.floor(quality.particles * (degrade === 0 ? 1 : 0.6));
    seabed = createSeabed(palette, width, height, quality.seabedLayers, quality.weed, SEED + 5);
  };

  // ————————————————— simulation —————————————————

  /** The swim in from the logo or surface: graceful dive arc into the water column. */
  const makeIntro = (): LureIntro | null => {
    const startX = world.logo ? world.logo.x : 0.12 * width;
    const startY = world.logo ? world.logo.y : 0.08 * height;
    const sx = startX - world.tieX;
    const sy = startY - world.tieY;
    const distance = Math.hypot(sx, sy);
    return {
      fromX: sx,
      fromY: sy,
      c1x: sx * 0.6,
      c1y: sy * 0.5,
      c2x: sx * 0.25,
      c2y: 0,
      delay: 0.1,
      duration: clamp(2.2 + distance / 1000, 2.4, 3.2),
    };
  };

  const beginIntro = () => {
    if (introBegun) return;
    introBegun = true;
    const intro = scene.reduced ? null : makeIntro();
    startIntro(rig, intro);
    splashed = !intro;
    root.setAttribute("data-lure", "");
  };

  const step = (dt: number) => {
    if (!pop) return;
    time += dt;
    const brain = pop.brain;
    const hooked = brain.mode === "hooked";

    // the water, and how the fight has worn on the fish: on the fish's own clock, never the scroll's,
    // so a fast scroll cannot skip the fight or cut it short
    stepCurrent(current, time, scene.flow);
    scene.calm = hooked ? smoothstep(7, 26, brain.hookedTime) : damp(scene.calm, 0, 2, dt);
    scene.statement = damp(scene.statement, hooked ? 1 : 0, hooked ? 3 : 6, dt);
    jolt = damp(jolt, 0, 4.5, dt);

    // Scroll asks for the hooked fish to be drawn up out of the water; it only is once the fish has
    // fought for a moment (so a fast scroll still shows the bite and the fight first), and it eases
    // toward the asked-for place rather than jumping there.
    const reelGate = hooked ? smoothstep(1.2, 2.8, brain.hookedTime) : 0;
    const reelTarget = scene.reel * reelGate;
    reelShown = damp(reelShown, reelTarget, reelTarget > reelShown ? 2.6 : 3.4, dt);
    simContext.reel = reelShown;

    // The lure tracks the fish. From the first scroll it drifts down the current toward the hero fish, to just
    // ahead of its nose, following it while it patrols; once the fish has noticed it, the lure holds its place
    // and the fish works around it. (The fish keeps to its own water until then: see PrimaryBrain.frame.)
    if (rig.introDone && pop.primary.placed && lure.scale > 0) {
      if (brain.mode === "patrol") {
        const prim = pop.primary;
        const k = lure.scale;
        const restX = world.focusX + (world.tieX - world.focusX) * k;
        const restY = world.focusY + (world.tieY - world.focusY) * k;
        const ahead = prim.facing * 1.15 * lure.length;
        const goalX = clamp((prim.x + ahead - restX) / k, -2.2 * world.lureLength, 0.15 * world.lureLength);
        const goalY = clamp((prim.y - 0.05 * lure.length - restY) / k, -0.5 * world.lureLength, 1.0 * world.lureLength);
        trackOffX = damp(trackOffX, goalX, 1.5, dt);
        trackOffY = damp(trackOffY, goalY, 1.5, dt);
      }
      rig.trackGoalX = trackOffX * scene.lead;
      rig.trackGoalY = trackOffY * scene.lead;
    }
    // drifting off from its place changes how far the lure has to be drawn to be out of the frame
    const behind = Math.max(0, -(rig.trackX.x * reelDirX + rig.trackY.x * reelDirY));
    rig.reelX = reelDirX * (reelOut + behind);
    rig.reelY = reelDirY * (reelOut + behind);

    // 1. the lure's physics, written to the DOM (so the measurement below sees it)
    if (!scene.reduced) {
      stepLureRig(rig, {
        dt,
        time,
        current,
        flow: scene.flow,
        hooked,
        pull: brain.pull,
        shake: brain.shake,
        calm: scene.calm,
        reel: reelShown,
        length: world.lureLength,
      });
      applyLureRig(
        anchors.rig,
        readRigPose(rig, {
          time,
          flow: scene.flow,
          length: world.lureLength,
          shake: brain.shake,
          reel: reelShown,
          // as the fish draws the whole lure into its mouth the lure fades out (opacity only, never size)
          gulp: brain.gulp,
        }),
      );
    }

    // the lure goes into the water: a small splash where it comes out of the logo
    if (!splashed && rig.introClock >= 0.05 && world.logo) {
      splashed = true;
      const fx = world.lureLength / FX_LURE;
      emitSplash(bubbles, world.logo.x, world.logo.y, 0.9 * Math.max(0.6, fx));
      emitBubbles(bubbles, world.logo.x, world.logo.y, 6, 9 * fx, 34 * fx, 2.2);
    }

    // 2. where the lure is right now
    readLure();

    // the dive in leaves a trail of bubbles behind the lure: more of them while it is moving fast
    if (!rig.introDone && rig.introClock > 0.1 && lureValid) {
      const fx = world.lureLength / FX_LURE;
      const u = rig.introU;
      const rate = 6 + 16 * (4 * u * (1 - u));
      diveClock += dt;
      while (diveClock > 1 / rate) {
        diveClock -= 1 / rate;
        emitBubbles(bubbles, lure.tailX, lure.tailY, 1, 5 * fx * lure.scale, 20 * fx, 1.9 * fx * Math.max(0.5, lure.scale));
      }
    }

    // 3. the fish, against that (the hero fish waits until the lure has arrived)
    simContext.dt = dt;
    simContext.time = time;
    stepPopulation(pop, simContext, brain.scatter);
    if (lureValid && rig.introDone) updatePrimary(brain, pop.primary, simContext);

    // 4. what the fish did to the lure
    if (lureValid) {
      const reach = lure.scale * (world.lureLength / FX_LURE);
      if (brain.hooks !== seenHooks) {
        seenHooks = brain.hooks;
        // the bite: the lure is yanked, the water around the hook is shoved aside, the scene jolts,
        // and the brand statement arrives
        kickRig(rig, -0.32);
        bumpRig(rig, -0.14, 0.12);
        jolt = 1;
        emitRipple(bubbles, lure.hookX, lure.hookY);
        emitBubbles(bubbles, lure.hookX, lure.hookY, 14, 22 * reach, 80 * reach, 3.4);
        if (particles) shoveParticles(particles, lure.hookX, lure.hookY, 300 * reach, 120);
        root.setAttribute("data-caught", "");
      }
      if (brain.releases !== seenReleases) {
        seenReleases = brain.releases;
        kickRig(rig, 0.28);
        bumpRig(rig, 0.1, -0.06);
        emitBubbles(bubbles, lure.hookX, lure.hookY, 6, 14 * reach, 70 * reach, 2.8);
        if (particles) shoveParticles(particles, lure.hookX, lure.hookY, 220 * reach, 70);
        root.removeAttribute("data-caught");
      }
      if (rig.twitched) {
        // the angler's twitch shakes a few bubbles from the lure's lip
        emitBubbles(bubbles, lure.tieX + 0.03 * lure.length, lure.tieY + 0.1 * lure.length, 3, 5 * reach, 45 * reach, 2.2);
      }
      if (hooked && reelShown < 0.04 && time - lastFightBubble > 0.22 + 0.6 * scene.calm) {
        lastFightBubble = time;
        emitBubbles(bubbles, pop.primary.x, pop.primary.y, 1, 8 * reach, 60 * reach, 2.4);
      }

      // being drawn up out of the water: a stream of bubbles streaks off the fish as it is hauled away
      if (reelShown > 0.04 && reelShown < 0.99) {
        reelClock += dt;
        while (reelClock > 0.055) {
          reelClock -= 0.055;
          emitBubbles(bubbles, pop.primary.x, pop.primary.y, 2, 14 * reach, 46 * reach, 2.5 * Math.sqrt(reach));
        }
      }
      // ...and as it leaves the frame, the surface breaks: a burst of bubbles where the line goes out, and a splash
      if (!reelLeft && reelShown > 0.75) {
        reelLeft = true;
        const angle = world.stacked ? LINE_ANGLE_STACKED : LINE_ANGLE;
        const toEdge = Math.min(
          Math.cos(angle) > 0 ? (width - world.tieX) / Math.cos(angle) : Infinity,
          Math.sin(angle) < 0 ? world.tieY / -Math.sin(angle) : Infinity,
        );
        const edgeX = clamp(world.tieX + Math.cos(angle) * toEdge, 0, width);
        const edgeY = clamp(world.tieY + Math.sin(angle) * toEdge, 0, height);
        emitBubbles(bubbles, edgeX, edgeY, 10, 22 * reach, 70 * reach, 2.8);
      } else if (reelLeft && reelShown < 0.55) {
        reelLeft = false;
      }
    }
    updateBubbles(bubbles, dt, current.x * 9);
    if (particles) updateParticles(particles, dt, time, current, width, height);
  };

  // ————————————————— drawing —————————————————

  const project = (wx: number, wy: number, depth: number) => {
    const k = parallax(depth);
    const z = 1 + (scene.zoom - 1) * k;
    // slow handheld drift: the whole scene breathes a few pixels, deeper layers more
    const swayX = (Math.sin(time * 0.09) * 5 + Math.sin(time * 0.23 + 1) * 2.5) * k;
    const swayY = (Math.cos(time * 0.07) * 3 + Math.sin(time * 0.19 + 2) * 1.8) * k;
    // the bite jolts the whole scene for a moment, deeper layers more
    const shakeX = jolt > 0.01 ? Math.sin(time * 52) * 3.2 * jolt * k : 0;
    const shakeY = jolt > 0.01 ? Math.sin(time * 61 + 1.3) * 2.4 * jolt * k : 0;
    proj.x = world.focusX + (wx - world.focusX) * z + swayX + shakeX;
    proj.y = world.focusY + (wy - world.focusY) * z - scene.descend * height * 0.09 * k + swayY + shakeY;
    proj.s = z;
  };

  /** 1 inside the rectangle, easing to 0 a little way outside it. */
  const nearRect = (r: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number, length: number) => {
    const dx = Math.max(r.x0 - x, 0, x - r.x1);
    const dy = Math.max(r.y0 - y, 0, y - r.y1);
    return 1 - smoothstep(0, 140 + 0.3 * length, Math.hypot(dx, dy));
  };

  /**
   * Fish ease off under the headline while it is up, under the brand statement
   * once the catch has brought it in, and under the nav, so dark shapes never
   * cross text.
   */
  const textFade = (x: number, y: number, length: number, statement = true): number => {
    let fade = 1;
    if (world.copy && scene.copy > 0.02) fade -= 0.88 * scene.copy * nearRect(world.copy, x, y, length);
    if (statement && world.statement && scene.statement > 0.02) {
      fade -= 0.85 * scene.statement * nearRect(world.statement, x, y, length);
    }
    if (world.nav) fade *= 1 - 0.6 * nearRect(world.nav, x, y, length * 0.4);
    return Math.max(0, fade);
  };

  /**
   * The hero fish is long, so it is checked at its head, middle and tail against
   * the headline (never against the statement: the caught fish stays clear). It
   * dims while it passes under the text and never quite disappears.
   */
  const primaryFade = (fish: Fish, length: number): number => {
    if (!world.copy || scene.copy <= 0.02) return 1;
    let fade = 1;
    for (const along of [0.1, 0.5, 0.9]) {
      fade = Math.min(fade, textFade(fish.x - fish.facing * length * along, fish.y, length * 0.4, false));
    }
    return Math.max(0.3, fade);
  };

  /** Draw one fish; returns its on-screen length, or 0 when it was off screen or faded out. */
  const drawFish = (ctx: CanvasRenderingContext2D, fish: Fish): number => {
    project(fish.x, fish.y, fish.depth);
    const length = fish.scale * world.unit * fish.persp * proj.s;
    const margin = length * 1.5;
    if (proj.x < -margin || proj.x > width + margin || proj.y < -margin || proj.y > height + margin) return 0;

    // measured to the middle of the body, not the nose
    const bodyX = proj.x - fish.facing * length * 0.45;
    let alpha = textFade(bodyX, proj.y, length);
    if (fish.tier === "near") {
      // foreground fish dissolve as the camera pushes through them...
      alpha *= 1 - smoothstep(2.3, 3.3, proj.s);
      // ...and never sit over the lure: fade as the body nears it
      if (lureValid) {
        const reach = (lure.length + length) * 0.5;
        alpha *= smoothstep(0.8, 1.25, Math.hypot(bodyX - lure.centerX, proj.y - lure.centerY) / reach);
      }
    }
    if (alpha <= 0.004) return 0;
    view.x = proj.x;
    view.y = proj.y;
    view.length = length;
    view.alpha = alpha;
    renderer.draw(ctx, fish, view);
    return length;
  };

  const drawPrimary = (ctx: CanvasRenderingContext2D, fish: Fish, blur: boolean) => {
    view.length = fish.scale * world.unit * lure.scale * fish.persp;
    if (blur) {
      // motion blur on the strike: a few ghosts along the path it just took
      for (let i = trail.length - 1; i >= 0; i--) {
        view.x = trail[i].x;
        view.y = trail[i].y;
        view.alpha = 0.2 / (i + 1);
        renderer.draw(ctx, fish, view);
      }
    }
    view.x = fish.x;
    view.y = fish.y;
    view.alpha = primaryFade(fish, view.length);
    renderer.draw(ctx, fish, view);
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, nearLayer: boolean) => {
    if (!particles) return;
    const { x, y, z, radius, twinkle, phase } = particles;
    const calmFade = 1 - 0.25 * scene.calm;
    for (let i = 0; i < activeParticles && i < particles.count; i++) {
      const isNear = z[i] >= 0.62;
      if (isNear !== nearLayer) continue;
      project(x[i], y[i], z[i]);
      if (proj.x < -40 || proj.x > width + 40 || proj.y < -40 || proj.y > height + 40) continue;
      const flicker = 0.65 + 0.35 * Math.sin(time * twinkle[i] * 2.2 + phase[i]);
      const r = radius[i] * (0.8 + 0.2 * proj.s);
      if (isNear && radius[i] > 2.3) {
        // a large near mote: a soft out-of-focus disc of light
        const g = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, r * 5);
        g.addColorStop(0, palette.alpha("white", 0.34 * flicker * calmFade));
        g.addColorStop(1, palette.alpha("white", 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, r * 5, 0, TAU);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = palette.alpha("secondary", (0.06 + 0.2 * z[i]) * flicker * calmFade);
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, r, 0, TAU);
      ctx.fill();
    }
  };

  const drawSeabed = (ctx: CanvasRenderingContext2D) => {
    for (const layer of seabed) {
      const k = parallax(layer.depth);
      const z = 1 + (scene.zoom - 1) * k;
      const w = width * 1.5; // layers are built 1.5x the viewport wide (seabed.ts)
      const x0 = -(w - width) / 2;
      const y0 = height - layer.height + layer.foot;
      const sway = Math.sin(time * 0.08 + layer.depth * 4) * 5 * k;
      const dx = world.focusX + (x0 - world.focusX) * z + sway;
      const dy = world.focusY + (y0 - world.focusY) * z - scene.descend * height * 0.09 * k;
      ctx.drawImage(layer.canvas, dx, dy, w * z, layer.height * z);
      drawWeed(ctx, layer, dx, dy, z, current);
    }
  };

  const drawLureGlow = (ctx: CanvasRenderingContext2D) => {
    const pulse = Math.sin(time * 0.9) * 0.01;
    const strength = (0.05 + 0.06 * scene.engage * (1 - scene.calm) + pulse) * smoothstep(0, 0.4, rig.introU);
    const radius = lure.length * 0.78;
    const g = ctx.createRadialGradient(lure.centerX, lure.centerY, 0, lure.centerX, lure.centerY, radius);
    g.addColorStop(0, palette.alpha("accentSecondary", strength));
    g.addColorStop(1, palette.alpha("accentSecondary", 0));
    ctx.fillStyle = g;
    ctx.fillRect(lure.centerX - radius, lure.centerY - radius, radius * 2, radius * 2);
  };

  // the thread, sampled densely near the lure (where it is on screen) and sparsely toward the rod
  const LINE_POINTS = 30;
  const lineX = new Float32Array(LINE_POINTS + 1);
  const lineY = new Float32Array(LINE_POINTS + 1);

  /**
   * The line from the lure's nose to the rod tip, which is far off the top right
   * of the frame and does not move. In between it is a flexible thread in the
   * water: it bows downstream with the current's gusts, a travelling ripple runs
   * along it, it sags a little when slack, and it goes straight and trembles when a
   * fish is hooked. Its near end follows the lure wherever the lure floats, so
   * line and lure always move as one rig.
   */
  const drawLine = (ctx: CanvasRenderingContext2D) => {
    const brain = pop!.brain;
    const visibility = Math.max(0.7, smoothstep(0, 0.4, rig.introU));

    const reach = Math.hypot(width, height) * 1.35;
    const angle = world.stacked ? LINE_ANGLE_STACKED : LINE_ANGLE;
    const endX = world.tieX + Math.cos(angle) * reach;
    const endY = world.tieY + Math.sin(angle) * reach;
    const dx = endX - lure.tieX;
    const dy = endY - lure.tieY;
    const length = Math.hypot(dx, dy);
    // unit normal pointing up and to the left: downstream, and away from the sag
    const nx = dy / length;
    const ny = -dx / length;

    const tension = brain.mode === "hooked" ? 0.95 : brain.mode === "strike" ? 0.75 : 0.3 + 0.25 * scene.engage;
    const slack = 1 - tension;
    const bow = (0.025 + 0.035 * current.gust) * (1 - 0.8 * tension) * length;
    const sag = 0.015 * slack * length;
    const ripple = 0.012 * (0.4 + 0.6 * current.gust) * (1 - 0.8 * tension) * length;

    for (let i = 0; i <= LINE_POINTS; i++) {
      const t = i / LINE_POINTS;
      const s = Math.pow(t, 1.6);
      const taper = Math.sin(Math.PI * Math.pow(s, 0.8));
      const env = Math.pow(Math.sin(Math.PI * s), 1.2);
      const wave =
        Math.sin(TAU * 1.4 * s - current.swell * 1.8) + 0.55 * Math.sin(TAU * 3.1 * s - current.swell * 3.1 + 1.3);
      const tremble = brain.shake * (Math.sin(time * 48 + s * 9) * 2.8 + Math.sin(time * 72 + s * 5) * 1.2);
      const offset = taper * (bow - sag) + env * (ripple * wave + tremble);
      lineX[i] = lure.tieX + dx * s + nx * offset;
      lineY[i] = lure.tieY + dy * s + ny * offset;
    }

    const trace = (ox: number, oy: number) => {
      ctx.beginPath();
      ctx.moveTo(lineX[0] + ox, lineY[0] + oy);
      for (let i = 1; i < LINE_POINTS; i++) {
        ctx.quadraticCurveTo(
          lineX[i] + ox,
          lineY[i] + oy,
          (lineX[i] + lineX[i + 1]) / 2 + ox,
          (lineY[i] + lineY[i + 1]) / 2 + oy,
        );
      }
      ctx.lineTo(lineX[LINE_POINTS] + ox, lineY[LINE_POINTS] + oy);
    };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // 1. Water refraction glow halo
    trace(0, 0);
    ctx.strokeStyle = palette.alpha("accentSecondary", 0.45 * visibility);
    ctx.lineWidth = Math.max(3.2, 4.0 * Math.sqrt(lure.scale));
    ctx.stroke();

    // 2. High-contrast dark braided / monofilament line core
    trace(0, 0);
    ctx.strokeStyle = palette.alpha("dark", 0.95 * visibility);
    ctx.lineWidth = Math.max(1.8, 2.2 * Math.sqrt(lure.scale));
    ctx.stroke();

    // 3. Specular line glint highlight
    trace(-0.8, -0.8);
    ctx.strokeStyle = palette.alpha("white", 0.85 * visibility);
    ctx.lineWidth = 1.0;
    ctx.stroke();
  };

  const draw = () => {
    if (!pop) return;
    backCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    frontCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backCtx.clearRect(0, 0, width, height);
    frontCtx.clearRect(0, 0, width, height);

    // which side of the lure's plane is each fish on?
    backList.length = 0;
    frontList.length = 0;
    softList.length = 0;
    for (const fish of pop.fish) {
      if (fish.kind === "primary") continue;
      if (fish.tier === "near") (quality.soft ? softList : frontList).push(fish);
      else if (fish.depth >= Z_LURE) frontList.push(fish);
      else backList.push(fish);
    }
    const byDepth = (a: Fish, b: Fish) => a.depth - b.depth;
    backList.sort(byDepth);
    frontList.sort(byDepth);

    const primary = pop.primary;
    const primaryFront = primary.depth >= Z_LURE;
    const primaryReady = lureValid && primary.placed;
    const striking = pop.brain.mode === "strike";

    drawSeabed(backCtx);
    for (const fish of backList) drawFish(backCtx, fish);
    drawParticles(backCtx, false);
    if (lureValid) {
      drawLureGlow(backCtx);
    }
    if (primaryReady && !primaryFront) drawPrimary(backCtx, primary, false);

    for (const fish of frontList) drawFish(frontCtx, fish);
    if (lureValid) {
      drawLine(frontCtx);
    }
    if (primaryReady && primaryFront) drawPrimary(frontCtx, primary, striking);

    if (softList.length > 0 && softCtx) {
      softCtx.setTransform(1, 0, 0, 1, 0, 0);
      softCtx.clearRect(0, 0, soft.width, soft.height);
      softCtx.setTransform(SOFT_SCALE, 0, 0, SOFT_SCALE, 0, 0);
      softList.sort(byDepth);
      // upscale only the part of the buffer that was drawn into: a full-screen resample every frame is costly
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const fish of softList) {
        const length = drawFish(softCtx, fish);
        if (length === 0) continue;
        x0 = Math.min(x0, proj.x - length * 1.4);
        y0 = Math.min(y0, proj.y - length * 0.8);
        x1 = Math.max(x1, proj.x + length * 1.4);
        y1 = Math.max(y1, proj.y + length * 0.8);
      }
      x0 = Math.max(0, Math.floor(x0));
      y0 = Math.max(0, Math.floor(y0));
      x1 = Math.min(width, Math.ceil(x1));
      y1 = Math.min(height, Math.ceil(y1));
      if (x1 > x0 && y1 > y0 && softBlurCtx) {
        // average the drawn region down once more, then upscale that onto the front canvas
        const bx = Math.max(0, Math.floor(x0 * SOFT_BLUR_SCALE) - 1);
        const by = Math.max(0, Math.floor(y0 * SOFT_BLUR_SCALE) - 1);
        const bw = Math.min(softBlur.width - bx, Math.ceil((x1 - x0) * SOFT_BLUR_SCALE) + 3);
        const bh = Math.min(softBlur.height - by, Math.ceil((y1 - y0) * SOFT_BLUR_SCALE) + 3);
        softBlurCtx.setTransform(1, 0, 0, 1, 0, 0);
        softBlurCtx.clearRect(bx, by, bw, bh);
        softBlurCtx.imageSmoothingEnabled = true;
        softBlurCtx.imageSmoothingQuality = "low";
        softBlurCtx.drawImage(soft, bx * 2, by * 2, bw * 2, bh * 2, bx, by, bw, bh);

        frontCtx.imageSmoothingEnabled = true;
        frontCtx.imageSmoothingQuality = "low";
        frontCtx.drawImage(
          softBlur,
          bx,
          by,
          bw,
          bh,
          bx / SOFT_BLUR_SCALE,
          by / SOFT_BLUR_SCALE,
          bw / SOFT_BLUR_SCALE,
          bh / SOFT_BLUR_SCALE,
        );
      }
    }

    if (lureValid) drawBubbles(frontCtx, bubbles, palette, lure.scale * (world.lureLength / FX_LURE));
    drawParticles(frontCtx, true);

    // remember where the hero fish was for next frame's blur
    trail[2].x = trail[1].x;
    trail[2].y = trail[1].y;
    trail[2].pitch = trail[1].pitch;
    trail[1].x = trail[0].x;
    trail[1].y = trail[0].y;
    trail[1].pitch = trail[0].pitch;
    trail[0].x = primary.x;
    trail[0].y = primary.y;
    trail[0].pitch = primary.pitch;
  };

  // ————————————————— loop —————————————————

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const elapsed = now - last;
    last = now;
    // the next section is fully over the hero: nothing here can be seen, so do no work
    if (scene.covered) return;
    step(Math.min(MAX_STEP, elapsed / 1000));
    draw();

    // one-way adaptive degrade if the device can't hold frame rate
    frames++;
    if (frames > 60) frameMsTotal += elapsed;
    if (frames === 150) {
      const average = frameMsTotal / 90;
      frames = 0;
      frameMsTotal = 0;
      if (average > 24 && degrade < 2) {
        degrade++;
        applyCanvasSize();
        activeParticles = Math.floor(quality.particles * 0.6);
        // the heaviest compositing goes first (see `[data-lite]` in underwater.css)
        root.setAttribute("data-lite", "");
      }
    }
  };

  const startLoop = () => {
    if (raf || destroyed || reduced || !visible) return;
    // the lure appears (swimming out of the logo) when the scene starts running
    beginIntro();
    last = performance.now();
    frames = 0;
    frameMsTotal = 0;
    raf = requestAnimationFrame(frame);
  };

  const stopLoop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const renderStill = () => {
    if (!width || !height) return;
    // a still frame has no swim in: the lure is simply where it floats
    introBegun = true;
    finishIntro(rig);
    root.setAttribute("data-lure", "");
    resetLureRig(anchors.rig);
    for (let i = 0; i < WARM_FRAMES; i++) step(1 / 30);
    draw();
  };

  const onVisibility = () => {
    if (document.hidden) stopLoop();
    else startLoop();
  };
  document.addEventListener("visibilitychange", onVisibility);

  // Hovering (or focusing) the logo sends a stream of bubbles out of it and across the screen.
  let lastStream = -10;
  const sendStream = () => {
    if (destroyed || scene.reduced || scene.covered || !visible || document.hidden || !logoElement) return;
    if (time - lastStream < 1.6) return; // a stream at a time, however the pointer jitters
    lastStream = time;
    const logo = logoElement.getBoundingClientRect();
    const origin = back.getBoundingClientRect();
    const x = logo.left - origin.left + logo.width * 0.1;
    const y = logo.top - origin.top + logo.height * LOGO_MARK_Y;
    // aimed at the lure, so the stream crosses the screen to it (a gentle slope down when the lure is not yet in view)
    const aim = lure.tieX > 0 ? clamp(Math.atan2(lure.tieY - y, lure.tieX - x), -0.1, 0.9) : 0.15;
    // sized by the screen, not by the lure (which is small in the picture), so they read on pale water
    const size = 1 / Math.max(0.3, lure.scale * (world.lureLength / FX_LURE));
    emitStream(bubbles, x, y, logo.width * 0.8, 30, 1, Math.min(size, 2.4) * 1.1, aim);
  };
  logoElement?.addEventListener("pointerenter", sendStream);
  logoElement?.addEventListener("focusin", sendStream);

  return {
    resize() {
      const nextWidth = root.clientWidth;
      const nextHeight = root.clientHeight;
      if (!nextWidth || !nextHeight) return;
      const fresh = width === 0;
      width = nextWidth;
      height = nextHeight;
      rebuild(fresh);
      if (reduced) renderStill();
      else if (!raf) draw();
    },
    setAnchors(next) {
      anchors = next;
    },
    setVisible(next) {
      visible = next;
      if (visible) startLoop();
      else stopLoop();
    },
    setReducedMotion(next) {
      reduced = next;
      scene.reduced = next;
      if (reduced) {
        stopLoop();
        renderStill();
      } else {
        startLoop();
      }
    },
    destroy() {
      destroyed = true;
      stopLoop();
      document.removeEventListener("visibilitychange", onVisibility);
      logoElement?.removeEventListener("pointerenter", sendStream);
      logoElement?.removeEventListener("focusin", sendStream);
      resetLureRig(anchors.rig);
      page.style.removeProperty("--caustic-tile");
      page.removeAttribute("data-caustic");
      root.removeAttribute("data-lite");
      root.removeAttribute("data-lure");
      root.removeAttribute("data-caught");
      clearBubbles(bubbles);
      pop = null;
      seabed = [];
      particles = null;
    },
  };
}
