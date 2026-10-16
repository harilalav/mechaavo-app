import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * The UI and fluency suite (e2e/): `npm run test:ui`, report with `npm run test:ui:report`.
 *
 * It runs against a production COPY of the app (scripts/preview-clone.sh, on its own port,
 * 3350 unless E2E_PORT says otherwise), because `next dev` owns .next in the repo and is not
 * what visitors get. Point it at a server that is already running with E2E_BASE_URL (for
 * instance http://localhost:3000 while iterating; frame timing there is not representative).
 * System Chrome, no browser download: CHROME_PATH overrides, as for design:sweep.
 *
 * One worker, nothing in parallel: one server, and frame timing needs a quiet machine.
 */
const chrome = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
]
  .filter((p): p is string => Boolean(p))
  .find((p) => existsSync(p));

const port = process.env.E2E_PORT ?? "3350";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "e2e/.report", open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    launchOptions: { executablePath: chrome, args: ["--disable-dev-shm-usage"] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-GB",
  },
  // the screens the client named (phone, tablet, 4K) plus the laptop and desktop between them;
  // heights are what a browser really shows (100 to 120 px less than the screen)
  projects: [
    { name: "phone", use: { viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: "tablet", use: { viewport: { width: 820, height: 1060 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: "tablet-land", use: { viewport: { width: 1180, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: "laptop", use: { viewport: { width: 1366, height: 650 }, deviceScaleFactor: 1 } },
    { name: "desktop", use: { viewport: { width: 1920, height: 950 }, deviceScaleFactor: 1 } },
    { name: "uhd", use: { viewport: { width: 3840, height: 2000 }, deviceScaleFactor: 1 } },
  ],
});
