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
