# Verification

How the gates in `docs/DESIGN-GUIDELINES.md` section 13 are run, what they measure, and the dated record of results. Read on demand.

## Screen matrix (29 screens)

CSS pixels; the height is what the browser really shows (bars included), not the device's screen height. `deep` screens also get reduced motion, forced colours, a 200% text run, the scrolled layout-shift run and (non-touch) a classic 15 px scrollbar run.

| Id | Size | DPR | Touch | Note |
|---|---|---|---|---|
| phone-fold | 280 x 653 | 3 | yes | foldable cover, best effort: only G1 and G10 gate |
| phone-se | 320 x 480 | 2 | yes | smallest supported portrait (also the 400% reflow case) |
| phone-360 | 360 x 640 | 3 | yes | |
| phone-375 | 375 x 600 | 3 | yes | |
| phone-360s | 360 x 560 | 3 | yes | what a typical Android browser shows (toolbars in): the catalog's overflow case |
| phone-375s | 375 x 548 | 3 | yes | iPhone SE / mini in Safari (toolbars in) |
| phone-390 | 390 x 664 | 3 | yes | deep |
| phone-412 | 412 x 760 | 2.625 | yes | |
| phone-430 | 430 x 740 | 3 | yes | |
| land-568 | 568 x 320 | 2 | yes | smallest supported landscape, deep |
| land-667 | 667 x 340 | 2 | yes | |
| land-740 | 740 x 360 | 3 | yes | |
| land-844 | 844 x 340 | 3 | yes | deep |
| land-932 | 932 x 390 | 3 | yes | |
| tab-600 | 600 x 960 | 2 | yes | |
| tab-768 | 768 x 1024 | 2 | yes | deep |
| tab-820 | 820 x 1180 | 2 | yes | |
| tab-1024p | 1024 x 1366 | 2 | yes | |
| tabl-1024 | 1024 x 690 | 2 | yes | deep |
| tabl-1180 | 1180 x 740 | 2 | yes | |
| tabl-1366 | 1366 x 1024 | 2 | yes | |
| lap-1280 | 1280 x 650 | 2 | no | deep |
| lap-1366 | 1366 x 650 | 1 | no | |
| lap-1440 | 1440 x 780 | 2 | no | |
| lap-1536 | 1536 x 730 | 1.25 | no | |
| desk-1920 | 1920 x 950 | 1 | no | deep |
| desk-2560 | 2560 x 1300 | 1 | no | |
| ultra-3440 | 3440 x 1300 | 1 | no | deep |
| uhd-3840 | 3840 x 2000 | 1 | no | |

Each screen is loaded with script on (states: top, caught, catalog, modal, story, principles, commitment, then a Tab walk), with no script, and on deep screens with reduced motion, forced colours, 200% text and a classic scrollbar.

## Gates

| Gate | Measures | Passes when |
|---|---|---|
| G1 | document `scrollWidth` with the body's overflow guard switched off, and every unclipped element's right and left edge | nothing is wider than the screen (also with a 15 px scrollbar) |
| G2 | nav bar height, links per line, logo bounds | at most 80 px, one line, logo inside; a Menu button when the links are folded |
| G3 | fit: hero (top), statement (caught), catalog (catalog), dialog (modal) | hero not taller than the screen; headline, tagline, CTA, captions and sound button inside it with no overlaps; headline at most 2 lines; CTA one line; statement inside; catalog is not a scroller of its own (G17 checks its tiles are reachable); dialog panel inside, close button reachable at the end of its content |
| G4 | every visible interactive element (with the dialog open, only the dialog's) | at least 44 px (coarse pointer) or 24 px; at least 8 px apart on touch, except a floating control over scrolling content (the pause button over the catalog's sliding content), which is only size-checked |
| G5 | computed font size of every visible text element | labels 12, secondary 14, running paragraphs 16 (see guidelines section 6) |
| G6 | the words' own box against the nearest clipping ancestor; 200% text run (warning only) | no text cut sideways |
| G7 | `layout-shift` entries while loading and (deep) while scrolling the whole page | at most 0.01 |
| G8 | no-script, reduced-motion and forced-colours pages | no overflow, headings visible, every nav link reachable without script, no looping animation under reduced motion, no scroll track, gradient text visible in forced colours |
| G9 | rendered text, title, meta description, `aria-label`, `alt`, `title` | no em or en dash |
| G10 | console errors, page errors, failed requests (aborted media ranges ignored) | none |
| G11 | Tab walk from a fresh load (it runs first: a page that has had focus in the dialog starts its next Tab from there); after a tile takes focus the walk waits for the card to open | skip link first; every stop at least 90% in view and not covered; all 8 category tiles reached; focus indicator (warning) |
| G12 | headings in DOM order | one h1; no level skipped |
| G13 | uppercase, tracked, small labels that sit directly above a heading | at most ceil(sections / 3) |
| G14 | left edge of hero copy, nav logo, captions, statement and every `.page-container` child | within 1.5 px of the column edge |
| G15 | images, videos, canvases | `alt` present, loaded, sized; video muted, `playsinline`, poster once near, pause control; canvases `pointer-events: none` |
| G16 | scroll budget (deep screens, a fresh page): one steady gesture (an eighth of a screen every 250 ms) finds the bite; from there the page is scrolled and left to settle | the bite lands 0.55 to 1.15 screens down (the approved one); the lure is drawn up within 0.4 screens of it; the categories sheet is at the top within 2.4; the catalog is fully in within 0.75 of the sheet. Measured 2026-10-04 (laptop / phone): 0.25 / 0.13, 2.02 / 1.75, 0.63 |
| G17 | the catalog at the end of its card's hold | no scroller inside the card (computed `overflow-y` auto or scroll with overflow), the last tile is on screen (a page-scroll away) |

