# Mechaavo design guidelines

The one place that says how UI is planned, built and checked in this repo. It is the taste skill (`.agents/skills/design-taste-frontend/SKILL.md`) and ui-ux-pro-max already reconciled with the client brief and CLAUDE.md. **Do not re-run the skills to cross-verify a change.** Plan with this file, then run the gates (section 13). Open a skill again only to add a rule when the skill itself changes (`skills-lock.json` hash).

On demand, not loaded every session:
- `docs/design/rule-map.md` where every taste pre-flight item and every ui-ux rule landed: enforced by which check, or which deviation.
- `docs/design/verification.md` the screen matrix, gate thresholds, how to run each tool, known risks, the dated verification log.

## 0. The loop

1. **Plan:** any plan that touches UI starts with the plan card (section 12). Fill it before writing code.
2. **Build:** write the code with sections 3 to 10 already applied. Do not "fix it up in review".
3. **Gate:** `npm run design:lint` always; `npm run design:sweep -- --build` for any layout, CSS or markup change; Lighthouse for visible changes; the scroll layout-shift run for scroll-linked changes.
4. **Report:** one-line design read, gate results, deviations restated by id (section 13).

A `PostToolUse` hook runs the lint on every edit to CSS, TSX or TS under `app`, `components`, `lib`, `src` and feeds failures back. Fix them in the same turn. A deliberate exception goes in `scripts/design-allow.json` with a reason, never silently.

## 1. Order of authority

1. The client brief and the locks in CLAUDE.md: eight-token palette, Raleway only, white theme, logo as supplied, brief-supplied copy, procedural lure and fish, pinned `svh` hero, GSAP.
2. This file.
3. The taste skill.
4. ui-ux-pro-max (its UX rules; its palettes and font pairings are ignored).

A conflict is never skipped silently. It becomes a numbered deviation (section 14) and is restated in the report.

## 2. Design read and dials

**Reading this as:** premium consumer product landing for anglers and tackle buyers, an immersive cinematic-underwater language (brief), leaning toward Tailwind v4 + native CSS + GSAP ScrollTrigger + canvas. Not an official design system; the frosted glass is a labelled web approximation.

**Dials:** DESIGN_VARIANCE 7, MOTION_INTENSITY 8 in the hero and 5 elsewhere, VISUAL_DENSITY 3. Variance 7 means asymmetric and split layouts above `md`, which must collapse to one column under 768 px.

## 3. Screens that must work

- **Smallest supported:** 320 x 480 portrait and 568 x 320 landscape. **Best effort:** 280 wide (foldable cover): no horizontal scroll, no console errors, nothing else gated. **Largest:** 3840 wide.
- Conditions on top of size: 200% zoom, 400% reflow (that is 320 CSS px), 200% text size, reduced motion, no script, forced colours, touch vs hover, coarse vs fine pointer, landscape.
- Test with the height the browser really shows. Mobile and laptop browsers show 100 to 120 px less than the screen (iPhone Safari about 390 x 664, a 1366 x 768 laptop about 1366 x 650). `svh` is that smaller height.
- The full matrix (29 screens, two of them the 360 x 560 and 375 x 548 heights a phone browser really shows) and what each gate measures are in `docs/design/verification.md`.

## 4. Breakpoints and environment queries

Write **mobile-first**: base styles are for the smallest screen, then add `min-width` upward. In Tailwind that is unprefixed, then `sm: md: lg: xl: 2xl:`.

| Name | min-width | rem |
|---|---|---|
| sm | 640 | 40rem |
| md | 768 | 48rem |
| lg | 1024 | 64rem |
| xl | 1280 | 80rem |
| 2xl | 1536 | 96rem |

