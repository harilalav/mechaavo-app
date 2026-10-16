"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True once the element has come within `margin` of the viewport, and then stays true: a one-shot, so a heavy
 * asset below the fold (the category photos) is fetched when it will be seen soon and not at first paint,
 * where on a slow connection it competes with the font and the hero (the photos once added 0.4 s to the
 * mobile LCP). Without IntersectionObserver the answer is yes at once.
 */
export function useNearViewport(ref: RefObject<Element | null>, margin = "400px 0px"): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      // no way to ask: yes at once (from a microtask, not synchronously in the effect)
      void Promise.resolve().then(() => setNear(true));
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, margin]);

  return near;
}
