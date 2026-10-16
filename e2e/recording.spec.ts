import { test } from "@playwright/test";
import { bounds, drive } from "./helpers/drive";
import { openHome } from "./helpers/story";

/**
 * A video of one end-to-end scroll (hero, bite, categories surfacing, the rest of the page),
 * attached to the report, so the motion can be watched as well as measured (fluency.spec.ts).
 * Recording costs frames, which is why it is not the run the fluency numbers come from.
 */
test.use({ video: { mode: "on", size: { width: 960, height: 540 } } });

test("recorded scroll: the whole story for a look by eye", async ({ page }, info) => {
  test.skip(!["phone", "laptop"].includes(info.project.name), "recorded on the phone and the laptop only");
  test.setTimeout(240_000);
  await openHome(page);
  const cdp = await page.context().newCDPSession(page);
  await drive(page, cdp, Boolean(info.project.use.hasTouch), await bounds(page));
});
