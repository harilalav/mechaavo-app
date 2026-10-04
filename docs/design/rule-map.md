# Rule map: where every skill rule landed

This is the cross-verification, done once. Each taste pre-flight item (Section 14 of `.agents/skills/design-taste-frontend/SKILL.md`) and each ui-ux-pro-max rule (`references/quick-reference.md`, `references/pro-rules.md`) is mapped to how it is enforced in this repo, so a change needs the gates in `docs/DESIGN-GUIDELINES.md` section 13, not another reading of the skills.

**Enforced by**
- `lint:<id>` a rule in `scripts/design-check.mjs` (`npm run design:lint`, also run by the edit hook)
- `G<n>` a gate in `scripts/design-sweep.mjs` (`npm run design:sweep`), see `docs/design/verification.md`
- `LH` Lighthouse (mobile and desktop), see `verification.md`
- `plan` judged at plan time through the plan card (section 12 of the guidelines); no mechanical check exists
- `D<n>` a recorded deviation (section 14 of the guidelines)
- `n/a` does not apply to this site, with the reason

## Taste skill, Section 14 pre-flight

| # | Item | Here | Enforced by |
|---|---|---|---|
| 1 | Brief inference declared | design read in guidelines section 2, one line in every report | plan |
| 2 | Dial values explicit | variance 7, motion 8 (hero) / 5, density 3 | plan |
| 3 | Design system or honest aesthetic | Tailwind v4 + native CSS; glass is a labelled approximation | plan |
| 4 | Redesign mode and audit | greenfield with a locked brand; n/a | n/a |
| 5 | Zero em dashes | hyphen, comma or two sentences | lint:dash, G9 |
| 6 | Page theme lock | one white theme, no inverted section (the story water is a tint of the same theme) | D4, plan |
| 7 | Colour consistency lock | eight tokens through roles; compiled CSS holds only the token hexes | lint:raw-color, final CSS sweep in verification.md |
| 8 | Shape consistency lock | square page; rounded categories family | D7, plan |
| 9 | Button contrast | ink on the blue plate 8:1; white on dark ink button | LH (color-contrast), pixel sampling for text on glass |
| 10 | CTA never wraps | `white-space: nowrap` | G3 |
| 11 | Form contrast | no forms | n/a |
| 12 | Serif discipline | Raleway only | D8 |
| 13 | Premium-consumer palette ban | client palette is blue, white, ink | n/a |
| 14 | Italic descender clearance | no italic display type | n/a (guidelines section 6 if it ever appears) |
| 15 | Hero fits the viewport | headline, tagline, CTA, sound button inside the screen, no overlaps | G3 |
| 16 | Hero top padding at most `pt-24` | 5rem (stacked 5.6rem) | plan |
| 17 | Hero stack at most 4 text elements | 5 plus 3 captions | D1 |
| 18 | Eyebrow count | at most ceil(sections / 3) | G13 (lint:eyebrow-count is info) |
| 19 | Split-header ban | catalog header stacks the explainer under the headline | plan |
| 20 | Zigzag cap | 5 sections, 5 layout families | plan |
| 21 | No duplicate CTA intent | no two links share a target (the footer repeats no section link; social profiles live only in the footer) | lint:link-unique |
| 22 | Logo wall is logo only | no logo wall | n/a |
| 23 | Bento background diversity | eight equal tiles by brief | D7 |
| 24 | Trusted-by under the hero | none | n/a |
| 25 | Copy self-audit | reread every new string; content claims need a source | plan |
| 26 | Motion motivated | one sentence per animation | plan |
| 27 | Marquee at most one | none | plan |
| 28 | Nav on one line, at most 80 px | bar measured | G2 |
| 29 | Layout-family repetition | each section its own family | plan |
| 30 | Bento rhythm and exact cell count | 8 items, 8 tiles | D7 |
| 31 | Long lists use the right component | tiles and chips, no 10-row hairline lists | plan |
| 32 | Real images, no div screenshots, no decorative SVG | procedural art is the brief | D5, D9, lint:hand-svg |
| 33 | No pills on images | the badge sits on the white card, not on a photo | plan |
| 34 | No photo-credit captions | none | plan |
| 35 | No version footers | none | plan |
| 36 | No micro-meta sentences under eyebrows | none | plan |
| 37 | No decoration strip at the hero foot | the three story captions are brief-locked | D1, D6 |
| 38 | No floating top-right sub-text | none | plan |
| 39 | No scoring bars | none | plan |
| 40 | No locale or weather strips | none | plan |
| 41 | No scroll cues | the preview subtitle is brief-supplied | D6 |
| 42 | No version labels in the hero | "System 01" is brief-supplied | D6 |
| 43 | No section-numbering eyebrows | "System 0N" is brief-supplied | D6 |
| 44 | No decorative dots | the badge dot is brief-supplied | D6 |
| 45 | No `border-t` plus `border-b` on every row | principles use `divide-y` over three rows only | plan |
| 46 | Content density | blocks at most 25 words | plan |
| 47 | Quotes at most 3 lines | no quotes | n/a |
| 48 | Motion claimed means motion shown | the page moves | plan |
| 49 | Sticky-stack and horizontal-pan skeletons | CSS sticky tracks, not GSAP pins | D3 |
| 50 | No scroll listener | ScrollTrigger, IntersectionObserver | lint:scroll-listener |
| 51 | Reduced motion wrapped | gates in CSS and in `gsap.matchMedia` | G8 |
| 52 | Dark mode tokens | white only | D4 |
| 53 | Mobile collapse explicit | one column under 768 px, in the component | G1, G3, plan |
| 54 | Viewport stability: `dvh`, never `h-screen` | `svh` for pinned stages, `dvh` for dialogs | D2, lint:vh-unit |
| 55 | `useEffect` cleanups | every effect returns its teardown | plan, `npm run lint` |
| 56 | Empty, loading, error states | poster, plain-layout fallback, load-failure path | plan |
| 57 | Cards only where hierarchy needs them | tiles are brief-locked | D7 |
| 58 | Icons from an allowed library | Phosphor | lint:hand-svg |
| 59 | Motion isolated in client leaves | `"use client"` leaves only | plan |
| 60 | No AI tells | guidelines section 10 | plan, lint:dash, lint:emoji |
| 61 | Core Web Vitals | LCP, CLS, INP budgets | LH, G7 |
| 62 | One design system | none mixed | plan |

