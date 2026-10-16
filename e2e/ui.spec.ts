import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { contrast, hsl, luminance, median, percentile, readTokens, type RGB } from "./helpers/color";
import { FRAME_RECORDER } from "./helpers/frames";
import { cssShot, samplePixels } from "./helpers/pixels";
import { openHome, plateAnimations, scrollToBite, step, tilesNow } from "./helpers/story";

/**
 * UI cross-check of the client review round (2026-10-15), on every screen of the config:
 * the client's ocean (azure to navy) and the Mechaavo-blue fish, the copy readable on them, the categories right
 * after the fish and surfacing, the tighter section rhythm, 4K scaling, the
 * keyboard, the fallbacks, and a still layout while scrolling. Each beat's screenshot is
 * attached to the HTML report (npm run test:ui:report) for a look by eye.
 */

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("requestfailed", (r) => {
    const why = r.failure()?.errorText ?? "";
    // a request the page cancels itself (a swapped image, a prefetch): not a failure
    if (!why.includes("ERR_ABORTED")) errors.push(`request: ${r.url()} ${why}`);
  });
  return errors;
};

const attach = async (info: TestInfo, name: string, page: Page) =>
  info.attach(name, { body: await cssShot(page), contentType: "image/png" });

/** Hide the given selectors without moving anything (the layout is untouched). */
const hide = (page: Page, selectors: string[]) =>
  page.addStyleTag({ content: `${selectors.join(",")}{visibility:hidden!important}` });

test.describe("sea, fish and the copy on them", () => {
  test("the sea is the client's ocean: azure to navy, deeper toward the lower right", async ({ page }, info) => {
    const errors = errorsOf(page);
    await openHome(page);
    await page.waitForTimeout(1500);
    await info.attach("hero-top", { body: await cssShot(page), contentType: "image/png" });
    // the water alone: no fish, no lure, no seabed (they are canvas and DOM layers over it)
    await hide(page, [".hero-canvas", ".hero-lure-slot"]);
    await page.waitForTimeout(200);
    const shot = await cssShot(page);
    const { w, h } = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));

    const [mid, upperLeft, lowerRight] = await samplePixels(page, shot, [
      { x: w * 0.55, y: h * 0.3, w: w * 0.4, h: h * 0.3 },
      { x: w * 0.01, y: h * 0.1, w: w * 0.06, h: h * 0.2 },
      { x: w * 0.82, y: h * 0.62, w: w * 0.16, h: h * 0.2 },
    ]);
    // the expected hue is the tokens' own, with room for the light and the glare on it
    const t = readTokens();
    const hs = ["sea-shallow", "sea-mid", "sea-deep"].map((k) => hsl(t[k]).h);
    const lo = Math.min(...hs) - 15;
    const hi = Math.max(...hs) + 15;
    const hues = mid.map(hsl).filter((c) => c.s > 0.2 && c.l > 0.2 && c.l < 0.9).map((c) => c.h);
    expect(hues.length, "enough tinted water pixels to judge").toBeGreaterThan(50);
    const hue = median(hues);
    info.annotations.push({ type: "water hue", description: `${hue.toFixed(1)} (tokens ${hs.map((x) => x.toFixed(0)).join(", ")})` });
    expect(hue, `median water hue (the ocean tokens are ${lo.toFixed(0)} to ${hi.toFixed(0)} degrees: the client's ocean is blue, not green-turquoise)`).toBeGreaterThanOrEqual(lo);
    expect(hue).toBeLessThanOrEqual(hi);
    // the photo's depth: the light is up at the surface, the navy low and to the right
    expect(median(upperLeft.map(luminance)), "the light comes from the upper left").toBeGreaterThan(median(lowerRight.map(luminance)) * 1.8);
    expect(errors).toEqual([]);
  });

  test("fish are Mechaavo blue", async ({ page }, info) => {
    await openHome(page);
    const bite = await scrollToBite(page);
    expect(bite, "the fish takes the lure").not.toBeNull();
    await page.waitForTimeout(1500);
    await info.attach("after-bite", { body: await cssShot(page), contentType: "image/png" });
    // the fish alone on the white page: the water is blue too, so it would hide them from a hue count
    await hide(page, [".hero-bg", ".hero-rays", ".hero-haze", ".hero-vignette", ".hero-caustics", ".hero-lure-slot"]);
    await page.waitForTimeout(200);
    const shot = await cssShot(page);
    await info.attach("fish-alone", { body: shot, contentType: "image/png" });
    const { w, h } = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    const [px] = await samplePixels(page, shot, [{ x: 0, y: h * 0.16, w, h: h * 0.84 }], 3);
    const want = hsl(readTokens()["brand-blue"]);
    // the flank of the fish is the logo's blue: same hue, same saturation, a little lighter at most
    const flank = px.map(hsl).filter((c) => Math.abs(c.h - want.h) < 9 && c.s > want.s - 0.2 && Math.abs(c.l - want.l) < 0.12).length;
    const share = flank / px.length;
    info.annotations.push({ type: "brand-blue share", description: `${(share * 100).toFixed(2)}% of the hero below the nav` });
    expect(share, "share of the hero in the logo's blue (the fish)").toBeGreaterThan(0.0015);
  });

  test("copy keeps its contrast on the ocean", async ({ page }, info) => {
    await openHome(page);
    await page.waitForTimeout(2200);
    // the words themselves: what is on screen with them, against what is on screen without
    const targets = [
      { sel: ".hero-nav__menu a", name: "nav links", min: 4.5, soft: 3 },
      { sel: ".hero-kicker", name: "kicker", min: 4.5, soft: 3 },
      { sel: ".hero-title .hero-line:first-child", name: "headline (large text)", min: 3, soft: 2.2 },
      { sel: ".hero-tagline", name: "tagline", min: 4.5, soft: 3 },
      { sel: ".hero-lede", name: "lede", min: 4.5, soft: 3 },
      { sel: ".hero-caption:first-child", name: "foot caption", min: 4.5, soft: 3 },
    ];
    const boxes = await page.evaluate((list) => {
      return list.map((t) => {
        const els = [...document.querySelectorAll<HTMLElement>(t.sel)].filter((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 4 && r.height > 4;
        });
        return els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        });
      });
    }, targets);
    const withText = await cssShot(page);
    await info.attach("copy-on-ocean", { body: withText, contentType: "image/png" });
    await hide(page, targets.map((t) => t.sel));
    await page.waitForTimeout(80);
    const without = await cssShot(page);

    const flat = boxes.flatMap((list, i) => list.map((b) => ({ i, b })));
    const a = await samplePixels(page, withText, flat.map((f) => f.b), 1);
    const b = await samplePixels(page, without, flat.map((f) => f.b), 1);
    const byTarget = new Map<number, number[]>();
    flat.forEach((f, k) => {
      const ratios = byTarget.get(f.i) ?? [];
      for (let p = 0; p < a[k].length; p++) {
        const [r1, g1, b1] = a[k][p];
        const [r2, g2, b2] = b[k][p];
        // only pixels the words fully cover (an anti-aliased edge is half ground and says nothing about the ink; a
        // fish swimming behind moves a little between the two shots and stays under this)
        if (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) > 260) ratios.push(contrast(a[k][p] as RGB, b[k][p] as RGB));
      }
      byTarget.set(f.i, ratios);
    });
    targets.forEach((t, i) => {
      const ratios = byTarget.get(i) ?? [];
      if (ratios.length < 20) {
        info.annotations.push({ type: `contrast ${t.name}`, description: "not on screen in this layout" });
        return;
      }
      const typical = median(ratios);
      info.annotations.push({ type: `contrast ${t.name}`, description: `median ${typical.toFixed(2)}, worst decile ${percentile(ratios, 10).toFixed(2)} over ${ratios.length} glyph pixels` });
      expect(typical, `${t.name}: median contrast on the ocean`).toBeGreaterThanOrEqual(t.min);
      // anti-aliased edges and a fish passing behind a word: only the worst tenth may be lower
      expect.soft(percentile(ratios, 10), `${t.name}: worst tenth of its glyph pixels`).toBeGreaterThanOrEqual(t.soft);
    });
  });
});

