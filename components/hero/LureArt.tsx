import type { CSSProperties, ReactNode } from "react";
import { LURE_ANCHORS, LURE_ART_SIZE } from "@/lib/hero/lureConfig";

/**
 * Procedural Mechaavo lure (vector fallback): a jointed swimbait in a chrome
 * finish. Faces right, line eyelet at the nose. Brand tokens only.
 *
 * Every fill of the body is fully opaque (a solid underlay sits beneath the
 * chrome, and no gradient stop is transparent): the lure is a solid object, and
 * nothing behind it, fish or water, shows through. Only the highlights painted
 * on top of it are partly transparent, as light on a surface is.
 *
 * It is built as nested, full-size layers so each part can move on its own CSS
 * transform without ever repainting the artwork (the engine's lure rig writes
 * those transforms every frame; see lib/underwater/lureRig.ts):
 *
 *   head ── mid ── tail      three body segments, each hinged at a seam, the
 *    │                       front one overlapping the one behind it
 *    └ belly treble          swings from its split ring
 *   tail treble              hangs from the tail tip, dressed with feather:
 *    └ dress ── long fibers   a tuft tied at the hook bend that streams behind
 *                            it and flutters (a bare treble is plain; a dressed
 *                            one is what anglers put on a hard bait's tail)
 *   shadow                   a soft blurred copy of the silhouette behind it
 *   specular                 a band of light that slides along the body
 *
 * Each layer carries the same full viewBox; the segments differ only in the
 * region they clip to, and they share one set of gradients (defined once, in
 * user space) so the chrome runs unbroken across the seams. The anchors the
 * fish and the line attach to ride inside the parts that move them, so a bite
 * lands on the hook wherever it is swinging.
 *
 * The production hero uses a transparent PNG instead when one is provided
 * (see lib/hero/lureConfig.ts).
 */

const { width: W, height: H } = LURE_ART_SIZE;
const VIEWBOX = `0 0 ${W} ${H}`;

// Body outline: nose at the right, tail at the left.
const BODY =
  "M918 182 C905 150 840 118 740 104 C640 90 500 92 380 116 C270 138 160 170 74 196 L74 210 C160 232 270 262 390 276 C520 290 660 288 770 262 C850 244 905 220 918 196 C922 190 922 186 918 182 Z";

// The two seams between segments.
const SEAM_1 = "M436 100 C418 160 418 232 440 292";
const SEAM_2 = "M262 124 C248 170 250 224 268 268";

// Regions: each segment reaches 16px under the segment in front of it.
const REGION_HEAD = "M436 56 L436 100 C418 160 418 232 440 292 L440 340 L1000 340 L1000 56 Z";
const REGION_MID =
  "M262 56 L262 124 C248 170 250 224 268 268 L268 340 L456 340 L456 292 C434 232 434 160 452 100 L452 56 Z";
const REGION_TAIL = "M0 56 L278 56 L278 124 C264 170 266 224 284 268 L284 340 L0 340 Z";

// A treble hook hanging from a split ring at the origin.
const TREBLE_SHANK = "M0 12 L0 64";
const TREBLE_PRONGS = [
  "M0 64 C4 108 44 116 52 80 L43 87",
  "M0 64 C-4 108 -44 116 -52 80 L-43 87",
  "M0 64 L0 102 L9 94",
];

// The feather dressing, tied at the tail treble's bend (about 67, 262) and streaming back
// to the left: short fibers that move with the treble, then long ones that flutter beyond them.
const DRESS_TIE = { x: 70, y: 262 } as const;
/** Drawn at this size about the tie, so the tuft reads beside a lure this small. */
const DRESS_SCALE = 1.6;
const DRESS_FIBER_AT = { x: 24, y: 262 } as const;
const dressSize = `translate(${DRESS_TIE.x} ${DRESS_TIE.y}) scale(${DRESS_SCALE}) translate(${-DRESS_TIE.x} ${-DRESS_TIE.y})`;
// where the long fibers' hinge lands once the tuft is scaled
const DRESS_FIBER_JOINT = {
  x: DRESS_TIE.x + (DRESS_FIBER_AT.x - DRESS_TIE.x) * DRESS_SCALE,
  y: DRESS_TIE.y + (DRESS_FIBER_AT.y - DRESS_TIE.y) * DRESS_SCALE,
} as const;
const DRESS_SHORT = [
  { d: "M72 260 C50 244 14 238 -22 244 C14 251 48 259 72 264 Z", fill: "var(--color-accent-secondary)" },
  { d: "M72 261 C48 252 18 252 -14 262 C18 267 48 270 72 265 Z", fill: "var(--color-primary)" },
  { d: "M72 263 C50 270 22 282 -8 292 C24 282 50 273 72 266 Z", fill: "var(--color-accent-secondary)" },
] as const;
const DRESS_LONG = [
  { d: "M30 259 C4 249 -34 249 -76 262 C-36 265 2 267 30 263 Z", fill: "var(--color-white)" },
  { d: "M30 262 C6 273 -30 286 -70 304 C-30 284 4 271 30 266 Z", fill: "var(--color-light)" },
  { d: "M26 261 C-6 257 -46 261 -96 278 C-46 268 -6 267 26 264 Z", fill: "var(--color-primary)" },
] as const;