Sweep allowances live in `scripts/design-allow.json` under `sweep` (`{ gate, match, screens?, reason }`); an allowance that matches nothing is reported.

## Running

```bash
# lint: every change (also runs from the edit hook)
npm run design:lint                      # whole repo
node scripts/design-check.mjs --self-test
node scripts/design-check.mjs --list

# sweep: any layout, CSS or markup change. --build makes a production COPY (never build in the repo:
# the dev server owns .next), serves it on :3150, sweeps, stops it. About 35 minutes for all 27 screens, about 15 with --quick.
npm run design:sweep -- --build
npm run design:sweep -- --url http://localhost:3150 --only lap-1280,land-568 --json /tmp/sweep.json --shots /tmp/shots
npm run design:sweep -- --url http://localhost:3150 --quick      # the 8 deep screens only
bash scripts/preview-clone.sh            # build and serve the copy on its own; add --stop to stop it

# several Claude sessions share this machine: the copy lives in $TMPDIR/mechaavo-clone-<port>, and the script
# stops only a server that is its own (a foreign process on the port makes it exit). If 3150 is taken, pick another:
PORT=3250 bash scripts/preview-clone.sh
npm run design:sweep -- --build --port 3250
```

Lighthouse (the cached binary from earlier sessions; `npx lighthouse@13` downloads one if it is gone), against the production copy:

```bash
LH=~/.npm/_npx/0f94ee7615faf582/node_modules/.bin/lighthouse
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
$LH http://localhost:3150 --only-categories=performance,accessibility,best-practices --chrome-flags="--headless=new" --output=json --output-path=/tmp/lh-mobile.json
$LH http://localhost:3150 --preset=desktop --only-categories=performance,accessibility,best-practices --chrome-flags="--headless=new" --output=json --output-path=/tmp/lh-desktop.json
```

Compiled palette check (in the copy): every colour literal in the built CSS must be one of the eight token hexes (plus `#0000`, transparent):
`grep -rhoE '#[0-9a-fA-F]{3,8}\b' "${TMPDIR:-/tmp}/mechaavo-clone/.next/static" --include='*.css' | sort -u`

Text on glass or video: Lighthouse skips elements hidden at load (the catalog), so sample pixels instead: screenshot with all text transparent, sample each text rectangle's background, composite the text colour over each pixel and take the worst ratio.

## Known risks and limits

