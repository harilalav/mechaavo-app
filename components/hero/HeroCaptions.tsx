/**
 * Story captions: the brief's technical phrases, shown one at a time like film
 * subtitles. Each names what the viewer is looking at in that part of the
 * story (the lure at rest, the lure in the water, the lure under strike), so the
 * phrases earn their place and the hero carries no static HUD, scroll cue, rotated
 * text, ruler or decorative marks. No specifications are claimed.
 *
 * Without the scroll timeline (reduced motion) only the first caption shows.
 */
export const HERO_CAPTIONS = [
  "Precision tackle",
  "Hydro-dynamic design",
  "Calibrated performance",
] as const;

export function HeroCaptions() {
  return (
    <div className="hero-captions" aria-hidden="true">
      {HERO_CAPTIONS.map((caption) => (
        <p key={caption} className="hero-caption" data-hero="caption">
          {caption}
        </p>
      ))}
    </div>
  );
}
