/**
 * The water the hero ends in, continued behind the sections below it, so the
 * page never drops from a bright underwater scene onto a bare white sheet.
 *
 * Decorative only (aria-hidden, no pointer events), drawn behind the section's
 * content. Three variants set where the water sits in the section:
 *
 *   top     a swell from the hero: pale water at the top edge, clearing to the
 *           page color; the caustic light drifts across it
 *   soft    a faint wash and still light on the gray band
 *   bottom  water gathering at the foot of the page, light from above
 *
 * Every color is a token mixed with transparency (see story.css). The caustic
 * light is the same tile the hero's engine paints (lib/underwater/caustics.ts,
 * published as --caustic-tile on the page); without script there is no tile and
 * the gradients stand alone.
 */
export function WaterLight({ variant }: { variant: "top" | "soft" | "bottom" }) {
  return (
    <div className={`water-light water-light--${variant}`} aria-hidden="true">
      <div className="water-light__wash" />
      <div className="water-light__caustics" />
    </div>
  );
}