- Headless Chrome is not Safari. iOS toolbar show and hide, rubber-banding and `svh` on a real phone are a manual check on a device.
- Firefox and WebKit are not run.
- Contrast is not part of the sweep (Lighthouse and the pixel sampling above).
- 280 px wide is best effort: only G1 and G10 gate it.
- On a screen too short for all eight tiles (320 x 480, 568 x 320, and 28 to 41 px short at 360 x 560 and 375 x 548) the timeline slides the catalog's content up while the card is held open; the pause button floats over it. Nothing scrolls inside the card (G3, G17).
- **Not measured here, to check on a device:** the white strip under a phone's toolbars (headless Chrome has no toolbars: the fix, a stage as tall as `lvh`, was checked by simulating `svh` 560 / `lvh` 664), whether the frosted glass or the multiply-blended water video flickers on iOS Safari while a flick is stopped, and whether the finger that stops a flick triggers a tile's pressed state (headless emulation does not apply `:active` to touches). The hero's bottom edge may show the same strip; if it does, give `.hero-track` the seabed's tone.
- At 200% text (a deep-screen run, warnings only) long display words break rather than being cut (`overflow-wrap: anywhere` on `.display-type`). A word on a heading plate is `white-space: nowrap` by design, so a long plated word (PERFORMANCE) can still be a few pixels too wide on a 768 px screen: reported, not failed.
- Mobile LCP is about 2.8 s (Lighthouse mobile, simulated slow 4G, median of three runs 2538 / 2789 / 2791 ms), above the 2.5 s budget and unchanged from before this pass. The LCP element is the hero tagline ("Trusted for every catch."), whose paint is gated by the web font (Raleway) arriving, not by anything on the page. Desktop LCP is 0.6 s. Recorded as a known gap; the fixes that would help (a font swap policy, a lighter first load) change the brand's first paint, so they are a client decision.
- The "caught" state waits for a real bite; if the bite does not happen within the wait the sweep sets `data-caught` itself and marks the problems `[forced data-caught]`.
- The classic-scrollbar run styles `html::-webkit-scrollbar` (Chrome only) and reports a warning when the browser will not show one.
- Layout-shift numbers in headless Chrome are close to, not equal to, a real device; the target is 0.

## Log

| Date | What | Result |
|---|---|---|
| 2026-10-02 | **Baseline**, before the responsive pass: all 27 screens, production copy, gates G1 to G15 | 837 problems on 26 screens. G2 nav bar 85 to 105 px from 1180 px wide. G3 the hero was taller than the screen (`min-height: 34rem`) on every screen under 544 px tall, so the CTA, captions and sound button sat below the fold (320 x 480 and every landscape phone), and the dialog's close button scrolled out of reach. G4 nav links 36 px tall and 3 px apart on tablets, category tiles touching the pause button and the dialog's close button. G5 text under the floors (Menu and Sound 11.5 px, the badge 10.4 px, the hero lede, the dialog's copy at 12 to 14 px). G8 no nav links without script on phones. G11 0 of 8 category tiles reachable by keyboard (the catalog was `visibility: hidden` until the card opened). Clean: G1, G6, G7 (CLS 0.0000 on every screen), G9, G12 to G15. Lighthouse mobile LCP 2.8 s (earlier session). |
| 2026-10-03 | **After the pass**: all 27 screens, production copy (includes the section jumps and sticky bar from the parallel session), Lighthouse mobile and desktop | G1, G2, G5, G6, G7, G8, G9, G10, G12, G13, G15 pass everywhere; G3 passes except a no-script nav overlap on 360 to 390 px phones (a few px; padding raised afterwards); catalog scrolling on 568 x 320 and 320 x 480 is the documented warning. Remaining reports belong to the sticky bar: its Menu button at the right edge (G14, a sweep false positive, now skipped), its logo link 39 px tall (G4, 44 needed on touch), and the skip link measured mid-slide (G11, wait added). Lighthouse mobile 95 to 97 / 100 / 100, LCP about 2.8 s (known gap), CLS 0; desktop 100 / 100 / 100. Re-run the sweep to confirm the three fixes. |
| 2026-10-04 | **Hero fish, scroll budget, categories on phones, tile photos, contact and footer**: all 29 screens, production copy, gates G1 to G17 (new: G16 scroll budget, G17 catalog reach; new screens phone-360s, phone-375s); `npm run fish:sim`; Lighthouse mobile and desktop; interleaved A/B against the original commit for LCP | Before: fish:sim 21 of 21 checks failed (heading wrong in 73% of frames, 39 head flips a minute); G16 failed on every deep screen (bite to lure drawn up 1.25 laptop / 1.0 phone screens, bite to sheet 4.23 / 3.45, sheet to catalog 1.12); G17 and G3 failed on 360x560 and 375x548 (28 and 41 px of catalog overflow). After: fish:sim passes; G16 passes (0.25 / 0.13, 2.02 / 1.75, 0.63; the bite did not move: 0.88 / 0.75 screens); G1 to G17 pass on all screens except two real reports found by the full run and fixed afterwards (G4: the sticky bar's logo link 39 px tall on short touch screens, which was already open in the 2026-10-03 row, and the logo touching the first link at 768 px once the bar had five links); G6 text-zoom warnings unchanged. Lighthouse mobile 95 to 96 / 100 / 100 / 100, LCP 2.7 to 2.9 s (original commit 2.8 s: the eight tile photos at page start had pushed it to 3.16 s, so they are fetched once the card is near), CLS 0; desktop 100 / 100 / 100 / 100. Not measured: a real phone (toolbar strip, glass flicker, `:active` on the touch that stops a flick), Safari, Firefox. |
