import type { LureAnchors } from "../underwater/types";

/**
 * Hero DOM contract. Components expose elements through `data-hero` /
 * `data-hero-anchor` attributes; the timeline and the Canvas engine find them
 * from the hero root, so neither needs refs threaded through React props.
 */
export const HERO_ROOT_ATTR = "data-hero-root";

export function queryLureAnchors(root: ParentNode): LureAnchors | null {
  const get = (name: string) =>
    root.querySelector<HTMLElement>(`[data-hero-anchor="${name}"]`);
  const hero = (key: string) => root.querySelector<HTMLElement>(`[data-hero="${key}"]`);
  const part = (name: string) =>
    root.querySelector<HTMLElement>(`[data-lure-part="${name}"]`);

  const slot = get("slot");
  const art = get("art");
  const tie = get("tie");
  const hook = get("hook");
  const tail = get("tail");
  const pull = hero("lure-pull");
  const shake = hero("lure-shake");
  if (!slot || !art || !tie || !hook || !tail || !pull || !shake) return null;

  return {
    slot,
    art,
    tie,
    hook,
    tail,
    // the jointed parts exist only on the vector lure; a photo cut-out moves as one piece
    rig: {
      pull,
      shake,
      mid: part("mid"),
      tail: part("tail"),
      hookBelly: part("hook-belly"),
      hookTail: part("hook-tail"),
      dress: part("dress"),
      dressTip: part("dress-tip"),
      spec: part("spec"),
      shadow: part("shadow"),
    },
  };
}
