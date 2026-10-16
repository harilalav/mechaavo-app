import { expect, test } from "@playwright/test";
import { median, percentile } from "./helpers/color";
import { FRAME_RECORDER, type PhaseStats } from "./helpers/frames";
import { bounds, drive } from "./helpers/drive";
import { openHome } from "./helpers/story";

/**
 * Fluency: how smoothly the page moves while a reader scrolls it end to end with real input
 * (wheel on a mouse screen, touch gestures on a touch one), split into the three phases that
 * do different work: the hero (canvas engine, scrubbed story), the handover (the categories
 * rising and their plates surfacing) and the rest of the page.
 *
 * Phones and tablets run at 4x CPU throttle (a mid-range device), the rest at 1x. Frame
 * pacing under throttle drifts with whatever else the machine is doing, so every number is
 * the median of three runs, and the budgets are soft (reported, not fatal); layout shift is
 * the one hard limit. The metrics are attached to the report as JSON; recording.spec.ts
 * records a video of a scroll so the motion itself can be watched.
 */

// frame pacing moves with whatever else the machine is doing (a 4K run once read p95 83 ms and read 16.8 ms twice right after):
// a miss is retried once before it counts
test.describe.configure({ retries: 1 });

const THROTTLED = new Set(["phone", "tablet", "tablet-land"]);
const RUNS = 3;

type Frames = { frames: [number, number][]; loaf: [number, number][]; cls: number; lite: boolean };
function phaseStats(data: Frames, from: number, to: number): PhaseStats {
  const deltas: number[] = [];
  const times: number[] = [];
  for (let i = 1; i < data.frames.length; i++) {
    const [t, y] = data.frames[i];
    if (y >= from && y < to) {
      deltas.push(t - data.frames[i - 1][0]);
      times.push(t);
    }
  }
  const t0 = times.length ? times[0] : 0;
  const t1 = times.length ? times[times.length - 1] : 0;
  const loaf = data.loaf.filter(([start]) => start >= t0 && start <= t1);
  return {
    frames: deltas.length,
    p50: +median(deltas).toFixed(1),
    p95: +percentile(deltas, 95).toFixed(1),
    p99: +percentile(deltas, 99).toFixed(1),
    longest: +Math.max(0, ...deltas).toFixed(1),
    jank: +(deltas.filter((d) => d > 25).length / Math.max(1, deltas.length)).toFixed(3),
    loaf50: loaf.filter(([, d]) => d > 50).length,
    loafMax: +Math.max(0, ...loaf.map(([, d]) => d)).toFixed(1),
  };
}

const PHASES = ["hero", "handover", "story"] as const;

test("fluency: frame pacing through the whole page", async ({ page }, info) => {
  test.setTimeout(600_000);
  await page.addInitScript(FRAME_RECORDER);
  const cdp = await page.context().newCDPSession(page);
  const throttle = THROTTLED.has(info.project.name) ? 4 : 1;
  const touch = Boolean(info.project.use.hasTouch);
  const runs: { phases: Record<string, PhaseStats>; cls: number; lite: boolean }[] = [];

  for (let r = 0; r < RUNS; r++) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await openHome(page);
    const b = await bounds(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    await page.evaluate(() => (window as unknown as { __resetFrames: () => void }).__resetFrames());
    await drive(page, cdp, touch, b);
    const data = await page.evaluate(() => {
      const w = window as unknown as Frames & { __frames: Frames["frames"]; __loaf: Frames["loaf"]; __cls: number };
      return { frames: w.__frames, loaf: w.__loaf, cls: w.__cls, lite: !!document.querySelector(".hero-root[data-lite]") };
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const edges = { hero: [0, b.handover], handover: [b.handover, b.story], story: [b.story, Infinity] } as const;
    runs.push({
      phases: Object.fromEntries(PHASES.map((p) => [p, phaseStats(data, edges[p][0], edges[p][1])])),
      cls: data.cls,
      lite: data.lite,
    });
  }

  // the median of the runs, metric by metric
  const keys: (keyof PhaseStats)[] = ["frames", "p50", "p95", "p99", "longest", "jank", "loaf50", "loafMax"];
  const summary = Object.fromEntries(
    PHASES.map((p) => [p, Object.fromEntries(keys.map((k) => [k, median(runs.map((run) => run.phases[p][k]))]))]),
  ) as unknown as Record<string, PhaseStats>;
  const cls = median(runs.map((run) => run.cls));
  const report = { project: info.project.name, cpuThrottle: throttle, input: touch ? "touch" : "wheel", runs: RUNS, cls, engineDegraded: runs.some((run) => run.lite), phases: summary, perRun: runs };
  await info.attach("fluency.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  for (const p of PHASES) {
    const s = summary[p];
    info.annotations.push({ type: `fluency ${p}`, description: `p50 ${s.p50} ms, p95 ${s.p95} ms, p99 ${s.p99} ms, jank ${(s.jank * 100).toFixed(1)}%, LoAF>50 ${s.loaf50}, longest LoAF ${s.loafMax} ms` });
  }

  // Budgets are a report, not a verdict: pacing under throttle moves with the machine's state, so a
  // miss is written into the report as an "over budget" note; only a gross miss (twice the budget)
  // or a layout shift fails the run.
  const budget = throttle > 1 ? { p95: 34, jank: 0.12, loafMax: 400 } : { p95: 20, jank: 0.05, loafMax: 200 };
  for (const p of PHASES) {
    const s = summary[p];
    if (!s.frames) continue;
    const checks: [string, number, number][] = [
      ["95th percentile frame time (ms)", s.p95, budget.p95],
      ["share of frames over 25 ms", s.jank, budget.jank],
      ["longest animation frame (ms)", s.loafMax, budget.loafMax],
    ];
    for (const [what, value, limit] of checks) {
      if (value > limit) info.annotations.push({ type: `over budget: ${p}`, description: `${what} ${value} (budget ${limit})` });
      expect(value, `${p}: ${what}, twice the budget`).toBeLessThanOrEqual(limit * 2);
    }
  }
  expect(cls, "layout shift while scrolling").toBeLessThanOrEqual(0.01);
});