test("the foot captions keep their contrast as the seabed rises under them", async ({ page }, info) => {
  test.setTimeout(240_000);
  await openHome(page);
  const vh = await page.evaluate(() => window.innerHeight);
  const seen = new Set<string>();
  const worst: string[] = [];
  for (let k = 1; k <= 14; k++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(vh * k * 0.12));
    await page.waitForTimeout(1400);
    const caption = await page.evaluate(() => {
      const el = [...document.querySelectorAll<HTMLElement>(".hero-caption")].find((c) => {
        const cs = getComputedStyle(c);
        return cs.visibility !== "hidden" && Number(cs.opacity) > 0.9;
      });
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const root = document.querySelector(".hero-root");
      // under the sheet the hero is covered: nothing to read
      if (root?.hasAttribute("inert")) return null;
      return { text: el.textContent?.trim() ?? "", box: { x: r.left, y: r.top, w: r.width, h: r.height }, covered: r.bottom > window.innerHeight || r.top < 0 };
    });
    if (!caption || caption.covered) continue;
    const withText = await cssShot(page);
    await hide(page, [".hero-caption"]);
    await page.waitForTimeout(60);
    const without = await cssShot(page);
    const [a1] = await samplePixels(page, withText, [caption.box], 1);
    const [b1] = await samplePixels(page, without, [caption.box], 1);
    await page.evaluate(() => document.querySelectorAll("style").forEach((st) => st.textContent?.includes("visibility:hidden!important") && st.remove()));
    const ratios: number[] = [];
    for (let p = 0; p < a1.length; p++) {
      const d = Math.abs(a1[p][0] - b1[p][0]) + Math.abs(a1[p][1] - b1[p][1]) + Math.abs(a1[p][2] - b1[p][2]);
      if (d > 260) ratios.push(contrast(a1[p] as RGB, b1[p] as RGB));
    }
    if (ratios.length < 20) continue;
    const typical = median(ratios);
    seen.add(caption.text);
    worst.push(`${caption.text}: ${typical.toFixed(2)}`);
    expect.soft(typical, `caption "${caption.text}" at ${(k * 0.12).toFixed(2)} screens`).toBeGreaterThanOrEqual(4.5);
  }
  info.annotations.push({ type: "caption contrast through the story", description: worst.join("; ") || "no caption on screen" });
  expect(seen.size, "at least one caption was on screen to measure").toBeGreaterThan(0);
});

