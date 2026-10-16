import { CONTACT, CONTACT_IS_PLACEHOLDER } from "@/lib/config/contact";
import { SITE } from "@/lib/config/site";

/**
 * The page's schema.org data (JSON-LD, rendered in app/page.tsx): who the brand is and that this is its
 * site. Only what is true goes in: the social profiles and the contact point join once
 * lib/config/contact.ts holds the real ones (CONTACT_IS_PLACEHOLDER false). There is no Product markup on
 * purpose: the categories have no prices or offers and their specs are unconfirmed, and Product data
 * without them is invalid for rich results.
 */
export function siteStructuredData() {
  const org = `${SITE.url}/#organization`;
  const real = !CONTACT_IS_PLACEHOLDER;
  const sameAs = real ? Object.values(CONTACT.social).filter((url): url is string => url !== null) : [];
  const contactPoint =
    real && (CONTACT.email || CONTACT.phone)
      ? {
          "@type": "ContactPoint",
          contactType: "customer service",
          ...(CONTACT.email && { email: CONTACT.email }),
          ...(CONTACT.phone && { telephone: CONTACT.phone.tel }),
        }
      : null;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": org,
        name: SITE.name,
        url: `${SITE.url}/`,
        logo: `${SITE.url}/images/mechaavo-logo-lockup.png`,
        description: SITE.description,
        ...(sameAs.length > 0 && { sameAs }),
        ...(contactPoint && { contactPoint }),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: `${SITE.url}/`,
        name: SITE.name,
        publisher: { "@id": org },
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">, with `<` escaped so no string can close the tag. */
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