const percent = (value: number, of: number) => `${(value / of) * 100}%`;
/** Hinge point of a part, as a CSS transform-origin. */
const origin = (x: number, y: number): CSSProperties => ({
  transformOrigin: `${percent(x, W)} ${percent(y, H)}`,
});
/** Position an anchor at a fraction of the artwork box. */
const anchorAt = (a: { x: number; y: number }): CSSProperties => ({
  left: `${a.x * 100}%`,
  top: `${a.y * 100}%`,
});

const steel = { stroke: "var(--color-secondary)" } as const;

function Treble({ scale = 1, highlight = true }: { scale?: number; highlight?: boolean }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" transform={`scale(${scale})`}>
      <circle r="11" strokeWidth="4.5" style={steel} />
      <path d={TREBLE_SHANK} strokeWidth="6.5" style={steel} />
      {TREBLE_PRONGS.map((d) => (
        <path key={d} d={d} strokeWidth="6.5" style={steel} />
      ))}
      {highlight && (
        <g strokeWidth="1.6" style={{ stroke: "var(--color-white)", strokeOpacity: 0.75 }} transform="translate(-1.6 -1.2)">
          <path d={TREBLE_SHANK} />
          {TREBLE_PRONGS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
    </g>
  );
}

/** Shared gradients, patterns and clip paths: defined once, referenced by every layer. */
function Defs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        {/* high-contrast metallic chrome: rich dark back, iridescent cyan reflection, solid satin chrome belly */}
        <linearGradient id="lure-chrome" gradientUnits="userSpaceOnUse" x1="0" y1="90" x2="0" y2="292">
          <stop offset="0" style={{ stopColor: "var(--color-dark)" }} />
          <stop offset="0.12" style={{ stopColor: "var(--color-secondary)" }} />
          <stop offset="0.28" style={{ stopColor: "var(--color-surface)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--color-dark)" }} />
          <stop offset="0.52" style={{ stopColor: "var(--color-secondary)" }} />
          <stop offset="0.68" style={{ stopColor: "var(--color-accent-primary)" }} />
          <stop offset="0.82" style={{ stopColor: "var(--color-light)" }} />
          <stop offset="0.95" style={{ stopColor: "var(--color-surface)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-dark)" }} />
        </linearGradient>
        <linearGradient id="lure-back" gradientUnits="userSpaceOnUse" x1="0" y1="90" x2="0" y2="180">
          <stop offset="0" style={{ stopColor: "var(--color-dark)", stopOpacity: 0.95 }} />
          <stop offset="0.6" style={{ stopColor: "var(--color-dark)", stopOpacity: 0.5 }} />
          <stop offset="1" style={{ stopColor: "var(--color-dark)", stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id="lure-gloss" gradientUnits="userSpaceOnUse" x1="0" y1="100" x2="0" y2="150">
          <stop offset="0" style={{ stopColor: "var(--color-white)", stopOpacity: 0.8 }} />
          <stop offset="0.5" style={{ stopColor: "var(--color-accent-secondary)", stopOpacity: 0.4 }} />
          <stop offset="1" style={{ stopColor: "var(--color-white)", stopOpacity: 0 }} />
        </linearGradient>
        {/* belly flash: solid pearl metallic sheen with defined contrast */}
        <linearGradient id="lure-flash" gradientUnits="userSpaceOnUse" x1="0" y1="288" x2="0" y2="236">
          <stop offset="0" style={{ stopColor: "var(--color-light)", stopOpacity: 0.95 }} />
          <stop offset="0.5" style={{ stopColor: "var(--color-white)", stopOpacity: 0.6 }} />
          <stop offset="1" style={{ stopColor: "var(--color-secondary)", stopOpacity: 0 }} />
        </linearGradient>
        {/* the overlap shadow a front segment throws on the one behind it */}
        <linearGradient id="lure-overlap" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-dark)", stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: "var(--color-dark)", stopOpacity: 0.7 }} />
        </linearGradient>
        <linearGradient id="lure-band" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-white)", stopOpacity: 0 }} />
          <stop offset="0.5" style={{ stopColor: "var(--color-white)", stopOpacity: 0.75 }} />
          <stop offset="1" style={{ stopColor: "var(--color-white)", stopOpacity: 0 }} />
        </linearGradient>
        <radialGradient id="lure-eye" cx="0.42" cy="0.4" r="0.65">
          <stop offset="0" style={{ stopColor: "var(--color-accent-secondary)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--color-primary)" }} />
          <stop offset="0.85" style={{ stopColor: "var(--color-dark)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-dark)" }} />
        </radialGradient>
        <pattern id="lure-scales" width="16" height="11" patternUnits="userSpaceOnUse">
          <path
            d="M0 11 Q8 1 16 11"
            fill="none"
            strokeWidth="1.2"
            style={{ stroke: "var(--color-dark)", strokeOpacity: 0.28 }}
          />
        </pattern>
        <clipPath id="lure-clip-body">
          <path d={BODY} />
        </clipPath>
        <clipPath id="lure-clip-head">
          <path d={REGION_HEAD} />
        </clipPath>
        <clipPath id="lure-clip-mid">
          <path d={REGION_MID} />
        </clipPath>
        <clipPath id="lure-clip-tail">
          <path d={REGION_TAIL} />
        </clipPath>
      </defs>
    </svg>
  );
}