test.describe("headings, light and the dive", () => {
  test("heading plates: white type on ink, standing off their ground", async ({ page }, info) => {
    await openHome(page);
    await page.waitForTimeout(2000);
    const measure = async (label: string) => {
      const found = await page.evaluate(() => {
        const mark = [...document.querySelectorAll<HTMLElement>(".tide__mark")].find((m) => {
          const r = m.getBoundingClientRect();
          return r.width > 20 && r.top >= 0 && r.bottom <= window.innerHeight;
        });
        const plate = mark?.querySelector<HTMLElement>(".tide__plate");
        if (!mark || !plate) return null;
        const r = plate.getBoundingClientRect();
        return {
          text: getComputedStyle(mark).color,
          plate: getComputedStyle(plate).backgroundColor,
          box: { x: r.left + r.width * 0.05, y: r.top, w: r.width * 0.9, h: r.height },
        };
      });
      if (!found) return;
      const rgb = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? [0, 0, 0]).slice(0, 3).map(Number) as RGB;
      const typeOnPlate = contrast(rgb(found.text), rgb(found.plate));
      // the ground around the label: the page with the plate taken away
      await hide(page, [".tide__plate", ".tide__glint"]);
      await page.waitForTimeout(80);
      const [ground] = await samplePixels(page, await cssShot(page), [found.box], 2);
      const onGround = median(ground.map((px) => contrast(rgb(found.plate), px as RGB)));
      info.annotations.push({ type: `plate ${label}`, description: `type on plate ${typeOnPlate.toFixed(1)}:1, plate against its ground ${onGround.toFixed(1)}:1` });
      expect(typeOnPlate, `${label}: type on the plate`).toBeGreaterThanOrEqual(7);
      expect(onGround, `${label}: the plate against the ground behind it (a UI boundary needs 3:1)`).toBeGreaterThanOrEqual(3);
    };
    await measure("hero, over the ocean");
    await page.evaluate(() => document.querySelectorAll("style").forEach((st) => st.textContent?.includes("visibility:hidden!important") && st.remove()));
    await page.evaluate(() => document.getElementById("story")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(2600);
    await measure("story, on the white page");
  });

  test("the dive in from the logo leaves a thin trail of fine bubbles", async ({ page }, info) => {
    // count the small arcs the engine draws on its visible canvases per frame (a bubble is five, a mote one): the dive against the settled water
    await page.addInitScript(() => {
      const w = window as unknown as { __arcs: [number, number][]; __t0: number };
      w.__arcs = [];
      w.__t0 = performance.now();
      let n = 0;
      const arc = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc = function (x: number, y: number, r: number, a: number, b: number, c?: boolean) {
        // only what is drawn on the hero's own canvases (the caustic tile, the seabed and the blur buffer are offscreen)
        const canvas = this.canvas as HTMLCanvasElement;
        if (r > 0 && r < 9 && canvas.classList?.contains("hero-canvas")) n++;
        return arc.call(this, x, y, r, a, b, c);
      };
      const tick = () => {
        w.__arcs.push([performance.now() - w.__t0, n]);
        n = 0;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto("/", { waitUntil: "commit" });
    await page.waitForTimeout(11_000);
    const arcs = await page.evaluate(() => (window as unknown as { __arcs: [number, number][] }).__arcs);
    const mean = (from: number, to: number) => {
      const w = arcs.filter(([t]) => t >= from && t < to);
      return w.length ? w.reduce((a, [, n]) => a + n, 0) / w.length : 0;
    };
    const dive = Math.max(mean(500, 2000), mean(1500, 3000), mean(2500, 4000));
    const settled = mean(8000, 11_000);
    info.annotations.push({ type: "dive bubbles", description: `small arcs per frame: ${dive.toFixed(1)} while diving, ${settled.toFixed(1)} once settled` });
    expect(dive, "the dive draws more bubbles than the settled water").toBeGreaterThan(settled + 12);
    // a thread, not a crowd (client review 2026-10-16: "too crowded and artificial"): the old dive released 12 to 34 five-arc bubbles a second; this one measures about +35 a frame on a phone and a laptop
    expect(dive - settled, "the dive is a thin thread of bubbles, not a crowd").toBeLessThan(75);
  });

  test("the light shafts move, with a glint travelling down each", async ({ page }) => {
    await openHome(page);
    const sample = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".hero-ray__beam")].map((b) => b.style.transform || getComputedStyle(b).transform),
      );
    const before = await sample();
    await page.waitForTimeout(3200);
    const after = await sample();
    const moved = before.filter((t, i) => t !== after[i]).length;
    expect(moved, "shafts whose position changed in 3 seconds").toBeGreaterThanOrEqual(4);
    const glint = await page.evaluate(() => getComputedStyle(document.querySelector(".hero-ray__beam")!, "::after").animationName);
    expect(glint).toBe("hero-ray-glint");
  });

  test("reduced motion: the shafts and their glints are still", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const glint = await page.evaluate(() => getComputedStyle(document.querySelector(".hero-ray__beam")!, "::after").animationName);
    expect(glint).toBe("none");
  });
});

test.describe("the surfacing entrance below the hero", () => {
  const state = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-surface]")].map((m) => ({ group: m.closest("[data-surface-group]")?.tagName ?? "", o: Number(getComputedStyle(m).opacity), t: getComputedStyle(m).transform })),
    );

  test("the principles and the contact tiles wait under the water, then surface once and rest in place", async ({ page }, info) => {
    await openHome(page);
    const before = await state(page);
    expect(before.length, "three principles and four contact tiles").toBe(7);
    expect(Math.max(...before.map((m) => m.o)), "held back before they are in view").toBe(0);
    for (const id of ["principles", "contact"]) {
      await page.evaluate((target) => document.getElementById(target)?.scrollIntoView({ behavior: "instant", block: "center" }), id);
      await page.waitForTimeout(1800);
    }
    const after = await state(page);
    info.annotations.push({ type: "surfaced", description: `${after.filter((m) => m.o === 1).length} of ${after.length} at rest` });
    for (const m of after) {
      expect(m.o).toBe(1);
      expect(m.t).toBe("none");
    }
    await attach(info, "contact-surfaced", page);
  });

  test("focus inside a group brings every member up at once", async ({ page }) => {
    await openHome(page);
    // jump past the principles (they are not seen) and put the keyboard on the last contact link
    await page.evaluate(() => {
      const link = [...document.querySelectorAll<HTMLElement>("[data-surface-group] a")].pop();
      link?.focus({ preventScroll: true });
    });
    await page.waitForTimeout(120);
    const o = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-surface-group] [data-surface]")].filter((m) => m.closest("#contact")).map((m) => Number(getComputedStyle(m).opacity)));
    expect(o.length).toBe(4);
    expect(Math.min(...o), "the whole contact group is up as soon as the keyboard is in it").toBeGreaterThanOrEqual(0.99);
  });

  test("reduced motion: nothing is held back", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(800);
    expect(Math.min(...(await state(page)).map((m) => m.o))).toBe(1);
  });

  test.describe("without script", () => {
    test.use({ javaScriptEnabled: false });
    test("no script: everything is there", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      expect(Math.min(...(await state(page)).map((m) => m.o))).toBe(1);
    });
  });
});

