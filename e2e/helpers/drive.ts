import type { CDPSession, Page } from "@playwright/test";

export type Bounds = { handover: number; story: number; end: number; vh: number; vw: number };

export async function bounds(page: Page): Promise<Bounds> {
  return page.evaluate(() => {
    const top = (id: string) => (document.getElementById(id)?.getBoundingClientRect().top ?? 0) + window.scrollY;
    return {
      // the handover starts when the categories' top comes up into the screen (over the pinned hero)
      handover: top("categories") - window.innerHeight,
      story: top("story"),
      end: document.documentElement.scrollHeight - window.innerHeight,
      vh: window.innerHeight,
      vw: window.innerWidth,
    };
  });
}

/** Scroll to the end with real input, at about a screen a second, as a reader skimming would. */
export async function drive(page: Page, cdp: CDPSession, touch: boolean, b: Bounds) {
  if (touch) {
    for (let i = 0; i < 200; i++) {
      const y = await page.evaluate(() => window.scrollY);
      if (y >= b.end - 2) break;
      await cdp.send("Input.synthesizeScrollGesture", {
        x: Math.round(b.vw / 2),
        y: Math.round(b.vh * 0.7),
        yDistance: -Math.round(b.vh * 0.45),
        speed: 900,
        gestureSourceType: "touch",
      });
      await page.waitForTimeout(140);
    }
  } else {
    await page.mouse.move(b.vw / 2, b.vh / 2);
    for (let i = 0; i < 2000; i++) {
      const y = await page.evaluate(() => window.scrollY);
      if (y >= b.end - 2) break;
      await page.mouse.wheel(0, Math.round(b.vh / 10));
      await page.waitForTimeout(100);
    }
  }
  await page.waitForTimeout(1200);
}
