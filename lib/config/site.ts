/**
 * The site's address and how it is described to search engines, in one place: the metadata
 * (app/layout.tsx), robots.txt (app/robots.ts), the sitemap (app/sitemap.ts) and the structured data
 * (lib/seo/structuredData.ts) all read it.
 *
 * !!! PLACEHOLDER !!! The site is not live yet, so `url` is a stand-in. Before launch put the exact live
 * origin in (https, the one host Google should show, www or not, no trailing slash) and set
 * SITE_IS_PLACEHOLDER to false (`npm run design:lint` warns while it is true). While it is true the page
 * has no canonical tag: a canonical pointing at a stand-in address would tell Google the page lives there.
 * Steps for launch, Search Console and links: docs/seo.md.
 */
export const SITE_IS_PLACEHOLDER = true;

export const SITE = {
  url: "https://www.example.com",
  name: "Mechaavo Tackles",
  /** The <title>; future pages get "<their title> | Mechaavo Tackles" (the template in app/layout.tsx). */
  title: "Mechaavo Tackles | Premium Fishing Lures and Tackle",
  /** The meta description (and the Open Graph one): under 160 characters, no dashes. */
  description:
    "Mechaavo makes premium fishing lures and terminal tackle: frog, soft, plastic and wood lures, spinners, metal jigs, jig heads and assist hooks.",
  /** The Search Console "HTML tag" token, only if that way of verifying is used (a DNS record needs nothing here). */
  googleVerification: null as string | null,
};