test.describe("no video", () => {
  test("the site carries no video: no element, no file, no pause button", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await openHome(page);
    await page.evaluate(() => document.getElementById("categories")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(6000);
    const found = await page.evaluate(() => ({
      videos: document.querySelectorAll("video").length,
      toggles: document.querySelectorAll(".hero-toggle, .cat-toggle, [aria-label*='background video' i]").length,
    }));
    expect(found.videos, "no <video> element").toBe(0);
    expect(found.toggles, "no pause or play button for one").toBe(0);
    expect(requests.filter((u) => /\.(mp4|webm|mov)(\?|$)|\/videos\//i.test(u)), "no video file requested").toEqual([]);
  });
});

test.describe("categories", () => {
  test("no opening card: the plates arrive right after the fish, on the page's own white", async ({ page }, info) => {
    const errors = errorsOf(page);
    await openHome(page);
    expect(await page.locator(".cat-preview").count(), "the preview card is gone").toBe(0);
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/Engineered\s+Tackle\s+Categories|System 02/i);

    // no sheet and no swell: the catalog rises through the hero's own water (client review 2026-10-16, round 3)
    await expect.poll(() => page.evaluate(() => document.querySelector(".hero-track")?.hasAttribute("data-backdrop")), { timeout: 8000 }).toBe(true);
    const ground = await page.evaluate(() => ({
      swell: document.querySelectorAll(".story-edge").length,
      section: getComputedStyle(document.querySelector(".cat-section")!).backgroundColor,
      inTrack: !!document.querySelector(".hero-track #categories"),
    }));
    expect(ground.swell, "the swell edge is gone").toBe(0);
    expect(ground.inTrack, "the catalog is inside the hero's track").toBe(true);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".cat-section")!).backgroundColor), { message: "the catalog shows the hero's water" }).toBe("rgba(0, 0, 0, 0)");

    const biteY = await scrollToBite(page);
    expect(biteY).not.toBeNull();
    const vh = await page.evaluate(() => window.innerHeight);
    let sheetY: number | null = null;
    let firstRowY: number | null = null;
    let allY: number | null = null;
    let animated = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 40 && allY === null; i++) {
      const y = await step(page, 400);
      const s = await tilesNow(page);
      animated = Math.max(animated, await plateAnimations(page));
      if (sheetY === null && s.sheetTop < vh) {
        sheetY = y;
        await attach(info, "sheet-arrives", page);
      }
      s.up.forEach((u, k) => u && seen.add(k));
      if (firstRowY === null && s.firstRow.length && s.firstRow.every((k) => s.up[k])) {
        firstRowY = y;
        await attach(info, "first-row-surfaced", page);
      }
      if (seen.size === s.up.length && s.up.length) allY = y;
    }
    const sc = (y: number | null) => (y === null ? Infinity : (y - biteY!) / vh);
    info.annotations.push({
      type: "screens after the bite",
      description: `sheet ${sc(sheetY).toFixed(2)}, first row ${sc(firstRowY).toFixed(2)}, all tiles ${sc(allY).toFixed(2)}`,
    });
    expect(sc(sheetY), "bite to the categories sheet coming up").toBeLessThanOrEqual(0.75);
    expect(sc(firstRowY), "bite to the first row of tiles surfaced").toBeLessThanOrEqual(1.2);
    expect(sc(allY), "bite to every tile surfaced").toBeLessThanOrEqual(1.8);
    expect(animated, "the plates animate in while they surface").toBeGreaterThan(0);

    // the overlay stops by itself, and every tile rests in place
    await page.waitForTimeout(4500);
    expect(await plateAnimations(page), "nothing is still animating once the waves are over").toBe(0);
    const rest = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".cat-card")].map((t) => ({ o: getComputedStyle(t).opacity, tf: getComputedStyle(t).transform })),
    );
    for (const r of rest) {
      expect(r.o).toBe("1");
      expect(r.tf).toBe("none");
    }
    await attach(info, "categories-at-rest", page);
    expect(errors).toEqual([]);
  });

  test("a press mid-wave brings every tile up at once", async ({ page }) => {
    await openHome(page);
    await page.evaluate(() => document.querySelector(".cat-grid")?.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(140);
    const before = await page.evaluate(() => [...document.querySelectorAll(".cat-card")].some((t) => Number(getComputedStyle(t).opacity) < 0.99));
    await page.evaluate(() => document.querySelector(".cat-grid")?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => [...document.querySelectorAll(".cat-card")].map((t) => Number(getComputedStyle(t).opacity)));
    test.skip(!before, "the wave had already finished (a fast machine): nothing to interrupt");
    expect(Math.min(...after)).toBeGreaterThanOrEqual(0.99);
  });

  test("keyboard: every tile is reachable before it surfaces, and the sticky bar never covers focus", async ({ page }) => {
    await openHome(page);
    const problems: string[] = [];
    let tiles = 0;
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(260);
      const f = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        const bar = document.querySelector<HTMLElement>(".site-nav");
        const barShown = bar?.dataset.show === "true";
        return {
          tile: el.classList.contains("cat-card"),
          opacity: Number(getComputedStyle(el).opacity),
          top: r.top,
          bottom: r.bottom,
          inBar: !!bar?.contains(el),
          barBottom: barShown && bar ? bar.getBoundingClientRect().bottom : 0,
          label: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40),
          footer: !!el.closest("footer"),
        };
      });
      if (!f) continue;
      if (f.tile) {
        tiles++;
        if (f.opacity < 0.99) problems.push(`tile "${f.label}" focused but not shown (opacity ${f.opacity})`);
      }
      if (!f.inBar && f.barBottom > 0 && f.top < f.barBottom - 1) problems.push(`"${f.label}" focused under the sticky bar (top ${Math.round(f.top)} < ${Math.round(f.barBottom)})`);
      if (f.footer && f.label.length && i > 20) break;
    }
    expect(tiles, "all eight tiles reached with Tab").toBeGreaterThanOrEqual(8);
    expect(problems).toEqual([]);
  });
});

