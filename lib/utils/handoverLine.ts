/**
 * Where the categories' top has to come up to (measured from the top of the screen) for the page to
 * hand over from the hero to the sticky bar: the sticky bar slides in (components/ui/SiteNavigation.tsx), and the
 * hero, which by then is only the water behind the catalog, turns `inert` and lets go of its own nav
 * (lib/animations/heroTimeline.ts). One number for both, so there is never a moment with two navs exposed
 * or with none that can be reached.
 *
 * It is the bar's own height plus 2% of the screen at the least (the bar's line), and 65% of the screen at the
 * most: the hero's dark nav links and logo leave while the water behind them is still pale (the camera is
 * sinking, heroTimeline.ts), and the bar is there before it gets deep.
 */
export function handoverLine(bar: HTMLElement | null): number {
  const vh = window.innerHeight;
  return Math.max((bar?.offsetHeight ?? 0) + vh * 0.02, vh * 0.65);
}
