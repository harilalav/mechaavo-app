/**
 * An init script (page.addInitScript) that records, from the first frame on:
 *   window.__frames   [timestamp, scrollY] for every animation frame
 *   window.__loaf     long animation frames (> 50 ms) with their start and duration
 *   window.__cls      the layout shift total, skipping shifts right after input
 * Read them with page.evaluate; reset with window.__resetFrames().
 */
export const FRAME_RECORDER = `(() => {
  const w = window;
  w.__frames = [];
  w.__loaf = [];
  w.__cls = 0;
  w.__resetFrames = () => { w.__frames = []; w.__loaf = []; w.__cls = 0; };
  const tick = (t) => { w.__frames.push([t, w.scrollY]); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__loaf.push([e.startTime, e.duration]);
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
})();`;

export interface PhaseStats {
  frames: number;
  p50: number;
  p95: number;
  p99: number;
  longest: number;
  /** Share of frames slower than 1.5 frames at 60 Hz (25 ms). */
  jank: number;
  /** Long animation frames over 50 ms that started in the phase. */
  loaf50: number;
  loafMax: number;
}