test.describe("category plates and the inspector", () => {
  /** Bring the grid up and let every plate finish surfacing. */
  const settle = async (page: Page) => {
    await page.evaluate(() => document.querySelector(".cat-grid")?.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(3800);
  };

  test("each plate shows where in the water it works, read from its own depth text", async ({ page }) => {
    await openHome(page);
    await settle(page);
    const plates = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".cat-card")].map((c) => ({
        name: c.querySelector("h3")?.textContent?.trim() ?? "",
        label: c.querySelector(".cat-card__depth-label")?.textContent?.trim() ?? "",
        g0: Number.parseFloat(c.style.getPropertyValue("--g0")),
        g1: Number.parseFloat(c.style.getPropertyValue("--g1")),
        bar: c.querySelector<HTMLElement>(".cat-gauge__bar")?.getBoundingClientRect().width ?? 0,
        reads: c.textContent ?? "",
      })),
    );
    expect(plates.length).toBe(8);
    for (const p of plates) {
      expect(p.g1, `${p.name}: the range has a size`).toBeGreaterThan(p.g0);
      expect(p.bar, `${p.name}: the lit range is drawn`).toBeGreaterThan(2);
      expect(p.reads, `${p.name}: the depth is in the button's text, not only in a picture`).toMatch(/Works at/);
    }
    const label = (n: string) => plates.find((p) => p.name.startsWith(n))?.label;
    expect(label("Frog")).toBe("Surface");
    expect(label("Wood")).toBe("0-8 ft");
    expect(label("Metal")).toBe("20-350+ ft");
    expect(label("Assist")).toBe("All depths");
  });

  test("the product photos are shown in their own colour: no blend, no filter, not grayscale (client review 2026-10-16)", async ({ page }) => {
    await openHome(page);
    await settle(page);
    const photos = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>(".cat-card__img")].map((img) => {
        const cs = getComputedStyle(img);
        // how far apart the three channels are, on average: zero is a grayscale picture
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 32;
        const x = c.getContext("2d")!;
        x.drawImage(img, 0, 0, 64, 32);
        const d = x.getImageData(0, 0, 64, 32).data;
        let spread = 0;
        for (let k = 0; k < d.length; k += 4) spread += Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]);
        return { blend: cs.mixBlendMode, filter: cs.filter, spread: spread / (d.length / 4) };
      }),
    );
    expect(photos.length).toBe(8);
    for (const p of photos) {
      expect(p.blend, "no blend mode over the photo").toBe("normal");
      expect(p.filter, "no filter on the photo").toBe("none");
    }
    expect(photos.filter((p) => p.spread > 3).length, "the photos carry colour (at least six of the eight)").toBeGreaterThanOrEqual(6);
  });

  test("a touched plate lights: the ring, the arrow and the photo's lean; nothing is drawn on top of the product", async ({ page }, info) => {
    await openHome(page);
    await settle(page);
    const plate = page.locator(".cat-card").nth(1);
    const state = () =>
      plate.evaluate((c) => {
        const img = c.querySelector(".cat-card__img")!;
        return {
          lit: getComputedStyle(c).getPropertyValue("--lit").trim(),
          ring: Number(getComputedStyle(c, "::before").opacity),
          arrow: getComputedStyle(c.querySelector(".cat-card__go")!).backgroundColor,
          img: getComputedStyle(img).transform,
          // anything inside the photo window other than the photo, the chip and the arrival's surface line
          overlays: [...c.querySelectorAll(".cat-card__stage > *")].map((el) => el.className).filter((n) => !/cat-card__(img|index|surface)/.test(String(n))),
        };
      });
    const rest = await state();
    expect(rest.lit).toBe("0");
    expect(rest.overlays, "no line, ring or lure drawn over the photo (client round 3)").toEqual([]);
    await plate.focus();
    await page.waitForTimeout(1200);
    const lit = await state();
    await attach(info, "plate-lit", page);
    expect(lit.lit).toBe("1");
    expect(lit.ring, "touched: the ring of light round the plate").toBeGreaterThan(0.9);
    expect(lit.arrow, "touched: the arrow's ring fills").not.toBe(rest.arrow);
    expect(lit.img, "touched: the photo leans in a little (and does not rotate)").not.toBe(rest.img);
    expect(lit.img).not.toMatch(/matrix\([^,]+, [^,]*[1-9]/); // no skew or rotation in the matrix's second column
    expect(lit.overlays).toEqual([]);
  });

  test("the inspector: the photo flies out of the plate, the dialog covers the bar, closing goes back to the plate", async ({ page }, info) => {
    const errors = errorsOf(page);
    await openHome(page);
    await settle(page);
    const plate = page.locator(".cat-card").nth(5);
    const plateBox = await plate.boundingBox();
    await plate.click();
    await page.waitForTimeout(260); // the real plate goes (hidden, at rest) once the shell is opaque, about 170 ms in
    const flying = await page.evaluate(() => {
      // the whole plate is in flight: the shell's clip window lies between the plate's box and the panel's
      const shell = document.querySelector<HTMLElement>(".cat-shell");
      const clip = shell ? getComputedStyle(shell).clipPath : "";
      const inset = clip.match(/inset\(([-\d.]+)px ([-\d.]+)px ([-\d.]+)px ([-\d.]+)px/);
      const panel = document.querySelector<HTMLElement>(".cat-modal__panel")!.getBoundingClientRect();
      return {
        ghost: document.querySelectorAll(".cat-ghost").length,
        shell: !!shell,
        top: inset ? Number(inset[1]) : null,
        panelTop: panel.top,
        plateHidden: Number(getComputedStyle(document.querySelector(".cat-card[data-morphing]") ?? document.body).opacity) === 0 && !!document.querySelector(".cat-card[data-morphing]"),
        landed: document.querySelector(".cat-modal")?.hasAttribute("data-landed"),
      };
    });
    if (flying.shell && plateBox && flying.top !== null) {
      const [lo, hi] = [Math.min(plateBox.y, flying.panelTop), Math.max(plateBox.y, flying.panelTop)];
      expect(flying.top, "the shell's top edge is on its way from the plate to the panel").toBeGreaterThanOrEqual(lo - 2);
      expect(flying.top).toBeLessThanOrEqual(hi + 2);
    }
    expect(flying.shell, "the whole plate flies (the shell), not the photo alone").toBe(true);
    expect(flying.plateHidden, "the plate in the grid is hidden while it is the dialog").toBe(true);
    await page.waitForTimeout(1400);
    const r = await page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>(".cat-modal");
      const atBar = document.elementFromPoint(window.innerWidth / 2, 8);
      return {
        inBody: dialog?.parentElement === document.body,
        landed: dialog?.hasAttribute("data-landed"),
        ghosts: document.querySelectorAll(".cat-ghost").length,
        coversBar: !!atBar?.closest(".cat-modal"),
        ledger: document.querySelectorAll(".cat-ledger__row").length,
        range: document.querySelector(".cat-sound__range")?.getBoundingClientRect().height ?? 0,
        photoShown: Number(getComputedStyle(document.querySelector(".cat-modal__photo")!).opacity),
        label: document.querySelector("[role=dialog]")?.getAttribute("aria-labelledby") ?? "",
      };
    });
    await attach(info, "inspector", page);
    info.annotations.push({ type: "flight", description: `ghosts at 200 ms: ${flying.ghost}, landed at 200 ms: ${flying.landed}` });
    expect(flying.landed, "not landed 200 ms in: the photo is still flying (or there was no room to fly)").toBeFalsy();
    expect(r.inBody, "the dialog is outside the section's stacking context").toBe(true);
    expect(r.landed, "landed").toBe(true);
    expect(r.ghosts, "the ghost is gone once it has landed").toBe(0);
    expect(await page.evaluate(() => document.querySelectorAll(".cat-shell").length), "the shell is gone once it has landed").toBe(0);
    expect(r.coversBar, "the dialog and its scrim cover the sticky bar").toBe(true);
    expect(r.ledger, "four ledger rows").toBe(4);
    expect(r.range, "the sounding column shows the lit range").toBeGreaterThan(4);
    expect(r.photoShown, "the dialog's own photo is shown after the landing").toBe(1);
    expect(r.label).not.toBe("");

    await page.keyboard.press("Escape");
    // the way back takes about 320 ms; a loaded 4K machine takes longer, so wait for the end of it, not a fixed time
    await page.waitForSelector(".cat-modal", { state: "detached", timeout: 5000 });
    expect(await page.evaluate(() => document.querySelectorAll(".cat-ghost, .cat-shell").length), "no ghost or shell left behind").toBe(0);
    expect(await page.evaluate(() => document.querySelectorAll(".cat-card[data-morphing]").length), "the plate is back in the grid").toBe(0);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.classList.contains("cat-card")), { message: "focus is back on the plate", timeout: 2000 })
      .toBe(true);
    expect(errors).toEqual([]);
  });

  test("closing: the plate lands at rest and does not move in the last frame, whatever the pointer says; it eases into hover on the first move", async ({ page }) => {
    await openHome(page);
    await settle(page);
    const plate = page.locator(".cat-card").nth(5);
    const stage = (await plate.locator(".cat-card__stage").boundingBox())!;
    // the pointer sits over the plate, as it does when it has just been clicked
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2, { steps: 4 });
    await page.waitForTimeout(700);
    await plate.click();
    await page.waitForTimeout(1500);
    await page.keyboard.press("Escape");
    await page.waitForSelector(".cat-modal", { state: "detached", timeout: 5000 });
    const landed = await page.evaluate(() => {
      const c = document.querySelectorAll<HTMLElement>(".cat-card")[5];
      return {
        calm: c.hasAttribute("data-calm"),
        lit: getComputedStyle(c).getPropertyValue("--lit").trim(),
        transform: getComputedStyle(c).transform,
        img: getComputedStyle(c.querySelector(".cat-card__img")!).transform,
        namePlate: getComputedStyle(c.querySelector(".cat-card__name .tide__plate")!).transform,
        morphing: c.hasAttribute("data-morphing"),
      };
    });
    expect(landed.morphing, "the plate is back").toBe(false);
    expect(landed.calm, "calm until the pointer moves").toBe(true);
    expect(landed.lit, "at rest although the pointer is over it").toBe("0");
    expect(landed.transform, "not lifted").toBe("none");
    expect(landed.img, "the photo at its resting size (1.02)").toMatch(/^matrix\(1\.02/);
    expect(landed.namePlate, "the name's plate is still closed").toMatch(/^matrix\(0,/);
    // and it stays that way: nothing moves after landing
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => getComputedStyle(document.querySelectorAll(".cat-card")[5]).transform)).toBe("none");
    // the first pointer move lets it ease into hover
    await page.mouse.move(stage.x + stage.width / 2 + 4, stage.y + stage.height / 2 + 3, { steps: 2 });
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => {
      const c = document.querySelectorAll<HTMLElement>(".cat-card")[5];
      return { calm: c.hasAttribute("data-calm"), lit: getComputedStyle(c).getPropertyValue("--lit").trim() };
    });
    expect(after.calm).toBe(false);
    expect(after.lit, "touched again").toBe("1");
  });

  test("reduced motion: the dialog appears and goes, nothing flies, the photo does not move", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector(".cat-grid")?.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(600);
    await page.locator(".cat-card").nth(2).click();
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => ({
      motion: document.querySelector(".cat-modal")?.hasAttribute("data-motion"),
      ghosts: document.querySelectorAll(".cat-ghost").length,
      photo: Number(getComputedStyle(document.querySelector(".cat-modal__photo")!).opacity),
    }));
    expect(r.motion).toBe(false);
    expect(r.ghosts).toBe(0);
    expect(r.photo).toBe(1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
    expect(await page.locator(".cat-modal").count()).toBe(0);
  });
});

