import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config/site";

/**
 * sitemap.xml: the one page. The sections are #fragments, which search engines do not index apart, so
 * they are not listed. No lastModified (Google only uses one it can trust), no priority or changeFrequency
 * (Google ignores both). Add an entry for every new route.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE.url}/` }];
}
