/**
 * Run `task` once the browser is idle (or after `timeout` ms at the latest).
 * Returns a function that cancels it.
 *
 * Used to start the hero's scripts after the first paint and after the web
 * font has had the main thread to itself: the headline, nav and lure all
 * arrive with CSS, so nothing visible waits on these scripts, and keeping the
 * thread free early is what lets the font swap in quickly (the swap is what
 * the Largest Contentful Paint waits for).
 */
export function whenIdle(task: () => void, timeout = 1500): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 200);
  return () => window.clearTimeout(id);
}