test.describe("the catalog rises through the hero's water", () => {
  /** Scroll in steps (as a reader would) to `offset` screens past the catalog's top, and let it settle. */
  const into = async (page: Page, offset: number) => {
    const target = await page.evaluate((o) => {
      const cat = document.getElementById("categories")!;
      return cat.getBoundingClientRect().top + window.scrollY + o * window.innerHeight;
    }, offset);
    let y = await page.evaluate(() => window.scrollY);
    const step = await page.evaluate(() => window.innerHeight / 8);
    while (y < target) {
      y = Math.min(target, y + step);
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(1600);
  };

  test("the hero stays pinned behind the catalog and keeps moving; nothing of the catch shows through", async ({ page }) => {
    await openHome(page);
    await into(page, 0.2);
    const pinned = await page.evaluate(() => ({
      heroTop: document.querySelector(".hero-root")!.getBoundingClientRect().top,
      inert: document.querySelector(".hero-root")!.hasAttribute("inert"),
    }));
    expect(pinned.heroTop, "the hero is pinned to the top of the screen").toBe(0);
    expect(pinned.inert, "nothing behind the catalog takes focus").toBe(true);
    // the water is alive behind the glass: the hero's canvas changes between two frames
    const frame = () =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>(".hero-canvas--back")!;
        const x = c.getContext("2d")!;
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 97) sum = (sum + d[i] * (i % 13)) % 1e9;
        return sum;
      });
    const a = await frame();
    await page.waitForTimeout(700);
    expect(await frame(), "the backdrop keeps moving").not.toBe(a);
    // every point across every plate on screen is the catalog's, never the hero's lure or canvas
    const stray = await page.evaluate(() => {
      const out: string[] = [];
      for (const plate of document.querySelectorAll<HTMLElement>(".cat-card")) {
        const r = plate.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        for (const fx of [0.15, 0.5, 0.85])
          for (const fy of [0.15, 0.5, 0.85]) {
            const el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
            // (the dev server's own overlay button, nextjs-portal, sits in a corner when the suite runs against `next dev`)
            if (el && !el.closest(".cat-section") && !el.closest(".site-nav") && el.tagName !== "NEXTJS-PORTAL") out.push(el.className.toString().slice(0, 40));
          }
      }
      return out;
    });
    expect(stray, "points over the plates that belong to something else").toEqual([]);
    // the lure and the statement have left
    const left = await page.evaluate(() => ({
      lure: Number(getComputedStyle(document.querySelector(".hero-lure-fade")!).opacity),
      statement: Number(getComputedStyle(document.querySelector(".hero-statement-fade")!).opacity),
    }));
    expect(left.lure).toBeLessThan(0.05);
    expect(left.statement).toBeLessThan(0.05);
  });

  /** Scroll (a step at a time, as a reader would) until the catalog heading's top is `fraction` of the screen down. */
  const headingAt = async (page: Page, fraction: number) => {
    const target = await page.evaluate((f) => {
      const h = document.querySelector<HTMLElement>(".cat-catalog__title")!;
      return h.getBoundingClientRect().top + window.scrollY - f * window.innerHeight;
    }, fraction);
    let y = await page.evaluate(() => window.scrollY);
    const step = await page.evaluate(() => window.innerHeight / 8);
    while (Math.abs(y - target) > 1) {
      y += Math.sign(target - y) * Math.min(step, Math.abs(target - y));
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(1800);
  };

  test("the catalog's heading, lede and plate names keep their contrast on the water, wherever on the screen they pass", async ({ page }, info) => {
    await openHome(page);
    await page.evaluate(() => document.querySelector(".cat-section")?.setAttribute("data-shown", ""));
    // the morph resolves the plate word in about a second: sample after it, and with the heading's rise done
    const targets = [
      { sel: ".cat-catalog__title .tide__w:not(.tide__mark .tide__w)", name: "catalog heading, the words off the plate (large text)", min: 3 },
      { sel: ".cat-catalog__lede", name: "catalog lede", min: 4.5 },
      { sel: ".cat-card__name", name: "plate names", min: 4.5 },
      { sel: ".cat-card__depth-label", name: "depth readings", min: 4.5 },
    ];
    // the heading first appears low on the screen and leaves at the top: the water must be deep enough all the way
    for (const fraction of [0.62, 0.4, 0.2]) {
      await headingAt(page, fraction);
      const boxes = await page.evaluate((list) =>
        list.map((t) =>
          [...document.querySelectorAll<HTMLElement>(t.sel)]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return getComputedStyle(el).display !== "none" && r.width > 4 && r.height > 4 && r.top >= 0 && r.bottom <= window.innerHeight;
            })
            .map((el) => {
              const r = el.getBoundingClientRect();
              return { x: r.left, y: r.top, w: r.width, h: r.height };
            }),
        ),
      targets);
      const withText = await cssShot(page);
      await info.attach(`catalog-on-water-${fraction}`, { body: withText, contentType: "image/png" });
      await hide(page, targets.map((t) => t.sel));
      await page.waitForTimeout(80);
      const without = await cssShot(page);
      await page.evaluate(() => document.querySelectorAll("style").forEach((st) => st.textContent?.includes("visibility:hidden!important") && st.remove()));
      const flat = boxes.flatMap((list, i) => list.map((b) => ({ i, b })));
      const a = await samplePixels(page, withText, flat.map((f) => f.b), 1);
      const b = await samplePixels(page, without, flat.map((f) => f.b), 1);
      const byTarget = new Map<number, number[]>();
      flat.forEach((f, k) => {
        const ratios = byTarget.get(f.i) ?? [];
        for (let p = 0; p < a[k].length; p++) {
          const [r1, g1, b1] = a[k][p];
          const [r2, g2, b2] = b[k][p];
          if (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) > 260) ratios.push(contrast(a[k][p] as RGB, b[k][p] as RGB));
        }
        byTarget.set(f.i, ratios);
      });
      targets.forEach((t, i) => {
        const ratios = byTarget.get(i) ?? [];
        if (ratios.length < 20) return; // not on screen at this position in this layout
        const typical = median(ratios);
        info.annotations.push({ type: `contrast ${t.name} @${fraction}`, description: `median ${typical.toFixed(2)}, worst decile ${percentile(ratios, 10).toFixed(2)} over ${ratios.length} glyph pixels` });
        expect(typical, `${t.name} with the heading at ${fraction} of the screen: median contrast on the water`).toBeGreaterThanOrEqual(t.min);
      });
    }
  });

  test("a jump to the categories lands with the catch already played: nothing plays out behind the glass", async ({ page }) => {
    await openHome(page);
    await page.waitForTimeout(1500);
    await page.locator(".hero-cta").click();
    // the veil covers (260 ms), the jump, the veil lifts (420 ms)
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({
      title: Number(getComputedStyle(document.querySelector('[data-hero="title-group"]')!).opacity),
      statement: Number(getComputedStyle(document.querySelector(".hero-statement-fade")!).opacity),
      backdrop: document.querySelector(".hero-root")!.hasAttribute("inert"),
    }));
    expect(r.title, "the title has already left").toBeLessThan(0.05);
    expect(r.statement, "the statement has already left").toBeLessThan(0.05);
    expect(r.backdrop, "the hero is already the backdrop").toBe(true);
  });
});