## ui-ux-pro-max, quick reference

### 1. Accessibility (critical)

| Rule | Here | Enforced by |
|---|---|---|
| color-contrast, color-accessible-pairs, contrast-readability | 4.5:1 text, 3:1 large and UI | LH, pixel sampling |
| focus-states | 2 px ink ring (white on footage) | G11 |
| alt-text | every `img` has `alt` (empty when decorative) | G15, LH |
| aria-labels, icon-context | Phosphor icons `aria-hidden`, controls named | LH, plan |
| keyboard-nav | Tab order is DOM order, all controls reachable | G11 |
| form-labels | no forms | n/a |
| skip-links | skip link to the hero copy, first Tab stop | G11 |
| heading-hierarchy | one h1, no skipped level | G12 |
| color-not-only | state carries an icon or word | plan |
| dynamic-type | rem units; 200% text run | G6 (200% run, warning) |
| reduced-motion | no track, no loops | G8 |
| voiceover-sr | statement stays in the page (opacity, not visibility) | LH, plan |
| escape-routes | Escape and visible close on the dialog | G3, plan |
| keyboard-shortcuts, dragging-alternative, consistent-help, redundant-entry, accessible-authentication, contextual-live-badge-updates | none of these exist on the site | n/a |
| focus-not-obscured | nothing sticky over focus | G11 |
| focus-not-obscured-enhanced, focus-appearance (AAA) | not targeted | n/a |
| web-target-size | 24 px pointer, 44 px touch | G4 |
| auto-rotation-controls | looping video has a pause control; loops stop under reduced motion | G15, G8 |

### 2. Touch and interaction (critical)

| Rule | Here | Enforced by |
|---|---|---|
| touch-target-size, touch-spacing, no-precision-required, touch-density | 44 px, 8 px apart on touch | G4 |
| hover-vs-tap | hover never carries information; `:hover` gated | lint:hover-gate |
| cursor-pointer, tap-delay, press-feedback | `cursor: pointer`, `touch-action: manipulation`, `:active` push | plan |
| loading-buttons, error-feedback | no async buttons or forms | n/a |
| gesture-conflicts, standard-gestures, system-gestures, gesture-alternative, swipe-clarity, drag-threshold | vertical scroll only; no custom gestures | plan |
| haptic-feedback | web | n/a |
| safe-area-awareness | no `viewport-fit=cover`, no edge-pinned bars | guidelines section 5 |

### 3. Performance

