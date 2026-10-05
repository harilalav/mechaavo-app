# Media credits

## Story section water loop

| | |
|---|---|
| Files | `public/videos/story-water-{720,1080,2160}.mp4`, `public/videos/story-water-poster.jpg` |
| Source | "Underwater Ocean View with Sunlight Rays" by JUN HO LEE (@divesaipan3076), Pexels video 32790667 |
| Page | https://www.pexels.com/video/underwater-ocean-view-with-sunlight-rays-32790667/ |
| Original | 3840x2160, 59.94 fps, 14.6 s |
| Licence | Pexels License: free to use, commercial use allowed, no attribution required (credited here anyway) |

### What was done to it

Trimmed to 14.6 s, a 1.5 s crossfade from the end into the start so the loop has no jump (13.1 s, 30 fps), light denoise, contrast stretch, converted to **grayscale**, audio removed. Three renditions (720p, 1080p, 4K) and a poster frame.

The files carry no color on purpose. `src/styles/story.css` tints the clip with brand tokens (multiply onto `--color-primary`, a white lift from the top, a dark scrim at the bottom), so the page stays inside the approved palette. The natural-color footage is not used.

Which rendition a screen gets is decided in `lib/config/media.ts` (4K only for large or dense displays, the lightest file for data-saver).

### Re-creating or swapping the footage

`docs/encode-story-video.sh` is the exact ffmpeg script used (needs `ffmpeg` with libx264). Put the new 4K source next to it, edit `SRC`, `T` (source length in seconds) and the output names, run it, and copy the results into `public/videos/`. Then update this file.

## Category photos (stock placeholders)

The photo along the top of each category tile and at the top of its inspector. **They are stock placeholders:** all eight are public domain or CC0 photographs from Wikimedia Commons, which need no attribution (credited here anyway), chosen because no licence needed a visible credit line on the page. None is a Mechaavo product, and a stock photo may show another maker's lure. To use the brand's own product photo, see "Swapping a photo" below.

| Category | Photo (Commons page) | Author | Licence |
|---|---|---|---|
| Frog Lure | [Zwei Wobbler für das Angeln an der Oberfläche](https://commons.wikimedia.org/wiki/File:Zwei_Wobbler_für_das_Angeln_an_der_Oberfläche.jpg) | Danndorfer1914 | CC0 |
| Soft Lure | [Ein Gummifisch als Hecht Imitat](https://commons.wikimedia.org/wiki/File:Ein_Gummifisch_als_Hecht_Imitat.jpg) | Danndorfer1914 | CC0 |
| Plastic Lure | [Verschiedene Twitchbaits](https://commons.wikimedia.org/wiki/File:Verschiedene_Twitchbaits.jpg) | Danndorfer1914 | CC0 |
| Wood Lure | [ウッドゥン・ホッツィートッツィー](https://commons.wikimedia.org/wiki/File:ウッドゥン・ホッツィートッツィー.jpg) (a balsa lure) | サミー | Public domain |
| Spinner | [Moderne Spinner](https://commons.wikimedia.org/wiki/File:Moderne_Spinner.jpg) | Danndorfer1914 | CC0 |
| Metal Jig | [Verschiedene Blinker](https://commons.wikimedia.org/wiki/File:Verschiedene_Blinker.jpg) (metal spoons) | Danndorfer1914 | CC0 |
| Jig Head | [ジグヘッド](https://commons.wikimedia.org/wiki/File:ジグヘッド.jpg) | サミー | Public domain |
| Assist Hook | [FishHooks](https://commons.wikimedia.org/wiki/File:FishHooks.JPG) (plain fish hooks) | own work (uploader) | Public domain |

Known stand-ins: the frog lure's photo is of a topwater popper (no free photograph of a hollow-body frog was found), the metal jig's of spoon lures, the assist hook's of plain hooks. The wood lure's body carries a maker's lettering, small enough that it cannot be read in a tile and only just in the inspector.

### What was done to them

`docs/make-category-images.mjs` crops each source (kept at up to 2400 px in `docs/category-sources/`) to 2:1 around the lure, lays the spinner on its side, turns it to **grayscale**, stretches the levels and writes `public/images/categories/<id>.jpg` (1600 x 800). Like the water footage, the files carry no colour: `src/styles/categories.css` tints them with the brand tokens (multiply onto `--color-primary` thinned with white, a lift of white from the top).

### Swapping a photo

Put the new photo in `docs/category-sources/<id>.jpg` (replace the stock one), adjust that category's `zoom`, `x`, `y` (and `rotate`) in `docs/make-category-images.mjs`, run `node docs/make-category-images.mjs --sheet /tmp/sheet.jpg` and look at the sheet, then change the alt text in `CATEGORY_MEDIA` (`lib/config/media.ts`) and this table. Lures read best facing right, as the hero's does.
