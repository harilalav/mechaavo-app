"use client";

import { useEffect } from "react";
import { whenIdle } from "@/lib/utils/idle";

/**
 * Starts the surfacing entrance (lib/animations/surfaceReveal.ts) for every `[data-surface-group]` on the
 * page: a leaf mounted once, like TideObserver, that renders nothing. The module loads when the browser is
 * idle. `html[data-surface-ready]` tells the CSS the script is alive (it cancels the 3 s failsafe that shows
 * everything if hydration never happens). Reduced motion: nothing is held back, so nothing runs.
 */
export function SurfaceReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const html = document.documentElement;
    html.setAttribute("data-surface-ready", "");

    let cancelled = false;
    let stop: (() => void) | undefined;
    const cancelIdle = whenIdle(() => {
      import("@/lib/animations/surfaceReveal").then(
        ({ startSurfaceReveal }) => {
          if (!cancelled) stop = startSurfaceReveal().stop;
        },
        // the module could not load: let every member up rather than leave rows of text held back
        () => document.querySelectorAll("[data-surface]").forEach((m) => m.setAttribute("data-up", "")),
      );
    });
    return () => {
      cancelled = true;
      cancelIdle();
      stop?.();
    };
  }, []);

  return null;
}