/** One body segment: the whole body painted, clipped to this segment's region. */
function Segment({ region, children }: { region: string; children?: ReactNode }) {
  return (
    <svg viewBox={VIEWBOX} className="lure__svg" aria-hidden="true">
      <g clipPath={`url(#lure-clip-${region})`}>
        {/* solid opaque underlays: completely blocks anything behind the lure */}
        <path d={BODY} fill="var(--color-dark)" />
        <path d={BODY} fill="var(--color-surface)" />
        <path d={BODY} fill="url(#lure-chrome)" />
        <g clipPath="url(#lure-clip-body)">
          <rect x="60" y="80" width="880" height="225" fill="url(#lure-scales)" />
          <rect x="60" y="80" width="880" height="225" fill="url(#lure-back)" />
          {/* upper highlight */}
          <path d="M900 134 C770 100 520 94 330 120 C530 114 760 118 900 148 Z" fill="url(#lure-gloss)" />
          {/* belly flash */}
          <path d="M150 238 C310 268 520 282 770 258 L770 290 L150 290 Z" fill="url(#lure-flash)" />
          {/* lateral line */}
          <path d="M770 180 C610 172 400 182 90 208" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-brand-primary" />
          {/* keel */}
          <path d="M150 236 C310 264 520 278 770 254" fill="none" strokeWidth="2.5" className="stroke-brand-white/70" />
          {children}
        </g>
        {/* crisp solid edge so the lure stays solid against any background */}
        <path d={BODY} fill="none" strokeWidth="3.5" strokeLinejoin="round" className="stroke-brand-dark" />
        {/* a thread of light along the top edge */}
        <path d="M760 106 C640 92 500 94 380 117" fill="none" strokeWidth="2" strokeLinecap="round" className="stroke-brand-white/80" />
      </g>
    </svg>
  );
}