test.describe("the nav stays visible on the water and on the page", () => {
  test("links are full ink; hover is an ink plate with a white label (the cyan one was lost on the azure)", async ({ page }) => {
    test.skip(!!(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)), "hover needs a fine pointer");
    await openHome(page);
    await page.waitForTimeout(2000);
    const link = page.locator(".hero-nav__link").first();
    if (!(await link.isVisible())) return; // the Menu button layout: the links are folded away
    const rest = await link.evaluate((a) => ({ color: getComputedStyle(a).color, weight: getComputedStyle(a).fontWeight }));
    expect(rest.color, "the link is in full ink").toBe("rgb(12, 15, 16)");
    expect(Number(rest.weight)).toBeGreaterThanOrEqual(700);
    const b = (await link.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 });
    await page.waitForTimeout(900);
    const hover = await link.evaluate((a) => ({ label: getComputedStyle(a).color, plate: getComputedStyle(a, "::before").backgroundColor }));
    expect(hover.plate, "the plate is the heading plate's ink").toBe("rgb(12, 15, 16)");
    expect(hover.label, "the label is white on it").toBe("rgb(255, 255, 255)");
  });
});

test.describe("rhythm and big screens", () => {
  test("no blank bands between the sections", async ({ page }, info) => {
    await openHome(page);
    await page.evaluate(() => document.getElementById("story")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.paddingTop = "var(--section-y)";
      document.body.append(probe);
      const sectionY = parseFloat(getComputedStyle(probe).paddingTop);
      probe.remove();
      const blocks = (root: Element | null) =>
        root
          ? [...root.querySelectorAll("h1,h2,h3,h4,p,a,button,img,li")]
              .filter((el) => !el.closest(".water-light") && !el.closest("[aria-hidden='true']"))
              .map((el) => el.getBoundingClientRect())
              .filter((b) => b.width > 4 && b.height > 4)
              .map((b) => ({ top: b.top + window.scrollY, bottom: b.bottom + window.scrollY }))
          : [];
      const order = ["story", "principles", "commitment", "contact"].map((id) => document.getElementById(id));
      order.push(document.querySelector("footer"));
      const joins = [];
      for (let i = 0; i + 1 < order.length; i++) {
        const a = blocks(order[i]);
        const b = blocks(order[i + 1]);
        if (!a.length || !b.length) continue;
        joins.push({ between: `${order[i]?.id || "?"} / ${order[i + 1]?.id || "footer"}`, gap: Math.min(...b.map((x) => x.top)) - Math.max(...a.map((x) => x.bottom)) });
      }
      // the largest stretch of page with no content in it, from #story on
      const all = order.flatMap(blocks).sort((x, y) => x.top - y.top);
      let reach = all[0]?.bottom ?? 0;
      let band = 0;
      for (const x of all) {
        band = Math.max(band, x.top - reach);
        reach = Math.max(reach, x.bottom);
      }
      return { sectionY, joins, band, vh: window.innerHeight };
    });
    info.annotations.push({ type: "section rhythm", description: `--section-y ${r.sectionY.toFixed(0)}px; joins ${r.joins.map((j) => `${j.between} ${Math.round(j.gap)}px`).join(", ")}; largest empty band ${Math.round(r.band)}px` });
    for (const j of r.joins) expect(j.gap, `${j.between}: content to content`).toBeLessThanOrEqual(2.2 * r.sectionY + 32);
    expect(r.band, "largest empty band from #story on").toBeLessThanOrEqual(0.35 * r.vh);
    await attach(info, "story", page);
  });

  test("a 4K screen gets a bigger root and a wider column", async ({ page }, info) => {
    test.skip(info.project.name !== "uhd", "4K only");
    await openHome(page);
    const r = await page.evaluate(() => {
      const c = document.querySelector("#story .page-container") as HTMLElement | null;
      const cs = c ? getComputedStyle(c) : null;
      const inner = c && cs ? c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : 0;
      return { root: parseFloat(getComputedStyle(document.documentElement).fontSize), inner, vw: window.innerWidth };
    });
    info.annotations.push({ type: "4K", description: `root ${r.root}px, column ${Math.round(r.inner)}px of ${r.vw}` });
    expect(r.root).toBeGreaterThanOrEqual(23);
    expect(r.inner / r.vw).toBeGreaterThanOrEqual(0.5);
  });
});

