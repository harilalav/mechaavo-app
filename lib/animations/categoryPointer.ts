/**
 * The ring of light that follows a fine pointer round a category plate's edge (categories-plate.css).
 *
 * One passive `pointermove` listener on the grid and one write per frame: it finds the plate under the
 * pointer and publishes where the pointer is on it as two custom properties, `--mx` and `--my`, in percent
 * (the ring's radial highlight is centred there; the plate's own `--lit` says whether it shows). Nothing is
 * read from the layout except the plate's own box, and nothing is written to anything but custom
 * properties, so nothing lays out and nothing is laid out twice. Started only for a fine pointer with
 * motion allowed (ProductCategories.tsx): touch and reduced motion never load this.
 */
export function startCategoryPointer(grid: HTMLElement): () => void {
  let frame = 0;
  let plate: HTMLElement | null = null;
  let x = 0;
  let y = 0;

  const write = () => {
    frame = 0;
    if (!plate) return;
    const box = plate.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const u = Math.min(1, Math.max(0, (x - box.left) / box.width));
    const v = Math.min(1, Math.max(0, (y - box.top) / box.height));
    plate.style.setProperty("--mx", `${(u * 100).toFixed(1)}%`);
    plate.style.setProperty("--my", `${(v * 100).toFixed(1)}%`);
  };

  const onMove = (event: PointerEvent) => {
    const hit = (event.target as Element | null)?.closest<HTMLElement>(".cat-card") ?? null;
    plate = hit;
    if (!plate) return;
    x = event.clientX;
    y = event.clientY;
    if (!frame) frame = requestAnimationFrame(write);
  };

  // the ring keeps its last place while it fades out, so there is nothing to put back
  const onLeave = () => {
    plate = null;
  };

  grid.addEventListener("pointermove", onMove, { passive: true });
  grid.addEventListener("pointerleave", onLeave);

  return () => {
    grid.removeEventListener("pointermove", onMove);
    grid.removeEventListener("pointerleave", onLeave);
    if (frame) cancelAnimationFrame(frame);
    plate = null;
  };
}