export function LureArt() {
  return (
    <div className="lure" role="img" aria-label="Mechaavo fishing lure">
      <Defs />

      {/* soft cast shadow: the silhouette, blurred, behind everything */}
      <div className="lure__shadow" data-lure-part="shadow" aria-hidden="true">
        <svg viewBox={VIEWBOX} className="lure__svg">
          <path d={BODY} className="fill-brand-secondary" />
        </svg>
      </div>

      {/* head: the root segment. Its parts nest inside it so they move with it. */}
      <div className="lure__part" data-lure-part="head">
        {/* mid segment, hinged at the first seam; it carries the tail segment */}
        <div className="lure__part" data-lure-part="mid" style={origin(436, 196)}>
          {/* tail segment, hinged at the second seam */}
          <div className="lure__part" data-lure-part="tail" style={origin(262, 196)}>
            {/* tail treble, set behind the tail */}
            <div className="lure__part" data-lure-part="hook-tail" style={origin(80, 214)}>
              <svg viewBox={VIEWBOX} className="lure__svg" aria-hidden="true">
                <g transform="translate(80 214) rotate(14)">
                  <Treble scale={0.82} />
                </g>
              </svg>
              {/* the dressing, tied at the bend of the treble: it swings with it and flutters on its own */}
              <div className="lure__part" data-lure-part="dress" style={origin(DRESS_TIE.x, DRESS_TIE.y)}>
                <svg viewBox={VIEWBOX} className="lure__svg" aria-hidden="true">
                  <g strokeWidth="1.2" strokeLinejoin="round" className="stroke-brand-dark/45" transform={dressSize}>
                    {DRESS_SHORT.map((fiber) => (
                      <path key={fiber.d} d={fiber.d} style={{ fill: fiber.fill }} />
                    ))}
                  </g>
                </svg>
                <div className="lure__part" data-lure-part="dress-tip" style={origin(DRESS_FIBER_JOINT.x, DRESS_FIBER_JOINT.y)}>
                  <svg viewBox={VIEWBOX} className="lure__svg" aria-hidden="true">
                    <g strokeWidth="1.2" strokeLinejoin="round" className="stroke-brand-dark/45" transform={dressSize}>
                      {DRESS_LONG.map((fiber) => (
                        <path key={fiber.d} d={fiber.d} style={{ fill: fiber.fill }} />
                      ))}
                    </g>
                  </svg>
                </div>
              </div>
            </div>
            <Segment region="tail">
              {/* shadow thrown by the segment in front */}
              <rect x="222" y="80" width="62" height="225" fill="url(#lure-overlap)" />
              <path d={SEAM_2} fill="none" strokeWidth="2" className="stroke-brand-dark/40" />
            </Segment>
            <span
              className="hero-anchor"
              data-hero-anchor="tail"
              aria-hidden="true"
              style={anchorAt(LURE_ANCHORS.tail)}
            />
          </div>
          <Segment region="mid">
            {/* shadow thrown by the head, then this segment's own front edge over the tail */}
            <rect x="388" y="80" width="68" height="225" fill="url(#lure-overlap)" />
            <path d={SEAM_2} fill="none" strokeWidth="3" className="stroke-brand-dark/50" />
            <path d="M269 126 C255 171 257 224 275 268" fill="none" strokeWidth="1.3" className="stroke-brand-white/40" />
            <circle cx="258" cy="156" r="4" className="fill-brand-light" />
            <circle cx="260" cy="240" r="4" className="fill-brand-light" />
          </Segment>
        </div>

        {/* diving lip */}
        <svg viewBox={VIEWBOX} className="lure__svg" aria-hidden="true">
          <path
            d="M884 214 L968 258 C976 262 974 272 963 270 L872 236 Z"
            className="fill-brand-primary stroke-brand-secondary"
            strokeWidth="2"
          />
        </svg>

        <Segment region="head">
          {/* the head's rear edge overlaps the segment behind it: a seam and the shadow it throws */}
          <path d={SEAM_1} fill="none" strokeWidth="3" className="stroke-brand-dark/65" />
          <path d="M443 102 C425 160 425 232 447 292" fill="none" strokeWidth="1.4" className="stroke-brand-white/45" />
          <circle cx="432" cy="152" r="5" className="fill-brand-light" />
          <circle cx="432" cy="246" r="5" className="fill-brand-light" />
          {/* gill plate */}
          <path d="M748 112 C700 152 700 222 752 266" fill="none" strokeWidth="3.5" className="stroke-brand-dark/60" />
          <path d="M755 114 C708 154 708 222 758 264" fill="none" strokeWidth="1.5" className="stroke-brand-white/45" />
          {/* eye */}
          <circle cx="826" cy="172" r="26" className="fill-brand-white" />
          <circle cx="826" cy="172" r="26" fill="none" strokeWidth="2.5" className="stroke-brand-dark/55" />
          <circle cx="826" cy="172" r="17" fill="url(#lure-eye)" />
          <circle cx="826" cy="172" r="8" className="fill-brand-dark" />
          <circle cx="819" cy="165" r="3.2" className="fill-brand-white" />
          <circle cx="833" cy="179" r="1.6" className="fill-brand-white/80" />
        </Segment>

        {/* line eyelet */}
        <svg viewBox={VIEWBOX} className="lure__svg" aria-hidden="true">
          <circle cx="930" cy="174" r="11" fill="none" strokeWidth="4.5" style={steel} />
          <circle cx="928.5" cy="172.5" r="9" fill="none" strokeWidth="1.2" style={{ stroke: "var(--color-white)", strokeOpacity: 0.7 }} />
        </svg>
        <span
          className="hero-anchor"
          data-hero-anchor="tie"
          aria-hidden="true"
          style={anchorAt(LURE_ANCHORS.tie)}
        />

        {/* belly treble: swings from its split ring on the underside */}
        <div className="lure__part" data-lure-part="hook-belly" style={origin(540, 288)}>
          <svg viewBox={VIEWBOX} className="lure__svg" aria-hidden="true">
            <g transform="translate(540 288)">
              <Treble />
            </g>
          </svg>
          <span
            className="hero-anchor"
            data-hero-anchor="hook"
            aria-hidden="true"
            style={anchorAt(LURE_ANCHORS.hook)}
          />
        </div>
      </div>

      {/* light sliding along the body, clipped to the silhouette */}
      <svg viewBox={VIEWBOX} className="lure__svg" aria-hidden="true">
        <g clipPath="url(#lure-clip-body)">
          <path
            data-lure-part="spec"
            className="lure__spec"
            d="M470 90 L560 90 L500 300 L410 300 Z"
            fill="url(#lure-band)"
          />
        </g>
      </svg>
    </div>
  );
}
