/**
 * The eight product categories: the catalog the tiles (components/showcase/CategoryCard.tsx) and the
 * inspector dialog (CategoryInspector.tsx) are made from. Copy is the client's; the spec claims in it
 * (distances, strengths, material percentages, depth ranges) still need their confirmation before launch.
 * The photo of each is keyed by `id` in lib/config/media.ts.
 */

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
