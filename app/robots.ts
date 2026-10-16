import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config/site";

/** robots.txt: everything may be crawled (Google needs /_next/ too, to render the page), and where the sitemap is. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