| Rule | Here | Enforced by |
|---|---|---|
| image-optimization, lazy-load-below-fold | `next/image` with `sizes`; posters mount near the viewport | G15, LH |
| image-dimension, content-jumping | width and height or `fill` in a sized parent | G15, G7 |
| font-loading, font-preload | `next/font` (Raleway, swap) | LH |
| critical-css, bundle-splitting, lazy-loading | GSAP and the engine are dynamic imports at idle | plan, LH |
| third-party-scripts | none | plan |
| reduce-reflows, main-thread-budget | transforms only; lite mode sheds load | plan, LH (TBT) |
| virtualize-lists, offline-support | 8 tiles; marketing page | n/a |
| progressive-loading | poster, plain layout | plan |
| input-latency, tap-feedback-speed | INP under 200 ms | LH |
| debounce-throttle | no scroll or resize handlers | lint:scroll-listener |
| network-fallback | data-saver gets the lightest video (`lib/config/media.ts`) | plan |

### 4. Style selection

| Rule | Here | Enforced by |
|---|---|---|
| style-match, consistency, effects-match-style, state-clarity, primary-action | one language; one primary CTA | plan |
| no-emoji-icons | Phosphor; no emoji | lint:emoji |
| color-palette-from-product, dark-mode-pairing | client palette, white only | D4 |
| elevation-consistent | shadows tinted with tokens | lint:raw-color, plan |
| platform-adaptive, system-controls | native `button`, `a`, `dialog` semantics | plan |
| icon-style-consistent | one icon family and weight per context | plan |
| blur-purpose | blur is the glass and the dialog scrim only | plan |

### 5. Layout and responsive

| Rule | Here | Enforced by |
|---|---|---|
| viewport-meta | Next default | LH |
| mobile-first | base then `min-width` | lint:mobile-first |
| breakpoint-consistency | registry 640 / 768 / 1024 / 1280 / 1536 | lint:breakpoint |
| readable-font-size | floors 12 / 14 / 16 | lint:font-floor, G5 |
| line-length-control | `max-w-prose` | plan |
| horizontal-scroll | none, guard disabled while measuring | G1 |
| spacing-scale | 4 px base, Tailwind scale | plan |
| container-width | `.page-container` | G14 |
| z-index-management | tokens only | lint:z-literal |
| fixed-element-offset | no fixed bars except the dialog | G3, G11 |
| scroll-behavior | nested scroll only in dialogs: nothing in the pinned categories card scrolls by itself, its content slides under the page's scroll; the last tile can be brought on screen | G3, G17 |
| viewport-units | `svh`, `dvh`, never `vh` | lint:vh-unit |
| orientation-support | landscape screens in the matrix | G3 |
| content-priority | the lede folds away on phones | plan |
| visual-hierarchy | size, spacing, contrast | plan |
| compact-label-overflow, chip-collection-reflow | chips wrap, labels not clipped | G6 |

### 6. Typography and colour

| Rule | Here | Enforced by |
|---|---|---|
| line-height, line-length, font-scale, weight-hierarchy, letter-spacing, number-tabular, whitespace-balance | guidelines section 6 | plan |
| font-pairing | Raleway only | D8 |
| text-styles-system | roles and floors | G5 |
| color-semantic | roles, tokens | lint:raw-color |
| color-dark-mode | white only | D4 |
| color-not-decorative-only | icon or text with colour | plan |
| truncation-strategy | wrap, do not truncate (tile subtitles clamp to 2 lines by design) | G6 |
| heading-line-balance | `text-wrap: balance` | plan |
| long-token-wrapping | `overflow-wrap: anywhere` in dialogs | plan |

### 7. Animation

| Rule | Here | Enforced by |
|---|---|---|
| transform-performance, layout-shift-avoid | transform and opacity only | lint:anim-layout, G7 |
| duration-timing, easing, motion-consistency, exit-faster-than-enter, stagger-sequence | shared tokens, one easing | plan |
| excessive-motion, motion-meaning, hierarchy-motion | one sentence per animation | plan |
| state-transition, fade-crossfade, scale-feedback, opacity-threshold, modal-motion, shared-element-transition, continuity | the dialog opens from its tile, the sheet curtains over the hero | plan |
| parallax-subtle, spring-physics | engine physics; reduced motion removes the track | G8 |
| interruptible, no-blocking-animation, cancellable-state-transitions | scrubs reverse; nothing blocks input | plan |
| loading-states | poster stands in | plan |
| gesture-feedback, navigation-direction | none | n/a |

