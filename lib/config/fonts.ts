import { Raleway } from "next/font/google";

/**
 * Central font configuration. Raleway is the only typeface on the site.
 *
 * Everything else reads it through one CSS variable: `app/layout.tsx` puts
 * `fontSans.variable` on <html>, and `app/globals.css` maps `--font-sans` (the
 * Tailwind `font-sans` utility, set on <body>) to it. To change the site's
 * typeface, change it here and nowhere else.
 *
 * Raleway is a variable font, so one file serves every weight (100-900).
 */
export const fontSans = Raleway({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-raleway",
});
