"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CrosshairIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Mark, Tide } from "@/components/ui/Tide";
import { CATEGORIES_VIDEO } from "@/lib/config/media";
import { SECTION_IDS } from "@/lib/config/sections";
import { useLoopingVideo } from "@/lib/hooks/useLoopingVideo";
import { whenIdle } from "@/lib/utils/idle";
import { CategoryWater, CategoryWaterToggle } from "./CategoryWater";
import { WaterLight } from "./WaterLight";

export interface CategoryData {
  id: string;
  name: string;
  tag: string;
  subtitle: string;
  description: string;
  subcategories: string[];
  specs: {
    action: string;
    depth: string;
    targetSpecies: string;
    coreMaterial: string;
    hardware: string;
  };
  features: string[];
}

export const CATEGORIES: CategoryData[] = [
  {
    id: "frog-lure",
    name: "Frog Lure",
    tag: "Topwater // Weedless",
    subtitle: "Engineered for heavy cover & explosive surface strikes",
    description:
      "A high-buoyancy elastomer hollow-body frog designed to walk, spit, and skip over thick vegetation, lily pads, and timber with 100% weedless defense.",
    subcategories: [
      "Hollow-Body Walkers",
      "Popping & Spitting Frogs",
      "Crawling Twin-Leg Baits",
      "Weedless Double-Hook Walkers",
    ],
    specs: {
      action: "Walk-the-Dog / Surface Chug",
      depth: "Surface (0 ft)",
      targetSpecies: "Largemouth Bass, Snakehead, Pike",
      coreMaterial: "Elastomeric Polymer Shell",
      hardware: "Heavy-Duty Forged 4/0 Double Hook",
    },
    features: [
      "Integrated belly ballast keel ensures upright landing on 100% of casts.",
      "Collapse-on-strike body chamber maximizes hook-up conversion.",
      "Dual silicone leg skirting with micro-strand flutter.",
    ],
  },
  {
    id: "soft-lure",
    name: "Soft Lure",
    tag: "Swimbaits // Silicone",
    subtitle: "Hyper-realistic micro-action & acoustic rib resonance",
    description:
      "Ultra-soft Japanese-grade silicone matrices infused with amino attractants. Designed with hydrodynamic paddle tails that trigger feeding strikes at dead-slow retrieve speeds.",
    subcategories: [
      "Paddle Tail Swimbaits",
      "Ribbed Acoustic Worms",
      "Beaver & Creature Craws",
      "Split-Tail Jerk Minnows",
    ],
    specs: {
      action: "High-Frequency Tail Kick & Flank Roll",
      depth: "Variable (1-45 ft)",
      targetSpecies: "Bass, Zander, Walleye, Perch",
      coreMaterial: "High-Density Japanese Soft Resin",
      hardware: "Rig-Ready Slotted Hook Channels",
    },
    features: [
      "Micro-grooved acoustic ribs displace water like fleeing baitfish.",
      "Belly-weighted salt density profile guarantees upright tracking.",
      "Tear-resistant compound withstands violent strikes.",
    ],
  },
  {
    id: "plastic-lure",
    name: "Plastic Lure",
    tag: "Hardbody // Jerkbaits",
    subtitle: "Precision internal weight transfer & erratic darting",
    description:
      "Engineered ABS acoustic body with internal tungsten slider rails. Delivers razor-sharp sideways darts on the twitch and holds neutral buoyancy with absolute precision on the pause.",
    subcategories: [
      "Suspending Minnow Jerkbaits",
      "Deep-Diving Crankbaits",
      "Lipless Acoustic Vibrations",
      "Wake Baits & Surface Poppers",
    ],
    specs: {
      action: "Erratic Slash & Neutral Suspension",
      depth: "3-16 ft",
      targetSpecies: "Largemouth, Smallmouth, Seabass, Striper",
      coreMaterial: "Virgin Aerospace-Grade ABS",
      hardware: "Teflon-Coated BKK Needle Trebles",
    },
    features: [
      "Magnetic tungsten mass-transfer system adds up to 35% casting distance.",
      "Holographic interior scale foil reflects light in all directions.",
      "Internal acoustic rattles tuned to predatory strike frequencies.",
    ],
  },
  {
    id: "wood-lure",
    name: "Wood Lure",
    tag: "Handcrafted // Balsa",
    subtitle: "Organic live-action buoyancy tuned by master craft",
    description:
      "Individually hand-carved and tank-tested balsa and cedar lures. Natural wood's unique cellular buoyancy generates a lively, organic vibration that molded plastics cannot recreate.",
    subcategories: [
      "Balsa Flat-Side Cranks",
      "Cedar Pencil Walkers",
      "Floating Wood Minnows",
      "Hand-Tuned Jointed Wake Baits",
    ],
    specs: {
      action: "Organic Micro-Wobble & Instant Rise",
      depth: "0-8 ft",
      targetSpecies: "Trout, Bass, Salmon, Musky",
      coreMaterial: "Selected Grain Balsa & Red Cedar",
      hardware: "Through-Wire Stainless Internal Skeleton",
    },
    features: [
      "Continuous stainless through-wire construction for unyielding strength.",
      "12-layer marine polyurethane protective armor.",
      "Natural buoyant deflection off rock, brush, and timber.",
    ],
  },
  {
    id: "spinner",
    name: "Spinner",
    tag: "Vibration // Flash",
    subtitle: "Jewelry-grade brass blades & high-frequency acoustic thump",
    description:
      "Precision-machined rotating blade systems engineered for instant spin on contact. Emits blinding metallic flash and heavy lateral-line acoustic vibration in clear or muddy water.",
    subcategories: [
      "Inline French Spinners",
      "Tandem Willow Spinnerbaits",
      "Colorado Thumper Night Baits",
      "Tail-Spin Casting Vibrators",
    ],
    specs: {
      action: "360° Continuous Rotational Hydro-Pulse",
      depth: "2-30 ft",
      targetSpecies: "Pike, Trout, Bass, Salmon",
      coreMaterial: "Jewelry-Grade Stamped Brass",
      hardware: "Hardened Stainless Steel Wire Shaft",
    },
    features: [
      "Frictionless anti-foul clevis initiates blade spin on zero-slack drops.",
      "Hand-tied silicone skirt with reflective mylar flash strands.",
      "Streamlined torpedo body maintains balance in heavy river currents.",
    ],
  },
  {
    id: "metal-jig",
    name: "Metal Jig",
    tag: "Vertical // Offshore",
    subtitle: "Asymmetrical hydrodynamic keel for erratic vertical flutter",
    description:
      "Center-balanced and tail-weighted marine jigs for deep vertical jigging and high-speed shore casting. Knife-edge hydrodynamic profiling darts aggressively on retrieve and flutters on the drop.",
    subcategories: [
      "Slow Pitch Fall Jigs",
      "Micro Casting Spoons",
      "Vertical Knife Jigs",
      "Shore Casting Distance Jigs",
    ],
    specs: {
      action: "Asymmetrical Falling Flutter & Dart",
      depth: "20-350+ ft",
      targetSpecies: "Tuna, Amberjack, Kingfish, Snapper",
      coreMaterial: "Hardened Zinc-Antimony Alloy",
      hardware: "Welded Stainless Ring & Assist Mount",
    },
    features: [
      "3D prismatic multi-layer holographic laser foil with glow zebra ribs.",
      "Asymmetric keel creates erratic spiral and sliding flutter on slack line.",
      "Corrosion-proof marine clear coat withstands toothy offshore pelagics.",
    ],
  },
  {
    id: "jig-head",
    name: "Jig Head",
    tag: "Terminal // Tungsten",
    subtitle: "Dense 97% tungsten heads for extreme bottom sensitivity",
    description:
      "Precision terminal jigheads engineered with low-profile hydrodynamics and chemically sharpened forged hooks. Delivers instant tactile telegraphy through the rod blank upon substrate contact.",
    subcategories: [
      "Football Rock Dragging Heads",
      "Bullet Weedless Heads",
      "Swimbait Screw-Lock Heads",
      "Stand-Up Ned Presentation Heads",
    ],
    specs: {
      action: "Precision Substrate Presentation",
      depth: "1-60 ft",
      targetSpecies: "Bass, Walleye, Crappie, Inshore Redfish",
      coreMaterial: "97% Dense Sintered Tungsten",
      hardware: "Forged 3X Carbon Steel Needle Hook",
    },
    features: [
      "Substantially smaller profile than lead for fewer snags in heavy rock.",
      "Dual-barb wire bait-keeper locks soft plastics securely without tearing.",
      "Precision eyelet angle maintains horizontal swim posture.",
    ],
  },
  {
    id: "assist-hook",
    name: "Assist Hook",
    tag: "Terminal // Rigging",
    subtitle: "Zero-leverage braided Kevlar terminal hook systems",
    description:
      "Hand-spliced heavy-duty assist rigs built on high-strand Kevlar braided core. Eliminates fish leverage during violent head-shakes, dramatically reducing lost fish during vertical battles.",
    subcategories: [
      "Slow Pitch Twin Assist Hooks",
      "Heavy Offshore Single J-Hooks",
      "Wire-Core Tooth-Resistant Rigs",
      "UV Tinsel Flasher Assist Hooks",
    ],
    specs: {
      action: "Free-Swinging Zero-Leverage Catch",
      depth: "All Depths (Offshore & Shore)",
      targetSpecies: "Tuna, GT, Grouper, Monster Trevally",
      coreMaterial: "Hand-Spliced Japanese Kevlar PE Core",
      hardware: "Solid Seamless Forged Stainless Ring",
    },
    features: [
      "Seamless welded stainless ring tested to over 300 lbs tensile strain.",
      "Conical needle points penetrate instantly under light rod pressure.",
      "Luminous UV-active binding thread attracts strikes in deep, dark water.",
    ],
  },
];

