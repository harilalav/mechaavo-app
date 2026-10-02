"use client";

import { useEffect, useRef } from "react";
import { HERO_ROOT_ATTR, queryLureAnchors } from "@/lib/animations/heroDom";
import { readBrandPalette } from "@/lib/theme/brand";
import type { UnderwaterEngine } from "@/lib/underwater/engine";
import { whenIdle } from "@/lib/utils/idle";
import type { HeroScene } from "@/lib/underwater/story";

/**
 * Mounts the underwater simulation as two stacked canvases — one behind the
 * lure, one in front — so the primary fish can take the hook in front of it
 * while the rest of the water stays behind.
 *
 * All animation state lives in the framework-free engine and the shared
 * `scene` object: this component renders once and never re-renders per frame.
 * It sizes itself from the hero (ResizeObserver), caps devicePixelRatio,
 * pauses while the hero is off-screen or the tab is hidden, holds a still
 * frame under prefers-reduced-motion, and tears everything down on unmount.
 */
export function UnderwaterCanvas({ scene }: { scene: HeroScene }) {
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const back = backRef.current;
    const front = frontRef.current;
    const root = back?.closest<HTMLElement>(`[${HERO_ROOT_ATTR}]`);
    if (!back || !front || !root) return;

    const anchors = queryLureAnchors(root);
    if (!anchors) {
      console.warn("[hero] lure anchors not found; underwater scene not started.");
      return;
    }

    let cancelled = false;
    let teardown: (() => void) | undefined;

    // The engine is not needed for first paint, so it loads on its own chunk,
    // once the browser is idle.
    const startEngine = () => {
      void import("@/lib/underwater/engine").then(({ createUnderwaterEngine }) => {
        if (cancelled) return;

        const engine: UnderwaterEngine = createUnderwaterEngine({
          back,
          front,
          root,
          scene,
          anchors,
          palette: readBrandPalette(),
        });

        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const onMotion = () => engine.setReducedMotion(motion.matches);

        const resizeObserver = new ResizeObserver(() => engine.resize());
        resizeObserver.observe(root);
        engine.resize();
        onMotion();
        motion.addEventListener("change", onMotion);

        // Rendering pauses entirely once the hero has scrolled out of view.
        const visibility = new IntersectionObserver(
          ([entry]) => engine.setVisible(entry.isIntersecting),
          { threshold: 0 },
        );
        visibility.observe(root);

        // If the lure's markup is swapped (a supplied photo turned out to be boxed, so the
        // vector lure replaces it), follow the new anchors.
        const art = root.querySelector('[data-hero-anchor="art"]');
        const markup = new MutationObserver(() => {
          const next = queryLureAnchors(root);
          if (next) engine.setAnchors(next);
        });
        if (art) markup.observe(art, { childList: true, subtree: true });

        teardown = () => {
          motion.removeEventListener("change", onMotion);
          resizeObserver.disconnect();
          visibility.disconnect();
          markup.disconnect();
          engine.destroy();
        };
      });
    };

    const cancelIdle = whenIdle(startEngine);

    return () => {
      cancelled = true;
      cancelIdle();
      teardown?.();
    };
  }, [scene]);

  return (
    <>
      <canvas
        ref={backRef}
        className="hero-canvas hero-canvas--back"
        data-hero="canvas"
        aria-hidden="true"
      />
      <canvas
        ref={frontRef}
        className="hero-canvas hero-canvas--front"
        data-hero="canvas"
        aria-hidden="true"
      />
    </>
  );
}
