# Category image prompts (Gemini 3 Pro Image, "Nano Banana Pro")

> **Status (2026-10-16): put back.** This set was generated, approved, swapped in and then reverted at the user's request; the site shows the stock photos again. The eight originals are in `docs/category-sources/ai/<id>.png` and everything below still works if the set is wanted again (see `docs/media-credits.md`, "Tried and put back"). Where this file says an approved image moves to `docs/category-sources/<id>.png`, that is the step that switches it on.

Prompts for the eight category photos (`public/images/categories/<id>.jpg`, made by `docs/make-category-images.mjs`).
Model: `gemini-3-pro-image` (the highest Gemini image model), 16:9, 2K or 4K. The script crops the
result to 2:1 and stretches its levels, **in its own colour**: since the client review of 2026-10-16
("why are we tinting and gray scaling the category images") the photos are no longer turned grayscale
or tinted with the brand blue, so what the model makes is what the plate shows. The prompts still ask
for a restrained shared palette so the eight read as one set.

## Why the composition rules are what they are

- The tile window is 1.8:1 to 3:1 depending on the screen (`--tile-photo` in `categories.css`), the
  inspector shows 2:1. A 3:1 crop of a 2:1 frame keeps only the middle two thirds of its height, so the
  lure must sit in the **middle band** with clear margin above and below.