- Height conditions: `short` is `(max-height: 34rem)`; roomy extras use `(min-height: 46rem)` and `(min-height: 56rem)`.
- Environment queries (always allowed): `(hover: hover)`, `(pointer: coarse)`, `(prefers-reduced-motion: ...)`, `(prefers-reduced-transparency: reduce)`, `(forced-colors: active)`, `(scripting: ...)`.
- **Sanctioned exceptions:** the stacked pair `(max-width: 767px), (max-aspect-ratio: 1/1)` (also `STACKED_QUERY` in `lib/underwater/quality.ts`; the timeline switches layouts with the same rule; extra conditions such as `(scripting: none)` or `(max-height: 34rem)` may be added to each branch), the one `(min-aspect-ratio: 1/1)` and `(max-aspect-ratio: 1/1)` split vs stacked family, and `(max-width: 340px)` for 320 px phones. Nothing else uses `max-width`.
- No other number is a breakpoint. `lib/underwater/quality.ts` tiers (phone, tablet, laptop, desktop, wide) budget the canvas engine; never reuse them for layout.
- Lint: `breakpoint`, `mobile-first`.

## 5. Units, sizing and layout

- **Full-screen stage that is pinned or sticky:** its content is laid out against `100svh` (D2). **Dialogs and sheets:** `max-height: 90dvh`. **Backgrounds that may extend under browser bars:** `lvh`: a pinned stage whose paint is exactly `100svh` shows the white page under it whenever the toolbars are away, so the categories stage is `100lvh` tall and only its water, window and glass paint to that height (the content sits in a `100svh` box, `.cat-view`). **Never `vh`.** Lint: `vh-unit`.
- **Never `100vw` for layout** (it includes the scrollbar). Use `100%`, or container units (`cqw`) when a descendant must size against a container. A `sizes` hint on an image may say `100vw`.
- Text containers use `min-height`, never a fixed `height`. Fixed `height` or `overflow: hidden` on anything that holds text is how text gets clipped at 200% zoom.
- **Column:** every section lives in `.page-container` (`--page-max: 1600px`, `--page-pad: clamp(1.25rem, 6vw, 6.5rem)`). Only water, video and backgrounds are full-bleed. The left edge of hero copy, nav logo, captions and every section's content is the same line (checked to 1.5 px, gate G14). The one exception is a heading plate that hangs into the margin so the text keeps the edge.
- **Grid over flex maths:** multi-column is CSS grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`, `minmax(0, 1fr)`), never `w-[calc(33%-1rem)]`. Text children of flex and grid get `min-w-0`.
- **Collapse rule:** every multi-column or asymmetric layout names its under-768 px fallback in the same component (one column, `px` from `--page-pad`).
- **Spacing:** 4 px base and the Tailwind scale; vertical rhythm tiers `py-24 md:py-36` for sections, `gap-10` to `gap-16` for blocks, `gap-2` to `gap-4` inside components. No odd one-off values.
- **Layout families:** each section its own family (5 sections, 5 families today). No three image-and-text splits in a row, no split header (headline left, explainer right: stack them), no empty grid cell, cards only where elevation carries hierarchy.
- **Measure:** running text at most 65 ch (`max-w-prose`); on phones the gutters keep it at 35 to 60.
- **Images:** `next/image` with `width`/`height` (or `fill` in a sized parent) and a real `sizes`; `priority` only for the LCP image (the nav lockup). **Video:** muted, `playsInline`, `preload="none"`, poster, a labelled pause control, lazy near the viewport (`lib/hooks/useLoopingVideo.ts`). **Canvas:** `pointer-events: none`, DPR capped.
- **Viewport meta** stays Next's default; never set `maximumScale` or `userScalable`. No `viewport-fit=cover`, so safe-area insets are zero and the browser letterboxes in landscape. If that ever changes, anything pinned to an edge uses `max(var(--page-pad), env(safe-area-inset-*))`.

## 6. Type

Raleway only (`--font-sans`), no mono.

| Role | Floor | How it is recognised |
|---|---|---|
| Labels (nav, buttons, badges, tags, captions, kickers) | **12 px** | 3 words or fewer, or uppercase and tracked, or inside a control |
| Secondary text (helper text, dense panel items, tile lines, taglines) | **14 px** | any other short text |
| Running text (paragraphs of 12 words or more) | **16 px** | 14 px only inside `[data-text="secondary"]` |

- **Nothing under 12 px at any width.** The smallest value a `clamp()` can resolve to counts. Lint: `font-floor`; sweep: G5.
- Fluid sizes are `clamp(<rem>, <rem> + <vw>, <rem>)`. A pure `vw` middle value does not follow the user's text size, so new code does not use one.
- Body line-height 1.5 to 1.75, display tight (`.display-type`). Headings `text-wrap: balance`, paragraphs `text-wrap: pretty`, long tokens `overflow-wrap: anywhere`. Uppercase labels track at most 0.24em. Numerals are lining; use `tabular-nums` for index numerals.
- Headings are Tide (CLAUDE.md, Heading system): never colour text by hand. Hero headline at most 2 lines at every width; a CTA label never wraps (`white-space: nowrap`).
- Italic display type is not used. If it ever is, a descender needs `leading-[1.1]` and `pb-1`.

## 7. Targets, input and states

- **Target size:** 44 x 44 px where the pointer is coarse (touch), 24 x 24 px elsewhere (WCAG 2.2 AA), and **8 px between** neighbouring targets on touch. Grow the hit area with padding and an equal negative margin, not by enlarging the visual (the nav links already do). Gate G4.
- **Hover:** every hand-written `:hover` sits inside `@media (hover: hover)`, so a tap never leaves it stuck. Tailwind v4 `hover:` and `group-hover:` are already gated. Never hide information or a control behind hover. Lint: `hover-gate`.
- **Press:** a physical push on `:active` (`scale(0.96)` to `0.98`, tiles `translateY(0) scale(0.98)`), visible within 100 ms, no layout shift. Buttons wear `tide-btn` (CLAUDE.md, Button plate).
- **Focus:** `:focus-visible` shows a 2 px ink ring, white on footage. Never remove an outline without replacing it. Focus must be in view and uncovered (gate G11). The first Tab stop is a skip link that lands on the hero copy (the nav sits inside `main`). Everything must be reachable by Tab from any scroll position: content that is hidden until a scroll step must stay in the tab order and in the accessibility tree (use `opacity`, not `visibility`, and bring it in on focus).
- `touch-action: manipulation` and `cursor: pointer` on custom controls. One intent, one label: no two links share a target and each target id exists (lint `link-unique`).
- Icons: Phosphor only (`@phosphor-icons/react/dist/ssr`), one weight per context, `aria-hidden` when decorative, an accessible name when the icon is the control. Lint: `hand-svg`.
- States: loading, empty and error states exist where data can be missing (the categories section lays out plainly if its scripts fail; video has a poster).

## 8. Layers and overlays

- **z-index only through tokens.** The hero scale is `--z-*` in `underwater.css`, the catalog `--cat-z-*` in `categories.css`, page level `--z-sheet`, `--z-modal`, `--z-veil` and `--z-skip` in `globals.css`. A positive number written inline is a bug. `-1` for a backdrop pseudo-element inside an isolated stacking context is fine. Lint: `z-literal`.
- **Dialog recipe:** `role="dialog" aria-modal="true"` and a label; panel `max-height: 90dvh; overflow-y: auto; overscroll-behavior: contain`; the close button stays reachable while the panel scrolls (sticky); Escape closes; Tab stays inside; focus returns to the opener; a press on the scrim closes. Gate G3 checks the panel fits and the close button is reachable at the end of the content.
- Nested scroll regions only inside dialogs. **Nothing in the pinned categories card scrolls on its own:** a touch that begins on an inner scroller is caught by it and the page does not move (measured: 28 to 251 px of overflow on the real phone heights). A screen too short for all eight tiles has the timeline slide the content up by what does not fit, while the card is held open; the pause button floats over the sliding content. Sweep gates G3 and G17 fail on a scroller or a tile that cannot be reached by scrolling the page.
- Anything that is hidden until a scroll step stays in the tab order and the accessibility tree (opacity, never `visibility` or `display`), takes no pointer input until it is shown, and is brought in by focus (the catalog: `categoriesTimeline.ts`).

## 9. Motion and fallbacks

- Animate `transform` and `opacity` only (plus a registered custom property that is only painted, like `--open` and `--tide-dip`). Never width, height, top, left, margin, padding; never `transition: all`. Lint: `anim-layout`.
- One easing (`--ease-out`), duration tokens by role: feedback 150 to 200 ms, UI 300 ms, panels 420 to 460 ms, long arrivals 700 ms and up. An exit is about 65% of its enter. Animations are interruptible and never block input.
- Every motion must answer "what does this communicate?" in one sentence (hierarchy, story, feedback, state). One hero moment per section; no infinite loops except the brief's (caustics, the sound ring, the pulsing badge dot).
- **No scroll listeners** (`addEventListener("scroll")`): ScrollTrigger, IntersectionObserver or CSS scroll timelines. Lint: `scroll-listener`.
- **Three fallbacks are part of every motion change and tested by gate G8:** `prefers-reduced-motion: reduce` (no track, no loops, content all visible), no script (`(scripting: none)`: every nav link reachable, every section visible), forced colours (system colours, no gradient text, no plates).
- Anything that hides content until script runs is gated by `(scripting: enabled) and (prefers-reduced-motion: no-preference)` and has a CSS failsafe.

## 10. Page rules from the taste skill that apply to every change

- **No em dash or en dash** in anything visible (text, `aria-label`, `alt`, `title`, metadata). Use a hyphen, a comma or two sentences. Lint `dash`, gate G9.
- **Colour:** the eight tokens through roles (`bg-page`, `text-ink`, `border-line`, `bg-accent`); raw values only in `src/styles/theme.css` and the `lib/theme/brand.ts` builder; stock Tailwind colours do not exist here; shadows tinted with tokens; no neon glow, no pure-black shadow. One accent. Lint `raw-color`.
- **Eyebrows** (small uppercase tracked label directly above a heading): at most `ceil(sections / 3)` on the page, the hero counts. Today 2 of 5. Gate G13.
- **Banned unless brief-locked (D6):** decorative dots, scroll cues, version labels, section-number eyebrows, locale or time strips, text strips at the foot of the hero, micro-sentences under eyebrows, pills on photos, photo-credit captions, fake screenshots, fake-precise numbers.
- **Hero:** fits the first screen with the CTA visible (gate G3), headline at most 2 lines, top padding at most `pt-24` (6rem), at most 4 text elements (D1 records the brief's 5).
- **Nav:** one line from `md`, bar at most 80 px (gate G2); on phones a Menu button that works without script. **CTA:** one intent, one label, one line.
- **Shape:** the page is square-cornered; the categories card, preview and tiles (36, 28, 16 px) are the one rounded family (D7). New UI follows the square page unless it lives inside that card.
- **Copy self-audit before shipping:** reread every new visible string; no filler verbs (Elevate, Seamless, Unleash), no invented specs, no cute metaphors that do not parse. Content claims need a real source.
- No AI tells: three equal feature cards, Jane Doe names, "Acme" brands, "Quietly in use at". The eight equal tiles are brief-locked (D7).

## 11. Budgets

- Lighthouse mobile and desktop: accessibility 100, best practices 100; mobile LCP under 2.5 s; CLS under 0.1 and the project holds about 0 including while scrolling (gate G7 fails above 0.01); INP under 200 ms.
- First-load cost: GSAP, ScrollTrigger and the engine stay dynamic imports started at idle (`lib/utils/idle.ts`). No `will-change` except on layers that really animate. No filters on scrolling containers.

## 12. The plan card

Copy this into any plan or spec that touches UI, filled in, before code:

```
Design read: <one line, section 2>            Dials: variance / motion / density
Touches: <sections, components, files>
Per width: base (320-639) | sm | md | lg | xl | 2xl  ->  layout, type sizes, what hides or shows
Flags: stacked | short (<= 34rem tall) | coarse pointer  ->  what changes
Collapse under 768: <fallback>
Targets and hover: <sizes, gated hover, focus order>
Motion: <what it communicates> | reduced: <...> | no script: <...> | forced colours: <...>
Tokens: <roles only> | layer: <z token> | units: <svh/dvh/%>
Deviations: <D-ids, or none>
Gates to run: lint | sweep | lighthouse | scroll CLS
```

**Recipes to copy** (each already satisfies the lint and the gates; the live examples are named):

```
Section shell     <section className="relative isolate overflow-hidden bg-page py-24 md:py-36">
                    <div className="page-container"> ... </div></section>            (BrandStory.tsx)
