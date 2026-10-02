"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { pickRendition, type VideoRendition } from "@/lib/config/media";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

type Connection = { saveData?: boolean };

export interface LoopingVideo {
  /** The element that stands for the footage on screen (it is watched, and carries data-ready / data-started). */
  panelRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** True once the panel is close, so the poster is only fetched when it will be seen soon. */
  posterWanted: boolean;
  /** Whether the loop plays: the system setting, unless the visitor chose otherwise. */
  enabled: boolean;
  toggle: () => void;
}

/**
 * A decorative water loop (muted, no controls of its own) that behaves like a good
 * citizen. Shared by the story panel and the categories card.
 *   - nothing downloads until the panel is within ~400px of the viewport, and then
 *     only the rendition the screen can use (lib/config/media.ts);
 *   - it plays only while on screen and while the tab is visible;
 *   - under prefers-reduced-motion it stays on its poster until the visitor presses play;
 *   - `enabled` / `toggle` drive a labelled pause / play button the caller renders.
 *
 * The panel gets `data-ready` once the controller is attached (a button that does
 * nothing without script can hide itself) and `data-started` when the first frame
 * is playing (the poster fades out on it).
 *
 * `widthOf` says how wide, in CSS pixels, the footage has to be sharp: the panel
 * itself for a panel of fixed size, the viewport for one that grows to fill it.
 * Pass module-level values for both: the controller is attached once per pair.
 *
 * React state changes on button presses and system-setting changes only, never per frame.
 */
export function useLoopingVideo(
  renditions: readonly VideoRendition[],
  widthOf: (panel: HTMLElement) => number,
): LoopingVideo {
  const panelRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // the poster is fetched only once the panel is close, so it never competes with first paint on a slow connection
  const [posterWanted, setPosterWanted] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  // null = follow the system setting; otherwise the visitor's own choice
  const [choice, setChoice] = useState<boolean | null>(null);
  const enabled = choice ?? !reducedMotion;

  const enabledRef = useRef(enabled);
  const syncRef = useRef<() => void>(() => {});

  // the controller below reads the latest setting through this ref
  useEffect(() => {
    enabledRef.current = enabled;
    syncRef.current();
  }, [enabled]);

  useEffect(() => {
    const panel = panelRef.current;
    const video = videoRef.current;
    if (!panel || !video) return;

    let near = false;
    let visible = false;

    const sync = () => {
      const load = near && enabledRef.current;
      if (load && !video.getAttribute("src")) {
        const connection = (navigator as Navigator & { connection?: Connection }).connection;
        const rendition = pickRendition(
          renditions,
          widthOf(panel),
          window.devicePixelRatio,
          Boolean(connection?.saveData),
        );
        video.src = rendition.src;
        video.load();
      }
      if (load && visible && !document.hidden) void video.play().catch(() => {});
      else if (!video.paused) video.pause();
    };
    syncRef.current = sync;

    const onPlaying = () => panel.setAttribute("data-started", "");
    video.addEventListener("playing", onPlaying);

    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        if (near) setPosterWanted(true);
        sync();
      },
      { rootMargin: "400px 0px" },
    );
    const visibleObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    nearObserver.observe(panel);
    visibleObserver.observe(panel);
    document.addEventListener("visibilitychange", sync);
    panel.setAttribute("data-ready", "");

    return () => {
      syncRef.current = () => {};
      video.removeEventListener("playing", onPlaying);
      nearObserver.disconnect();
      visibleObserver.disconnect();
      document.removeEventListener("visibilitychange", sync);
      video.pause();
    };
  }, [renditions, widthOf]);

  return { panelRef, videoRef, posterWanted, enabled, toggle: () => setChoice(!enabled) };
}