### 8. Forms and feedback

All form rules (input-labels, error-placement, submit-feedback, required-indicators, toast-*, confirmation-dialogs, input-helper-text, disabled-states, progressive-disclosure, inline-validation, input-type-keyboard, password-toggle, autofill-support, undo-support, success-feedback, error-recovery, multi-step-progress, form-autosave, sheet-dismiss-confirm, error-clarity, field-grouping, read-only-distinction, focus-management, error-summary, touch-friendly-input, destructive-emphasis, aria-live-errors, contrast-feedback, timeout-feedback): **n/a, the site has no forms.** `empty-states`: plan (the plain-layout fallbacks).

### 9. Navigation patterns

| Rule | Here | Enforced by |
|---|---|---|
| overflow-menu, adaptive-navigation | inline from `md`, Menu button below | G2 |
| nav-label-icon | Menu has icon and word | plan |
| navigation-consistency | one nav, one place | G2 |
| deep-linking | every section has an id and a link; a jump dips through a white veil (`SectionJumps`), the URL hash still updates | lint:link-unique, plan |
| modal-escape, modal-vs-navigation | the dialog is an inspector, closes with Escape, X and scrim | G3, plan |
| persistent-nav | the hero nav while the hero is pinned, a slim sticky bar (`SiteNavigation`) from #story on; it steps aside for the hero and the full-screen categories stage | D11 |
| nav-state-active, nav-hierarchy, state-preservation, back-behavior, back-stack-integrity, gesture-nav-support, avoid-mixed-patterns | single route; anchors; one nav in two states (hero nav, then the sticky bar), never both exposed | plan |
| bottom-nav-limit, bottom-nav-top-level, drawer-usage, tab-bar-ios, top-app-bar-android, search-accessible, breadcrumb-web, tab-badge, destructive-nav-separation, empty-nav-state, focus-on-route-change | no such patterns | n/a |

### 10. Charts and data

All chart rules: **n/a, the site has no charts.**

## ui-ux-pro-max, pre-delivery checklist (native-app oriented, web equivalents)

| Item | Here | Enforced by |
|---|---|---|
| Tested at 375 px and in landscape | 27-screen matrix incl. 568 x 320 | G1, G3 |
| Reduced motion and largest text | reduced-motion and 200% text runs | G8, G6 |
| Dark mode contrast | white only | D4 |
| Touch targets 44 pt, nothing behind safe areas | coarse pointer 44 px; no edge bars | G4 |
| No emoji icons, one icon family, brand assets exact, tokens only | Phosphor, logo as supplied | lint:emoji, lint:hand-svg, lint:raw-color |
| Press states do not shift layout | `:active` scale, no neighbour moves | G7 |
| Disabled states, gesture conflicts | no disabled controls; no gestures | n/a |
| Screen reader focus order matches visual order | DOM order is visual order | G11 |
| Scroll content not hidden behind fixed bars | no fixed bars | G3 |
| Small phone, large phone, tablet in both orientations | matrix | G1, G3 |
| Gutters adapt by device | `--page-pad` clamps | G14 |
| 4 / 8 rhythm and readable text measure | plan card | plan |
| Decorative icons hidden, images have alternatives, icon controls named | Phosphor `aria-hidden`; `alt` | G15, LH |
| Sticky UI does not obscure focus | none sticky except the dialog close | G11 |
| Dragging, authentication, forms | none | n/a |
| Auto-rotating content stops and has controls | video pause, loops end under reduced motion | G15, G8 |

## Added with the hero, categories and page-foot pass (2026-10-04)

| Rule | Where it lands | Check |
|---|---|---|
| scroll budget: the scroll between the bite and the catalog stays short (lift 0.4, sheet 2.4, catalog 0.75 screens) | `STORY`, `--hero-screens`, `--cat-screens` | G16 |
| viewport units: a pinned stage paints to `lvh`, lays out against `svh` | `.cat-stage`, `.cat-view` | manual on a device (headless Chrome has no toolbars), geometry by simulation |
| natural motion: heading follows the swim direction, turn rate under the cap, few head flips, clear of the lure | `primaryFish.ts` patrol and circle | `npm run fish:sim` |
| tile photos: decoration inside a tile (`alt=""`), described in the inspector; graded by tokens; never behind text | `CATEGORY_MEDIA`, `.cat-card__photo` | G15, G5, G3 |
| contact details are real before launch | `lib/config/contact.ts` | lint:contact-placeholder (warn, `--strict` fails) |