/** "Frog Lure" -> "Frog [Lure]": the last word of a name wears the plate (see Tide). */
function plateLastWord(name: string): string {
  const words = name.split(" ");
  words[words.length - 1] = `[${words[words.length - 1]}]`;
  return words.join(" ");
}

/** A tile's name with its last word on the plate. The plate stays closed until the tile is touched (categories.css). */
function TileName({ name }: { name: string }) {
  const words = name.split(" ");
  const last = words.pop();
  return (
    <>
      {words.length ? `${words.join(" ")} ` : null}
      <Mark>{last}</Mark>
    </>
  );
}

/** Names the section (the catalog heading, which is in the page even while the card is closed). */
const TITLE_ID = "categories-title";
const MODAL_TITLE_ID = "category-modal-title";

/** The footage opens to the whole screen, so it has to be sharp at the viewport's width. */
const viewportWidth = () => document.documentElement.clientWidth;

/**
 * Where the hero lands: a portrait card of water that opens to fill the screen.
 *
 * The section is a tall track with a sticky stage in it (src/styles/categories.css),
 * so scrolling opens the card with no JavaScript pinning: the white preview card
 * shrinks away, the card grows to the whole screen (the water with it), and the
 * eight categories arrive on frosted glass. The scrub is one GSAP timeline
 * (lib/animations/categoriesTimeline.ts) that starts when the browser is idle.
 * Without script, with reduced motion, or if the scripts cannot load, the same
 * elements lay out as a plain block: the catalog on the water, nothing hidden.
 *
 * The section is also the curtain that slides up over the hero (.story-sheet), and
 * the hero's timeline finds it by its id.
 */
