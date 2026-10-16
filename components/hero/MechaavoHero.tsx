"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { LureAsset } from "@/lib/hero/lureAsset";
import { STACKED_QUERY } from "@/lib/underwater/quality";
import { whenIdle } from "@/lib/utils/idle";
import { createHeroScene } from "@/lib/underwater/story";
import { HeroCopy } from "./HeroCopy";
import { HeroCaptions } from "./HeroCaptions";
import { HeroNavigation } from "./HeroNavigation";
import { HeroProduct } from "./HeroProduct";
import { UnderwaterCanvas } from "./UnderwaterCanvas";

/**
 * Soft light shafts from the surface. Positions in % of the hero, lean in deg,
 * `a` = peak opacity in % (white shafts read against the azure mid-water;
 * the two accent shafts are fainter azure, the sea's own colour).
 */
const RAYS = [
  { x: 6, w: 16, r: -13, a: 38, accent: false },
  { x: 22, w: 9, r: -10, a: 26, accent: false },
  { x: 38, w: 22, r: -14, a: 20, accent: true },
  { x: 57, w: 12, r: -11, a: 30, accent: false },
  { x: 72, w: 18, r: -14, a: 40, accent: false },
  { x: 89, w: 11, r: -12, a: 16, accent: true },
] as const;

/**
 * Cinematic underwater hero. Orchestration only:
 *   - owns the shared scene state (a plain object, never React state),
 *   - composes the layers,
 *   - mounts the scrubbed story timeline via gsap.matchMedia so it is rebuilt
 *     when the layout switches (split ↔ stacked) and skipped for reduced motion.
 *
 * The hero sits in its track (.hero-track) and is `position: sticky` inside it
 * (with script and motion allowed), so it stays on screen while the story plays out
 * over the spacer's scroll distance, and then while the categories (passed in as
 * `children`) scroll up over it: the hero is their live backdrop, the plates rise
 * through its water (client review 2026-10-16: no sheet sliding over it any more).
 * No JavaScript pinning: the browser does the sticking.
 *
 * Two kinds of layer, one stacking context:
 *   full-bleed  the water: bg, rays, haze, canvases, vignette, caustic light
 *   .hero-stage the content: nav, copy, lure, captions, statement, held to the
 *               same max-width column as the rest of the page
 * The stage creates no stacking context of its own, so the z-order (see the
 * --z-* scale in src/styles/underwater.css) interleaves them: the lure sits
 * above the caustic light and below the copy, and the front canvas passes over
 * both. The stage comes first in the DOM so keyboard and screen-reader order
 * starts at the nav.
 */
export function MechaavoHero({ lureAsset, children }: { lureAsset: LureAsset | null; children?: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [scene] = useState(createHeroScene);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;

    // GSAP + ScrollTrigger are not needed to paint the hero (the text, nav and
    // lure arrive with CSS), so they load once the browser is idle instead of
    // competing with first paint and the web font swap.
    let cancelled = false;
    let teardown: (() => void) | undefined;

    const cancelIdle = whenIdle(() => {
      void (async () => {
        const [{ default: gsap }, { createHeroTimeline }] = await Promise.all([
          import("gsap"),
          import("@/lib/animations/heroTimeline"),
        ]);
        if (cancelled) return;

        const mm = gsap.matchMedia();
        mm.add(
          {
            motion: "(prefers-reduced-motion: no-preference)",
            stacked: STACKED_QUERY,
          },
          (context) => {
            const { motion, stacked } = context.conditions as {
              motion: boolean;
              stacked: boolean;
            };
            // Reduced motion: no pin, no scrub, no loops: a still scene.
            if (!motion) return;
            return createHeroTimeline({ root, track, scene, stacked });
          },
        );
        teardown = () => mm.revert();

        // GSAP has now applied the canvases' opening state inline (or we are in
        // reduced motion and want everything visible): release the canvas guard.
        root.setAttribute("data-ready", "");
      })();
    });

    return () => {
      cancelled = true;
      cancelIdle();
      teardown?.();
    };
  }, [scene]);

  return (
    <div ref={trackRef} className="hero-track">
      <section
        ref={rootRef}
        className="hero-root"
        data-hero-root=""
        aria-label="Mechaavo, engineered for every cast"
      >
        <div className="hero-stage">
          <HeroNavigation />
          <HeroCopy />
          <HeroProduct asset={lureAsset} />
          <HeroCaptions />
        </div>

        <div className="hero-bg" data-hero="bg" aria-hidden="true" />

        <div className="hero-rays" data-hero="rays" aria-hidden="true">
          {RAYS.map((ray, i) => (
            <div
              key={i}
              className={`hero-ray${ray.accent ? " hero-ray--accent" : ""}`}
              style={
                {
                  "--ray-x": `${ray.x}%`,
                  "--ray-w": `${ray.w}%`,
                  "--ray-r": `${ray.r}deg`,
                  "--ray-a": `${ray.a}%`,
                  // the order, so each shaft's shimmer runs on its own period and phase
                  "--ray-i": i,
                } as CSSProperties
              }
            >
              <div className="hero-ray__beam" data-hero="beam" />
            </div>
          ))}
        </div>
        <div className="hero-haze" data-hero="haze" aria-hidden="true" />

        <UnderwaterCanvas scene={scene} />
        <div className="hero-vignette" aria-hidden="true" />
        <div className="hero-caustics" aria-hidden="true">
          <div className="hero-caustics__layer hero-caustics__layer--a" />
          <div className="hero-caustics__layer hero-caustics__layer--b" />
        </div>
        {/* the deeper water the camera sinks into while the catalog rises (heroTimeline.ts writes its opacity) */}
        <div className="hero-depth" aria-hidden="true" />
      </section>
      {/* the story's scroll distance (underwater.css): only with script and motion allowed does it have a height */}
      <div className="hero-spacer" aria-hidden="true" />
      {children}
      {/* keeps the hero pinned to the catalog's end while #story comes up over it (underwater.css) */}
      <div className="hero-tail" aria-hidden="true" />
    </div>
  );
}
