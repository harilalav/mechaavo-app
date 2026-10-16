# Media credits

## Water loop (removed)

There is no video on the site. The Pexels water loop that used to play behind the story section, the categories and the hero was removed on 2026-10-16 (the water is token-graded CSS and the hero's canvas now): its files (`public/videos/story-water-*.mp4`, the poster) and its encode script (`docs/encode-story-video.sh`) are gone from the tree. They are in git history (the commit before the removal) if they are ever wanted again; the clip was "Underwater Ocean View with Sunlight Rays" by JUN HO LEE, Pexels video 32790667, Pexels License.

## Category photos (stock placeholders)

The photo in each category plate's window and at the top of its inspector. **They are stock placeholders:** all eight are public domain or CC0 photographs from Wikimedia Commons, which need no attribution (credited here anyway), chosen because no licence needed a visible credit line on the page. None is a Mechaavo product, and a stock photo may show another maker's lure. To use the brand's own product photo, see "Swapping a photo" below.

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

`docs/make-category-images.mjs` crops each source (kept at up to 2400 px in `docs/category-sources/`) to 2:1 around the lure, lays the spinner on its side, stretches the levels and writes `public/images/categories/<id>.jpg` (1600 x 800) **in the photo's own colour**. Until 2026-10-16 it also turned them grayscale and `categories.css` tinted them blue with the brand tokens, so the eight stood as one set; the client asked why the products were being tinted, and they are now shown as they are (like the logo, a product photo keeps its own colours and the CSS never touches it).

### Swapping a photo

Put the new photo in `docs/category-sources/<id>.jpg` (replace the stock one; a `<id>.png` beside it wins over the jpg), adjust that category's `zoom`, `x`, `y` (and `rotate`) in `docs/make-category-images.mjs`, run `node docs/make-category-images.mjs --sheet /tmp/sheet.jpg` and look at the sheet, then change the alt text in `CATEGORY_MEDIA` (`lib/config/media.ts`) and this table. Lures read best facing right, as the hero's does. Next caches the optimized copy of an image by its path: clear `.next/dev/cache/images` in dev after replacing a file.

### Tried and put back: Gemini-generated studio images (2026-10-16)

A set of eight AI-generated studio images (Google's Gemini image model through the Antigravity agent, 1376 x 768) replaced these photos for a few hours and was put back at the user's request. Not used, not credited on the site. Kept for a later decision: the eight originals in `docs/category-sources/ai/<id>.png`, the prompts in `docs/category-image-prompts.md` (and `node docs/generate-category-images.mjs --paste` for ready-to-paste blocks), and the crops that suited them (`zoom` 1 and `y` about 0.5 to 0.6: frog 0.51, soft 0.57, plastic 0.6, wood 0.535, spinner 0.565, metal jig 0.5, jig head 0.52, assist hook 0.51). To use them again: move the pngs from `ai/` to `docs/category-sources/`, set those crops, rerun the script, and restore the AI-generated disclosure in this file (they are not photographs and not Mechaavo products; check Google's terms for commercial use).