export function ProductCategories() {
  const trackRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  /** The tile that opened the inspector, so focus can go back to it. */
  const openerRef = useRef<HTMLElement | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);
  /** The inspector is on its way out (it leaves a little faster than it came). */
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  /** Close the inspector: play its exit first, unless the visitor asked for less motion. */
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSelectedCategory(null);
      return;
    }
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => {
      setSelectedCategory(null);
      setClosing(false);
      closingRef.current = false;
    }, 220);
  }, []);
  const { panelRef, videoRef, posterWanted, enabled, toggle } = useLoopingVideo(
    CATEGORIES_VIDEO.renditions,
    viewportWidth,
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let cancelled = false;
    let teardown: (() => void) | undefined;

    // GSAP is not needed to paint anything (the card is CSS), so it loads when the browser is idle
    const cancelIdle = whenIdle(() => {
      void (async () => {
        let loaded;
        try {
          loaded = await Promise.all([import("gsap"), import("@/lib/animations/categoriesTimeline")]);
        } catch {
          // the opening cannot run: lay the section out as a plain block instead of leaving the catalog hidden
          track.setAttribute("data-static", "");
          track.querySelectorAll("[data-tide-manual]").forEach((el) => el.setAttribute("data-inview", ""));
          return;
        }
        if (cancelled) return;

        const [{ default: gsap }, { createCategoriesTimeline }] = loaded;
        const mm = gsap.matchMedia();
        // reduced motion: no timeline, and the CSS shows the plain block
        mm.add("(prefers-reduced-motion: no-preference)", () => createCategoriesTimeline({ track }));
        teardown = () => mm.revert();
      })();
    });

    return () => {
      cancelled = true;
      cancelIdle();
      teardown?.();
    };
  }, []);

  // the inspector: Escape closes it, Tab stays inside it, and focus goes back to the tile
  useEffect(() => {
    if (!selectedCategory) return;
    const dialog = dialogRef.current;
    const opener = openerRef.current;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [selectedCategory, requestClose]);

  // the inspector opens from the tile that was pressed: set its transform origin before it first paints
  useLayoutEffect(() => {
    const panel = modalRef.current;
    const opener = openerRef.current;
    if (!selectedCategory || !panel || !opener) return;
    const from = opener.getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    panel.style.setProperty("--ox", `${from.left + from.width / 2 - to.left}px`);
    panel.style.setProperty("--oy", `${from.top + from.height / 2 - to.top}px`);
  }, [selectedCategory]);

  return (
    <section
      id={SECTION_IDS.categories}
      ref={trackRef}
      aria-labelledby={TITLE_ID}
      className="cat-track story-sheet relative bg-page"
    >
      {/* Wave curtain transition from the hero into categories */}
      <svg
        className="story-edge"
        viewBox="0 0 1440 96"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M0 96V60C140 14 290 8 440 38C590 68 730 94 910 74C1090 54 1210 4 1330 14C1385 19 1420 34 1440 46V96Z" />
      </svg>

      {/* Pinned full-viewport stage */}
      <div className="cat-stage">
        {/* the hero's water, clearing into the page, around the card */}
        <WaterLight variant="top" />

        {/* its shadow, a layer of its own: the frame's clip-path would cut a shadow off */}
        <div className="cat-shadow" data-cat="shadow" aria-hidden="true" />

        {/* The card: a window cut in the whole stage, portrait while closed, the whole screen when open. The water is its background. */}
        <div className="cat-frame" data-cat="frame">
          <CategoryWater panelRef={panelRef} videoRef={videoRef} posterWanted={posterWanted} />

          {/* Full catalog: frosted glass over the water, unseen until the card has opened */}
          <div className="cat-catalog" data-cat="catalog">
            <div className="page-container cat-catalog__inner" data-cat="catalog-inner">
              {/* Top bar of the catalog: the headline, with its explainer stacked under it (roomy screens only) */}
              <div className="mb-4 border-b border-line pb-4 md:mb-6 md:pb-6">
                {/* manual: it starts when the card has opened (categoriesTimeline), not when the page scrolls */}
                <Tide
                  as="h2"
                  id={TITLE_ID}
                  className="cat-catalog__title display-type text-ink"
                  text="Tackle [Architecture]."
                  drop
                  manual
                />
                <p className="cat-catalog__lede mt-3 max-w-prose text-base text-ink-soft">
                  Engineered lure and terminal systems designed for maximum hydrodynamics,
                  uncompromising hook-up conversion, and predatory triggers.
                </p>
              </div>

              {/* 8 Category Bento Grid: the tiles tighten on a small or short screen (categories.css) so all eight stay in one screen */}
              <div className="cat-grid">
                {CATEGORIES.map((cat, idx) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={(event) => {
                      openerRef.current = event.currentTarget;
                      setSelectedCategory(cat);
                    }}
                    className="cat-card group relative overflow-hidden rounded-2xl border border-line text-left focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    {/* Index & Tag */}
                    <div className="flex items-center justify-between text-xs text-ink-muted">
                      <span className="font-bold tracking-wider tabular-nums">0{idx + 1}</span>
                      <span className="cat-card__more rounded-md border border-line/60 bg-page px-2 py-0.5 text-xs font-medium tracking-wide">
                        {cat.tag}
                      </span>
                    </div>

                    {/* Title & Preview */}
                    <div>
                      <h3 className="cat-card__name display-type text-ink">
                        <TileName name={cat.name} />
                      </h3>
                      <p className="cat-card__more mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                        {cat.subtitle}
                      </p>
                    </div>

                    {/* Subcategories tags & action */}
                    <div className="cat-card__foot">
                      <div className="cat-card__more flex flex-wrap gap-1.5">
                        {cat.subcategories.slice(0, 2).map((sub) => (
                          <span
                            key={sub}
                            className="rounded bg-page px-2 py-0.5 text-xs text-ink-muted"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold tracking-wider text-ink uppercase">
                        <span>Inspect Specs</span>
                        <ArrowRightIcon
                          size={14}
                          weight="bold"
                          aria-hidden="true"
                          className="text-accent transition-transform duration-300 group-hover:translate-x-1"
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* The white card on the water: shrinks away as the card opens */}
          <div className="cat-preview" data-cat="preview">
            <p className="cat-preview__badge">
              <span className="cat-preview__dot" aria-hidden="true" />
              System 02 // Products
            </p>

            <div>
              <Tide
                as="p"
                className="cat-preview__title display-type"
                text="Engineered|Tackle|[Categories]."
                drop
              />
              <p className="cat-preview__sub">
                Scroll to expand the complete 8-system architecture
              </p>
            </div>

            <p className="cat-preview__foot">
              <span>08 Master Categories</span>
              <ArrowUpRightIcon size={16} weight="bold" aria-hidden="true" />
            </p>
          </div>

          <CategoryWaterToggle enabled={enabled} onToggle={toggle} />
        </div>
      </div>

      {/* Interactive Category Inspector Modal */}
      {selectedCategory && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={MODAL_TITLE_ID}
          data-closing={closing ? "" : undefined}
          className="cat-modal fixed inset-0 flex items-center justify-center p-4 md:p-8"
        >
          {/* Backdrop */}
          <div
            className="cat-modal__scrim fixed inset-0 bg-brand-dark/60 backdrop-blur-md transition-opacity"
            onClick={requestClose}
          />

          {/* Modal Container: dvh so it fits the visible screen as browser bars come and go, and the page behind does not scroll at its end */}
          <div
            ref={modalRef}
            className="cat-modal__panel relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-3xl border border-line bg-page p-6 [overflow-wrap:anywhere] md:p-10 shadow-2xl"
          >
            {/* Close Button: a zero-height sticky row (categories.css), so it stays in reach however far the dialog is scrolled and takes no room */}
            <div className="cat-modal__close-row">
              <button
                ref={closeRef}
                type="button"
                onClick={requestClose}
                aria-label="Close modal"
                className="tide-btn relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-page-alt text-ink"
              >
                <XIcon size={20} weight="bold" />
              </button>
            </div>

            {/* Modal Header (the right padding keeps a long name from running under the close button) */}
            <div className="pr-14">
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-ink uppercase">
                <CrosshairIcon size={14} weight="bold" className="text-accent" />
                <span>{selectedCategory.tag}</span>
              </div>
              <Tide
                as="h3"
                id={MODAL_TITLE_ID}
                className="display-type mt-2 text-3xl md:text-4xl text-ink"
                text={plateLastWord(selectedCategory.name)}
                inview
              />
              <p className="mt-2 text-sm text-ink-soft font-medium">
                {selectedCategory.subtitle}
              </p>
            </div>

            {/* Description */}
            <div className="mt-6 border-t border-line pt-6">
              <p className="text-base leading-relaxed text-ink-soft">
                {selectedCategory.description}
              </p>
            </div>

            {/* Subcategories Listing */}
            <div className="mt-6">
              <h4 className="text-xs font-bold tracking-wider text-ink uppercase">
                Product Line Subcategories
              </h4>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {selectedCategory.subcategories.map((sub) => (
                  <li
                    key={sub}
                    className="flex items-center gap-2 rounded-xl border border-line bg-page-alt/50 px-3.5 py-2 text-sm font-semibold text-ink"
                  >
                    <CheckIcon size={14} weight="bold" className="text-accent" />
                    <span>{sub}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Technical Specifications Sheet */}
            <div className="mt-6">
              <h4 className="text-xs font-bold tracking-wider text-ink uppercase">
                Engineering Specifications
              </h4>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-page-alt/30 p-3">
                  <span className="text-ink-muted">Action Dynamics</span>
                  <p className="mt-1 font-bold text-ink">{selectedCategory.specs.action}</p>
                </div>
                <div className="rounded-xl border border-line bg-page-alt/30 p-3">
                  <span className="text-ink-muted">Operating Depth</span>
                  <p className="mt-1 font-bold text-ink">{selectedCategory.specs.depth}</p>
                </div>
                <div className="rounded-xl border border-line bg-page-alt/30 p-3">
                  <span className="text-ink-muted">Core Composition</span>
                  <p className="mt-1 font-bold text-ink">
                    {selectedCategory.specs.coreMaterial}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-page-alt/30 p-3">
                  <span className="text-ink-muted">Terminal Hardware</span>
                  <p className="mt-1 font-bold text-ink">
                    {selectedCategory.specs.hardware}
                  </p>
                </div>
              </div>
            </div>

            {/* Key Engineering Features */}
            <div className="mt-6 border-t border-line pt-6">
              <h4 className="text-xs font-bold tracking-wider text-ink uppercase">
                Engineered Performance Features
              </h4>
              <ul className="mt-3 space-y-2">
                {selectedCategory.features.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-start gap-2.5 text-sm text-ink-soft leading-relaxed"
                  >
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action CTA */}
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={requestClose}
                className="tide-btn relative flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-xs font-bold tracking-wider text-page uppercase"
              >
                <span>Done Viewing</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
