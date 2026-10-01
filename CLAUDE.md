# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server on localhost:3000
npm run build    # production build
npm run lint     # eslint
```

No test suite configured yet.

## Architecture

**Mechaavo customer-facing landing page** — Next.js 16 App Router, React 19, Tailwind v4, GSAP 3.

### Page structure

Single route: `app/page.tsx` → `MechaavoHero` + `BrandStory`. Sections and their ids live in `lib/config/sections.ts` (`#story`, `#principles`, `#commitment`); the nav links and the hero CTA come from the same file so no two links share a target.

### Theme, color, type

The site has one theme: **white** (client decision). Three layers, each in one place:

- `src/styles/theme.css` is the **only** file allowed to contain raw color values — eight tokens total.
- `src/styles/roles.css` maps *roles* (`--page`, `--page-alt`, `--ink`, `--ink-soft`, `--ink-muted`, `--line`, `--accent`, `--on-accent`) onto those tokens. Components use roles (`bg-page`, `text-ink`, `border-line`, `bg-accent`) rather than naming dark or white, so re-theming is a change in this one file. `globals.css` exposes roles and tokens to Tailwind through `@theme inline`; Tailwind's default palette and stock shadows are wiped (`--color-*`, `--shadow-*: initial`).
- Tailwind scans only `app/`, `components/` and `lib/` (`@source` in `globals.css`, `source(none)`): scanning the repo would pull the example classes in `.agents/` (raw `rgba()` shadows) into the compiled CSS. After a build, the compiled CSS should hold only the eight token hexes (plus Tailwind's `#0000` = transparent).
- Canvas code reads the same tokens at runtime via `lib/theme/brand.ts` (`readBrandPalette()`: `alpha()`, `solid()`, `rgb()`), which resolves the CSS custom properties. That file holds the one `rgba(` string builder.
- Type is Raleway only, configured in `lib/config/fonts.ts` (`next/font/google`, variable font, `--font-raleway`); `globals.css` maps `--font-sans` to it. There is no other font and no mono. Raleway's default digits are old-style, so the body sets `font-variant-numeric: lining-nums`.
- The logo (`public/images/mechaavo-logo.png`, off-palette colors) is rendered only as a CSS mask filled with `--ink` via `components/brand/BrandLogo.tsx`.

### Hero system

The hero is a cinematic, scroll-driven underwater scene (bright, sunlit water on the white page). Three concerns are kept deliberately separate:

1. **DOM + GSAP (`lib/animations/heroTimeline.ts`)** — one pinned `ScrollTrigger` timeline (100 units long). It tweens DOM elements (copy, rays, haze, camera push-in) and the shared `HeroScene`. All elements are located by `data-hero="<key>"` attributes, not React refs or class names. It deliberately does **not** drive the fish or the lure's own motion.

2. **Canvas engine (`lib/underwater/engine.ts`)** — framework-free. Reads `HeroScene` every rAF tick; never touches React state. Two stacked canvases (`UnderwaterCanvas.tsx`): a fish is drawn on whichever side of the lure's plane (`Z_LURE` in `pose.ts`) it is on, so circling fish pass behind the lure and then in front of it. Far foreground fish are drawn into a small buffer and upscaled (cheap depth-of-field blur): upscale only the drawn region with `imageSmoothingQuality = "low"` — a full-screen "high" resample cost ~70 ms a frame at 2x. Frame order: step the lure rig and write it to the DOM, measure the lure's anchors, step the fish against that, react to bites, draw.

3. **`HeroScene` (`lib/underwater/story.ts`)** — plain mutable object (never React state). The timeline writes it; the engine reads it. Properties: `story` (0–1 master progress), `engage`, `flow`, `calm`, `zoom`, `descend`, `copy` (1 while the headline is up; fish fade under it).

**Fish are time-based, not scrubbed.** Scroll only decides *what* the primary fish is doing (`story` thresholds in `primaryFish.ts`, with hysteresis); every move is made at the fish's own speed in body lengths per second, so slow scroll, fast flicks, pauses and scrolling back all look right.
- Ambient fish (`fish.ts`): lane crossers (far/mid/near, some kick-and-glide), baitfish schools (leader plus lagging followers, scatter on the strike), and "visitors" on tilted loops around the lure. Speeds are 0.45–2.8 body lengths/s and the tail beat follows speed. Pitch is clamped (~21° ambient, ~29° primary); turns are depth turns (foreshortened), never vertical flips.
- Primary fish (`primaryFish.ts`): `patrol → notice → inspect → circle → windup → strike → hooked`, plus `release` when scrolling back. If scroll runs ahead it hurries instead of skipping. The fight (head shake, runs, S-bend) feeds the lure rig (`pull`, `shake`).
- `lib/underwater/motion.ts` has the shared helpers (damping, rate-limited turns, springs). Headless checks of the motion live in the session scratchpad, not the repo; the properties they enforce are above.

**Lure rig (`lib/underwater/lureRig.ts`).** The engine owns the lure's `pull`, `idle` and `shake` DOM layers plus the jointed parts of `LureArt.tsx` (mid, tail, two hooks, specular band, cast shadow). It is a damped pendulum about the nose (current, rod-tip twitch every 6–10 s, bites, a hooked fish's pull), with the body following with lag. Writes are CSS transforms only (compositor), and anchors ride inside the parts that move them so the fish and the line stay on the real hook. Never animate those layers from GSAP.

