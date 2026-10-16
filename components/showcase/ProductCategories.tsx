"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tide } from "@/components/ui/Tide";
import { CategoryCard } from "@/components/showcase/CategoryCard";
import { CategoryInspector } from "@/components/showcase/CategoryInspector";
import { CATEGORIES, type CategoryData } from "@/lib/config/categories";
import { SECTION_IDS } from "@/lib/config/sections";
import { useNearViewport } from "@/lib/hooks/useNearViewport";
import type { CategoriesReveal } from "@/lib/animations/categoriesReveal";
import { whenIdle } from "@/lib/utils/idle";

/** Names the section. */
const TITLE_ID = "categories-title";

/**
 * Where the hero lands: the catalog rising through the hero's own water. It is rendered inside the
 * hero's track (app/page.tsx passes it to MechaavoHero), so the pinned hero stays behind it as a live
 * backdrop while it scrolls up (client review 2026-10-16: "something that happens underwater", no sheet
 * sliding over the hero); the hero's timeline finds it by its id.
 *
 * An ordinary section otherwise (src/styles/categories.css): transparent once the hero's timeline runs
 * (`.hero-track[data-backdrop]`), white before that and without script or with reduced motion; the heading
 * on a pool of light and the eight glass plates in the page column. Nothing pins in it and nothing opens:
 * the plates are there as soon as the section is, and each one surfaces as it comes into view (lib/animations/categoriesReveal.ts, loaded when the browser is idle). A plate is touched
 * with a pointer, a finger or the keyboard and lights up (categories-plate.css;
 * lib/animations/categoryPointer.ts moves the ring of light with a fine pointer);
 * pressed, it opens the inspector, the photo flying out of the plate into the dialog
 * (CategoryInspector.tsx). Without script, with reduced motion, or if those modules cannot load, the
 * plates are simply there and the dialog simply appears.
 *
 * The data is in lib/config/categories.ts, the photos in lib/config/media.ts.
 */
export function ProductCategories() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /** The inspector's category and the plate that opened it, so the photo can fly out of it and focus can go back to it. */
  const [open, setOpen] = useState<{ category: CategoryData; opener: HTMLElement } | null>(null);
  const closeInspector = useCallback(() => setOpen(null), []);
  // the plate photos are fetched once the section is close, not at first paint
  const near = useNearViewport(sectionRef);

  // the plates surface out of the water as they come into view (categoriesReveal.ts)
  useEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    if (!section || !grid) return;

    const show = () => section.setAttribute("data-shown", "");
    // reduced motion: no surfacing, the plates are simply there. Hydration that came after
    // the CSS failsafe let the plates up, with them on screen: leave them up, do not dip them again.
    const late = performance.now() > 2800 && grid.getBoundingClientRect().top < window.innerHeight;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || late) {
      show();
      return;
    }
    // from here the plates wait for their reveal (the CSS failsafe stands down)
    document.documentElement.setAttribute("data-cat-ready", "");

    let cancelled = false;
    let reveal: CategoriesReveal | undefined;
    let guardTimer = 0;

    // not needed for the first paint, and the grid is more than a screen below it
    const cancelIdle = whenIdle(() => {
      import("@/lib/animations/categoriesReveal").then(
        ({ startCategoriesReveal }) => {
          if (cancelled) return;
          window.clearTimeout(guardTimer);
          reveal = startCategoriesReveal({ section, grid });
        },
        show,
      );
    });

    // the grid reached the screen (a link straight to it) before the module did: do not keep it waiting
    const guard = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || reveal) return;
      guard.disconnect();
      guardTimer = window.setTimeout(() => {
        if (!reveal) show();
      }, 900);
    });
    guard.observe(grid);
    // a keyboard reaching a plate before the module did: let the plates up at once
    const early = () => {
      if (!reveal) show();
    };
    grid.addEventListener("focusin", early);

    return () => {
      cancelled = true;
      cancelIdle();
      guard.disconnect();
      window.clearTimeout(guardTimer);
      grid.removeEventListener("focusin", early);
      reveal?.stop();
    };
  }, []);

  // the light that follows a fine pointer across a plate: not loaded at all on touch or for reduced motion
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    const cancelIdle = whenIdle(() => {
      import("@/lib/animations/categoryPointer").then(({ startCategoryPointer }) => {
        if (!cancelled) stop = startCategoryPointer(grid);
      }, () => {});
    });
    return () => {
      cancelled = true;
      cancelIdle();
      stop?.();
    };
  }, []);

  return (
    <section
      id={SECTION_IDS.categories}
      ref={sectionRef}
      aria-labelledby={TITLE_ID}
      className="cat-section story-sheet"
    >
      <div className="cat-catalog page-container">
        {/* The headline, with its explainer stacked under it (roomy screens only), on a pool of light over the water */}
        <div className="cat-catalog__head mb-4 border-b border-line pb-4 md:mb-6 md:pb-6">
          <Tide
            as="h2"
            id={TITLE_ID}
            className="cat-catalog__title display-type text-ink"
            text="Tackle [Architecture]."
            drop
          />
          <p className="cat-catalog__lede mt-3 max-w-prose text-base text-ink-soft">
            Engineered lure and terminal systems designed for maximum hydrodynamics,
            uncompromising hook-up conversion, and predatory triggers.
          </p>
        </div>

        {/* The eight categories: they tighten on a small or short screen (categories.css) so all eight fit one screen where there is height for them */}
        <div ref={gridRef} className="cat-grid">
          {CATEGORIES.map((category, index) => (
            <CategoryCard
              key={category.id}
              category={category}
              index={index}
              near={near}
              onOpen={(event) => setOpen({ category, opener: event.currentTarget })}
            />
          ))}
        </div>
      </div>

      {open && <CategoryInspector category={open.category} opener={open.opener} onClosed={closeInspector} />}
    </section>
  );
}
