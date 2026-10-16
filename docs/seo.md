# SEO: launch, Search Console, links

Google can only show a site it can reach. Until the site is deployed on its own domain, nothing in the code makes it appear in search. This file covers what the code already does, the steps that happen outside the code (domain, host, Search Console), and how the site earns links.

## What the code does

| Piece | Where | Note |
|---|---|---|
| Site address, title, description, Search Console token | `lib/config/site.ts` | **`url` is a placeholder** (`SITE_IS_PLACEHOLDER = true`); `design:lint` warns until it is real |
| Title, description, Open Graph, X card, canonical, verification meta | `app/layout.tsx` (`metadata`) | the canonical is left out while the address is a placeholder |
| `robots.txt` | `app/robots.ts` | everything crawlable, points at the sitemap |
| `sitemap.xml` | `app/sitemap.ts` | one URL (the page); add an entry for every new route |
| Structured data (schema.org JSON-LD) | `lib/seo/structuredData.ts`, rendered in `app/page.tsx` | Organization and WebSite; social profiles and contact point join once `lib/config/contact.ts` is real; no Product markup until there are real prices and confirmed specs |
| Share image | `app/opengraph-image.jpg` and `.alt.txt` | made from the real hero by `docs/make-og-image.mjs`; rerun it after the hero changes |
| HTTPS | `next.config.ts` (`Strict-Transport-Security`) | the http to https redirect is a host setting, below |
| Images | `next.config.ts` (`images`) | AVIF then WebP, qualities 70 and 75 |
| Headings | one `h1` (the hero), an `h2` per section | sweep gate G12 checks one h1 and no skipped level |

Nothing on the page says `noindex`, and no header does either.

## Launch checklist

1. Pick the one address Google should show, with or without `www` (for example `https://www.mechaavo.com`). Put it in `SITE.url` in `lib/config/site.ts` (https, no trailing slash) and set `SITE_IS_PLACEHOLDER = false`.
2. Put the brand's real contact details and social profiles in `lib/config/contact.ts` and set `CONTACT_IS_PLACEHOLDER = false` (the page links to stand-ins until then).
3. `npm run design:lint -- --strict` must pass (it fails while either flag is true).
4. Deploy, then point the domain at the host and make the other form redirect to it (next section).
5. Check by hand: `https://<domain>/robots.txt`, `https://<domain>/sitemap.xml`, the page source has `<link rel="canonical" href="https://<domain>/">`, and a link to the site pasted into a chat app shows the share image.
6. Search Console (below).

## HTTPS and one address

- **Vercel:** HTTPS and the http to https redirect are automatic. In Project, Settings, Domains add both `mechaavo.com` and `www.mechaavo.com` and set the one that is not in `SITE.url` to redirect to the other.
- **Netlify:** the same, under Domain management (set the primary domain; the other redirects to it).
- **Your own server** (`next start` behind nginx): redirect plain http and the other host with a 301:

```nginx
server { listen 80; server_name mechaavo.com www.mechaavo.com; return 301 https://www.mechaavo.com$request_uri; }
server { listen 443 ssl; server_name mechaavo.com; return 301 https://www.mechaavo.com$request_uri; }  # plus its ssl_certificate lines
```

The app already sends `Strict-Transport-Security: max-age=31536000`. Add `includeSubDomains` or `preload` only once every subdomain is on HTTPS: both are hard to take back.

## Search Console

1. Go to https://search.google.com/search-console and choose **Add property**, then **Domain**, and enter the bare domain (`mechaavo.com`). A domain property covers http, https, www and no www at once.
2. Google shows a `TXT` record. Add it at the domain's DNS provider (where the domain was bought, or the host if it runs the DNS), then press **Verify**. DNS can take from minutes to a few hours.
   - Cannot change DNS? Use a **URL prefix** property and the **HTML tag** method: copy the `content` value of the tag into `SITE.googleVerification` in `lib/config/site.ts`, deploy, then press Verify.
3. **Sitemaps**: submit `sitemap.xml`.
4. **URL Inspection**: enter the home page, choose **Test live URL**, then **Request indexing**.
5. A few days later, check **Pages** (indexing) for errors. There is no fixed time to appear: Google decides. A brand search ("Mechaavo") usually appears first; generic searches ("metal jig") need pages and links (below).
6. Optional: Bing Webmaster Tools can import the property from Search Console, which also covers DuckDuckGo and Yahoo.
7. Test the structured data on the live URL: https://search.google.com/test/rich-results and https://validator.schema.org.

## What will move rankings most

The site is one page, so Google can rank it for one set of searches: the brand name and the general pitch. Searches for a product type ("soft plastic swimbait", "assist hooks for jigging") need a page about that product type. The biggest step after launch is a page per category (`/categories/frog-lure` and so on; the ids in `ProductCategories.tsx` are already slugs), each with its own title, description, real specs and photos, linked from the catalog tile and listed in the sitemap. That is a design task of its own (the plan card in `docs/DESIGN-GUIDELINES.md`).

## Backlink strategy (global, English speaking)

Links from other sites tell Google the brand is real and worth showing. Earn them; do not buy them. Order matters: the first steps cost nothing and come first.

**1. Own profiles (week one).** Every profile the brand owns links to the site: Instagram and TikTok bio, YouTube channel links and every video description, Facebook page, LinkedIn company page, X. Use the same name, logo and one line everywhere. If there is a physical shop or office that customers visit, a Google Business Profile.

**2. Where the products are sold.** Every retailer and distributor that stocks Mechaavo gets a short brand kit (logo, one paragraph, product photos, the site address) and is asked to link to the site from its "brands we carry" page or brand page. Independent tackle shops are the most likely to do it. Marketplace listings (Amazon, eBay) rarely link out, so do not count on them for links.

**3. Reviewers and creators.** Send product to angling YouTubers, gear reviewers and tackle blogs whose audience fits each category (topwater for frog lures, jigging for metal jigs and assist hooks). Ask for an honest review, not a link. Sponsored or gifted posts must be disclosed and their links marked `sponsored` or `nofollow`: that is fine, because the value is the audience and the brand searches that follow.

**4. Angling media.** New product launches and new categories go to angling magazines and gear sites (national titles in the UK, US and Australia, gear roundup writers, tackle trade press). Pitch only with specs that are confirmed: the catalog's current spec claims are not yet (see the open content risk in `docs/DESIGN-GUIDELINES.md`).

**5. Sponsorships and clubs.** Tournaments, angling clubs, youth fishing programmes and fishery or conservation groups list their sponsors with a link. Pick ones that match the categories and the market, and ask for the link in the agreement.

**6. Content worth linking to.** People link to useful pages, not to a landing page. Once the category pages exist, add a few guides only the brand can write well (how to rig a jig head, choosing assist hooks by jig weight, when a wood lure beats plastic), with real photos and real numbers. These are what forums, reviewers and journalists link to.

**7. Communities.** Take part in angling forums and subreddits (r/Fishing, r/bassfishing and the national and species forums) as the brand, openly, answering questions. Link only where it answers the question and the rules allow it. Most of these links are `nofollow`; they bring people, which is the point.

**Never:** bought links, link exchanges, private blog networks, mass directory submissions, paid guest posts on unrelated sites, or links with exact-match keywords as the anchor text. They break Google's spam policies and can get the site demoted.

**Measure monthly:** Search Console, **Links** (who links and to which page) and **Performance** (brand searches and the searches each page appears for). Referral traffic from the sites above shows which efforts are worth repeating.
