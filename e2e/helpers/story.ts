import type { Page } from "@playwright/test";

/**
 * Load the page and let the hero's engine start (it sets data-ready on the hero root).
 * The catalog's snap (heroTimeline.ts) is switched off here: these specs park the page between positions on purpose
 * and measure it there; the one spec of the snap itself turns it back on.
 */
export async function openHome(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("mechaavo-snap", "off");
  });
  await page.goto("/", { waitUntil: "load" });
  await page.waitForSelector(".hero-root[data-ready]", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

export const viewportHeight = (page: Page) => page.evaluate(() => window.innerHeight);

/** One step of the suite's steady gesture: an eighth of a screen, then `ms` to settle (the scrub lags 1 s / 0.4 s). */
export async function step(page: Page, ms = 250): Promise<number> {
  return page.evaluate(async (wait) => {
    window.scrollBy(0, window.innerHeight / 8);
    await new Promise((r) => setTimeout(r, wait));
    return window.scrollY;
  }, ms);
}

/** Steady gesture from the top until the fish takes the lure; the scroll position of the bite, or null. */
export async function scrollToBite(page: Page, maxSteps = 40): Promise<number | null> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  for (let i = 0; i < maxSteps; i++) {
    const y = await step(page, 250);
    if (await page.evaluate(() => !!document.querySelector(".hero-root[data-caught]"))) return y;
  }
  return null;
}

/** Which category tiles are fully on screen and surfaced, and the first row's members. */
export function tilesNow(page: Page) {
  return page.evaluate(() => {
    const tiles = [...document.querySelectorAll<HTMLElement>(".cat-card")];
    const top0 = tiles[0]?.getBoundingClientRect().top ?? 0;
    return {
      up: tiles.map((t) => {
        const r = t.getBoundingClientRect();
        return Number(getComputedStyle(t).opacity) >= 0.98 && r.top >= 0 && r.bottom <= window.innerHeight + 1;
      }),
      firstRow: tiles.map((t, i) => (Math.abs(t.getBoundingClientRect().top - top0) < 4 ? i : -1)).filter((i) => i >= 0),
      sheetTop: document.getElementById("categories")?.getBoundingClientRect().top ?? Infinity,
    };
  });
}

/** How many of the plates' arrival animations are running now (the rise, the waterline, the ruler, the chip). */
export function plateAnimations(page: Page) {
  return page.evaluate(
    () =>
      document.getAnimations().filter((a) => {
        const t = (a.effect as KeyframeEffect | null)?.target;
        return t instanceof Element && !!t.closest(".cat-card");
      }).length,
  );
}