Fluid type        font-size: clamp(2rem, 1.2rem + 3vw, 4.2rem);                        (never a bare vw)
Hover             .x:focus-visible { ... }  @media (hover: hover) { .x:hover { ... } }  (hero CTA, tiles)
Touch target      .link { padding-block: 0.7em; margin-block: -0.7em; }
                  @media (pointer: coarse) { .link { padding-block: 1.05em; margin-block: -1.05em; } }   (nav links)
Short screen      @media (max-height: 34rem) { /* nav slims, type from svh, lede folds away */ }       (underwater.css)
Grid collapse     grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4   (children min-w-0)
Dialog panel      max-h-[90dvh] overflow-y-auto overscroll-contain, with .cat-modal__close-row sticky
Layer             z-index: var(--z-modal);   (tokens in globals.css; hero --z-*, catalog --cat-z-*)
Image             <Image width={910} height={467} sizes="(min-width: 1024px) 128px, 104px" />   (BrandLogo)
Hidden until scroll   opacity: 0; pointer-events: none; then data-open on the track (categories.css)
```

## 13. Gates, commands, report

| Command | When | What |
|---|---|---|
| `npm run design:lint` | every change | rules `dash emoji raw-color hover-gate vh-unit font-floor z-literal breakpoint mobile-first scroll-listener hand-svg anim-layout important link-unique contact-placeholder` |
| `npm run design:sweep -- --build` | any layout, CSS or markup change | gates G1 to G17 over 29 screens on a production copy at :3150 (never `next build` in the repo: the dev server owns `.next`) |
| `npm run design:sweep -- --only lap-1280,land-568` | while iterating | the same gates on chosen screens against a running copy (`--url`) |
| Lighthouse mobile and desktop | any visible change | the cached binary in `docs/design/verification.md` |
| scroll layout-shift run | any scroll-linked change | part of the sweep on the deep screens (G7) |

`design:lint` also has `--self-test` (the rules against fixtures) and `--list`.

**Report format**, always: (1) `Reading this as: ...` one line, (2) gate results in one line each, (3) every deviation touched, by id and one clause. Say what was not measured (real Safari, real devices).

## 14. Deviation registry

Brief-locked or client-required. Restate by id; do not re-litigate.

| Id | Deviation | Why it stays |
|---|---|---|
| D1 | Hero has 5 text elements (kicker, headline, tagline, lede, CTA) plus 3 story captions (taste cap is 4). The lede already folds away on phones; on a short screen (at most 34rem tall) it and the statement's sub-line fold away too (the sub-line's words close the page in the commitment section) | brief-supplied copy |
| D2 | Pinned hero and stages use `100svh`, not `dvh` | stable under browser bars so the pin never jumps (brief) |
| D3 | GSAP ScrollTrigger, not Motion | brief; one library, never mixed |
| D4 | White theme only, no dark mode, `#ffffff` token | client decision |
| D5 | Procedural lure and fish, not photography | brief |
| D6 | "Mechaavo // System 01", "System 02 // Products", the scroll-cue subtitle, index numerals 01 to 08, the pulsing badge dot | brief-supplied labels |
| D7 | Eight equal category tiles; rounded 36/28/16 px family on a square page | brief; equal-weight categories |
| D8 | Raleway only | client |
| D9 | Hand-drawn SVG: the lure artwork and the swell edge | brief; allowlisted |
| D10 | The stacked and split hero layout queries (aspect-ratio) | shared with the JS timeline |
| D11 | The nav is one nav in two states, not a bar on every screen: the hero nav while the hero is pinned (four links since Contact was added), a slim sticky bar (`SiteNavigation`, 64 px, 52 px on short screens, five links) from #story on | a bar over the pinned hero would cost height on short screens, and over the full-screen categories stage it would cover the catalog's header; a reader past those two always has the links |

**Open content risk:** the `CATEGORIES` spec claims (casting distance, tensile strength, material percentages, depth ranges) look invented and need client confirmation before launch.

## 15. When a rule changes

Change the rule here, the constant in the script (`REGISTRY` in `scripts/design-check.mjs`, `T` in `scripts/design-sweep.mjs`) and the row in `docs/design/rule-map.md` together, then run `npm run design:lint -- --self-test`. A rule with no check is a wish: add the check or mark it manual in the rule map.