**Load order matters for performance.** The headline, nav, supporting copy and lure arrive with CSS keyframes in `src/styles/underwater.css` (transform-only on the text). GSAP/ScrollTrigger and the canvas engine are dynamically imported and started when the browser is idle (`lib/utils/idle.ts`), and the caustic tile is built in slices. Do not move the arrival back into GSAP or statically import either. On a throttled phone the Largest Contentful Paint is the tagline re-rendering when Raleway swaps in, so keep first-load bytes and early main-thread work low.

**Layout.** `.hero-stage` (nav, copy, lure, captions) shares `.page-container`'s max-width and gutters (`--page-max`, `--page-pad` in `globals.css`), so the hero's left edge lines up with every section below it; the water stays full-bleed. Layer order lives in the `--z-*` scale at the top of `underwater.css`; never hard-code a z-index. Headline voice is `.display-type` (shared by hero, statement and story headings).

`MechaavoHero` owns the `scene` object (via `useState` so it's stable) and calls `createHeroTimeline` inside `gsap.matchMedia`. Rebuilds when the layout switches between *split* (landscape) and *stacked* (phones and any portrait viewport, incl. tablets — `STACKED_QUERY` in `lib/underwater/quality.ts`, which must stay in sync with the media query in `src/styles/underwater.css`); skipped entirely for `prefers-reduced-motion` (renders one still frame instead, lure at rest).

### Lure asset

`lib/hero/lureConfig.ts` defines the expected path (`public/images/mechaavo-hero-lure.png`), anchor fractions and the fishing-line angle. `lureAsset.server.ts` reads only the PNG header at build time and returns `null` if the file is absent or its color type cannot carry alpha; `HeroProduct` then probes the four corners client-side and rejects a boxed (opaque-corner) photo. Either way the fallback is the procedural jointed lure in `components/hero/LureArt.tsx` — a boxed image is never shown. A real cut-out keeps the whole-lure physics and a drop shadow; the joints and hooks only exist on the vector art. When a real product cut-out lands, retune `LURE_ANCHORS` in `lureConfig.ts` to match.

### Story section and video

`components/showcase/BrandStory.tsx` holds three sections with three different layouts, each text block at most 25 words. The water footage (`components/showcase/StoryVideo.tsx`) is a Pexels clip stored as **grayscale** in `public/videos/` (720p, 1080p, 4K, poster); `src/styles/story.css` tints it with tokens, so the file carries no color. Which rendition a screen gets is decided in `lib/config/media.ts` (4K only for large or dense displays, lightest for data-saver). Nothing downloads until the panel is within ~400 px of the viewport; it plays only while visible, stays on its poster under reduced motion, and always has a pause/play button. Source, licence and the exact ffmpeg script (`docs/encode-story-video.sh`) are in `docs/media-credits.md`.
