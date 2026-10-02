"use client";

import { useEffect } from "react";

/**
 * Starts the heading motion (components/ui/Tide.tsx, src/styles/tide.css): marks
 * each `[data-tide]` heading `data-inview` the first time it scrolls into view,
 * once (headings marked `data-tide-manual` are left to whatever shows them).
 * Mounted once per page, a leaf with no markup of its own.
 *
 * `data-tide-ready` on <html> tells the stylesheet the observer is running, which
 * cancels its failsafe (the one that shows every heading after 3 s if hydration
 * never gets this far).
 */
export function TideObserver() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-tide-ready", "");

    const headings = Array.from(document.querySelectorAll<HTMLElement>("[data-tide]:not([data-inview]):not([data-tide-manual])"));
    if (!("IntersectionObserver" in window)) {
      headings.forEach((el) => el.setAttribute("data-inview", ""));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-inview", "");
          observer.unobserve(entry.target);
        }
      },
      // a little way into the screen, so the heading is seen arriving
      { rootMargin: "0px 0px -12% 0px", threshold: 0.2 },
    );
    headings.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      root.removeAttribute("data-tide-ready");
    };
  }, []);

  return null;
}