test.describe("fallbacks and stability", () => {
  test("reduced motion: every tile is there at once, nothing animates", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const o = await page.evaluate(() => [...document.querySelectorAll(".cat-card")].map((t) => Number(getComputedStyle(t).opacity)));
    expect(o.length).toBe(8);
    expect(Math.min(...o)).toBe(1);
    await page.evaluate(() => document.querySelector(".cat-grid")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(800);
    expect(await plateAnimations(page)).toBe(0);
    // no pinned backdrop under reduced motion: a still hero in the flow, a white ground, white plates
    const r = await page.evaluate(() => ({
      position: getComputedStyle(document.querySelector(".hero-root")!).position,
      spacer: document.querySelector(".hero-spacer")?.getBoundingClientRect().height ?? 0,
      ground: getComputedStyle(document.querySelector(".cat-section")!).backgroundColor,
      plate: getComputedStyle(document.querySelector(".cat-card")!).backgroundColor,
    }));
    expect(r.position).toBe("relative");
    expect(r.spacer).toBe(0);
    expect(r.ground).toBe("rgb(255, 255, 255)");
    expect(r.plate).toBe("rgb(255, 255, 255)");
  });

  test.describe("without script", () => {
    test.use({ javaScriptEnabled: false });
    test("no script: every tile and section is there", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      // page.evaluate still runs with the page's own script off
      const r = await page.evaluate(() => ({
        tiles: [...document.querySelectorAll(".cat-card")].map((t) => Number(getComputedStyle(t).opacity)),
        sections: ["categories", "story", "principles", "commitment", "contact"].map((id) => document.getElementById(id)?.getBoundingClientRect().height ?? 0),
        position: getComputedStyle(document.querySelector(".hero-root")!).position,
        ground: getComputedStyle(document.querySelector(".cat-section")!).backgroundColor,
      }));
      expect(r.position, "no pinned hero without script").toBe("relative");
      expect(r.ground, "the catalog keeps a white ground without script").toBe("rgb(255, 255, 255)");
      expect(r.tiles.length).toBe(8);
      expect(Math.min(...r.tiles)).toBe(1);
      for (const h of r.sections) expect(h).toBeGreaterThan(0);
    });
  });

  test("the layout stays still while the whole page scrolls (CLS)", async ({ page }, info) => {
    await page.addInitScript(FRAME_RECORDER);
    await openHome(page);
    await page.evaluate(async () => {
      const end = document.documentElement.scrollHeight - window.innerHeight;
      for (let y = 0; y <= end; y += Math.max(200, window.innerHeight / 2)) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 260));
      }
    });
    await page.waitForTimeout(1500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    info.annotations.push({ type: "CLS while scrolling", description: cls.toFixed(4) });
    expect(cls).toBeLessThanOrEqual(0.01);
  });
});