- Lures read best **facing right** (the hero's does), nose to the right edge side.
- The eight tiles are one set: same camera, same light, same ground, same scale of subject.
- The ground is a light, nearly white sweep so the photo window sits quietly inside the white plate
  and its mount, and the product carries the colour.
- No text, no logos, no maker's marks: none of these is a Mechaavo product yet, and the alt text says
  what each shows (`lib/config/media.ts`).

## Workflow (consistency)

1. Generate **`plastic-lure` first** with the shared block plus its own block. Look at it, fix the
   shared block if the light or ground is off.
2. Generate the other seven **with that approved image attached as a style reference** and add:
   "Match the attached image exactly in camera, lighting, background, shadow and level of detail. Only
   the product changes."
3. Output 16:9, as large as the tool allows. The agent saves each to `docs/category-sources/ai/<id>.png`
   (paths are in `docs/category-sources/ai/paste.md`, made by `node docs/generate-category-images.mjs --paste`);
   once approved, move it to `docs/category-sources/<id>.png`, where the pipeline reads it. Done for the
   first set on 2026-10-16 (all eight came out at 1376 x 768, the tool's 1K size).
4. Run `node docs/make-category-images.mjs --sheet /tmp/sheet.jpg`, look at the sheet, adjust `zoom`, `x`,
   `y` per id in the script if a crop cuts a hook, then update the alt text in `lib/config/media.ts` and
   the table in `docs/media-credits.md` (they must say these are AI-generated, not photographs).

## Shared style block (paste before every category block)

```
Professional e-commerce studio product photograph of ONE fishing tackle item, photorealistic,
macro-sharp, tack-sharp from nose to tail (f/8, 100mm macro, no depth-of-field blur on the product).

Camera: dead-level side view at the product's own height, perfectly orthogonal, the product's long
axis horizontal and straight across the frame, nose pointing RIGHT. Landscape 16:9 frame.

Composition: the product is centred, spans about 68 percent of the frame width and no more than 38
percent of the frame height, with generous empty margin on all four sides (nothing may touch or come
near an edge, no hook or tail cropped). It is the only object in the frame.

Light: large soft box from upper left, a faint cool rim light from behind on the right to trace the
silhouette, gentle fill from the front so there are no crushed blacks. Real specular highlights on
metal and glossy paint, clearly visible material texture.

Ground: seamless, matte, very pale cool grey-white studio sweep (about 94 percent brightness), no
horizon line, no texture, no gradient banding. One very soft, short contact shadow directly under the
product, nothing else.

Tonal rule: the product must separate clearly from the pale ground even when converted to black and
white: its body is mid to dark in value with bright highlights, never pale on pale. Palette: gunmetal,
graphite, brushed steel, pearl white and a single restrained deep-blue accent. No saturated reds,
oranges, greens or neon.

Absolutely none of: text, letters, numbers, logos, brand marks, watermarks, price tags, packaging,
hands, fish, water, droplets, reflections of a room, props, rulers, extra lures, motion blur, glow,
vignette, illustration or CGI look, plastic toy look, melted or duplicated hooks, extra or missing
hook points.
```

## Category blocks

Each is pasted after the shared block. Hook counts and anatomy are stated on purpose: image models
invent extra hook points unless told the number.

### frog-lure (Frog Lure, Topwater // Weedless)

```
SUBJECT: a hollow-body topwater frog lure in soft elastomer, side view, nose right. A plump domed
back, two raised bulging eyes, a wide closed mouth, a flat belly sitting level on the ground. ONE
weedless double hook (a single forged shank with exactly two needle-sharp points, side by side): the
two points emerge through two thin slits on the back and lie flat and close along the back, pointing
back toward the tail, so the hook reads as two slim curved points hugging the body. Behind the body
(left) two segmented silicone leg skirts of fine micro-strands trail out horizontally, each leg
ending in a soft fan of strands. Finish: matte graphite-green-grey back fading to pearl white belly
with a subtle hand-painted speckle, a single deep-blue band on the legs, tiny gloss on the eyes.
Exactly one double hook (two points), one body, two legs.
```

### soft-lure (Soft Lure, Swimbaits // Silicone)

```
SUBJECT: one paddle-tail soft swimbait in translucent Japanese-grade silicone, side view, head right.
A slim baitfish body with a small moulded eye, a thin straight slot cut along the back for a hook, a
row of fine evenly spaced micro-grooves (acoustic ribs) along the flank, and a crisp flat paddle tail
curving gently upward at the left end. Silicone is semi-translucent smoky graphite on the back
fading to a soft pearl grey on the belly (clearly darker than the ground, never white), light passes
through the thin tail so its edge glows. No hook attached, no jig head, no second lure. One body,
one tail. There are no hooks in this image at all.
```

### plastic-lure (Plastic Lure, Hardbody // Jerkbaits)

```
SUBJECT: one suspending minnow jerkbait in glossy hard ABS, side view, head right. A long slender
torpedo body, a short clear angled lip under the nose, a single large clean eye, a faceted
holographic scale-foil pattern showing through the clear lacquer along the flank (silver to
gunmetal), dark graphite back, white belly, fine gill-plate line. A small stainless split ring at the
nose. Exactly two treble hooks in total, one under the belly centre and one at the tail, each on its
own split ring and each with exactly three needle-sharp Teflon-black points, hanging naturally
straight down with the lure resting level.
```

### wood-lure (Wood Lure, Handcrafted // Balsa)

```
SUBJECT: one hand-carved balsa flat-side crankbait under many coats of clear marine polyurethane,
side view, head right. It must look clearly different from a slim plastic minnow: a short, deep,
plump flat-sided body (about three times as long as it is tall), a broad hand-cut diving lip angled
down from the nose, a stainless through-wire eye at the nose. A hand-painted back in matte graphite
with fine brush-stroke variation fading to a soft pearl grey, and along the belly and edges where the
paint is thin the natural balsa grain shows through the clear coat in a warm honey-brown (mid value,
not pale), the one warm note in the picture. Two small hand-painted glass-look eyes. Two treble hooks
hung on small split rings, one under the belly and one at the tail, exactly three points on each.
Artisan quality, tiny imperfections of handwork, no lettering. One single soft contact shadow only,
no second or detached shadow.
```

### spinner (Spinner, Vibration // Flash)

```
SUBJECT: one inline French-style spinner, held level in the air like the other lures in this set
(hovering, one soft shadow below), long axis horizontal, blade end RIGHT. At the right end an
open, clean wire loop eye (the line tie), then a stainless clevis carrying ONE polished jewellery-grade
brass Colorado-style blade (a rounded teardrop, concave), swung out from the shaft at about 30
degrees as if it were spinning, so its edge and concave face are both visible. Behind the clevis a
hardened stainless wire shaft runs left through a small cluster of facetted beads and a slim,
weighted cylindrical body in dark graphite metal, ending at the left in ONE dressed treble hook (a short
tuft of fine natural white hair at its collar) hanging straight down. The blade is mirror-polished,
strongly reflecting the soft box, with a thin crisp edge: it is the one bright warm-gold note in the
picture. One blade, one body, one treble with exactly three needle-sharp points.
```

### metal-jig (Metal Jig, Vertical // Offshore)

```
SUBJECT: one offshore metal jig in hardened zinc-antimony alloy, side view, nose right, held level in
the air like the other lures in this set (hovering, one soft shadow below). A slim asymmetrical
flat-sided slab, about five times as long as it is tall, thicker toward the front and tapering to a
thin tail at the left, with bevelled planed edges. The upper half is a deep gunmetal-blue enamel
(mid to dark in value) and the lower half is bright brushed stainless silver with a diagonal
pattern of fine holographic facets, the two meeting on a crisp, slightly diagonal line, so the
jig is clearly darker than the ground along its top edge. A small clean eye marking near the
nose, and one solid welded stainless ring at the nose (right) as the only attachment. No hooks, no
assist line, no cord, no second jig.
```

### jig-head (Jig Head, Terminal // Tungsten)

```
SUBJECT: one tungsten jig head, macro, side view, held level in the air like the other lures in this
set (hovering, one soft shadow below), head on the RIGHT, hook trailing to the LEFT. A smooth round
ball head in dense dark satin tungsten, about 22 percent of the frame width across, with a tiny
crisp painted eye on the side (white with a graphite pupil) and a tiny stainless wire line-tie eye
rising from the top front of the head. Behind the head a short bait-keeper collar with a thin ring
of deep-blue enamel, then ONE forged needle-point carbon-steel hook leaving the head to the left: a
straight shank with a small bait-holder barb on it, then a smooth round bend curving up at the far
left, ending in ONE needle-sharp point that faces back toward the head. The whole piece (head, shank
and bend) spans about 68 percent of the frame width. One hook, one point, one head, no soft plastic,
no worm, no skirt, no line. The head is a deep gunmetal with a gentle bright specular highlight,
mid to dark in value, never pale.
```

### assist-hook (Assist Hook, Terminal // Rigging)

```
SUBJECT: one twin assist hook rig, side view, held in the air like the other lures in this set
(hovering, one soft shadow below), the ring on the RIGHT. A solid seamless forged stainless ring at
the right end. From the ring a short length of hand-spliced Kevlar PE cord (braided, slightly
furry, dark graphite with one fine deep-blue tracer thread) runs left in a gentle natural curve and
ends at two needle-sharp forged black-nickel hooks of equal size. The cord is whipped to the eye of
each hook with neat, tight wraps of deep-blue thread under a fine glossy lacquer. The two hooks
splay apart in a shallow V in the picture plane (one angled slightly up, one slightly down), their
shanks pointing left, their bends curving back toward the ring. Each hook has exactly one
needle-sharp point: exactly two hook points in total. The whole rig spans about 68 percent of the
frame width. Nothing else in the picture: no jig, no lure, no line.
```

## What to check on every output before it goes in

- Hook, point and body counts match the block (count them; models invent extra points).
- Nothing within 8 percent of an edge, no hook cropped, subject inside the middle 45 percent of the height.
- No text or lettering anywhere (including on the lip, the ring and the hook eye).
- Looks like the same photographer, same day, as the other seven.
- Contact sheet (`--sheet`): subject separates from the ground, no pale-on-pale, the eight read as one set.
