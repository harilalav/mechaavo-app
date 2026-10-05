/**
 * How to reach Mechaavo, in one place: the Contact section (components/showcase/ContactSection.tsx) and
 * the footer (components/ui/SiteFooter.tsx) both read it.
 *
 * !!! PLACEHOLDERS !!! None of these is a real address. The page is built and checked with them so the
 * layout is real, but the site must not go live until each is replaced with the brand's own. When all are
 * real, set CONTACT_IS_PLACEHOLDER to false (`npm run design:lint` warns while it is true).
 *
 * A field set to null is not shown (and nothing else moves): leave out what the brand does not have.
 */
export const CONTACT_IS_PLACEHOLDER = true;

export interface ContactDetails {
  /** Shown as written and used for a mailto: link. */
  email: string | null;
  /** `display` is how it is written; `tel` is the number alone, with the country code, for the tel: link. */
  phone: { display: string; tel: string } | null;
  /** The number alone, with the country code and no plus or spaces, for the wa.me link; `display` is how it is written. */
  whatsapp: { display: string; number: string } | null;
  /** One entry per line of the address, and the link to the place on a map. */
  address: { lines: readonly string[]; map: string } | null;
  /** Full profile URLs. */
  social: {
    instagram: string | null;
    facebook: string | null;
    youtube: string | null;
    linkedin: string | null;
    x: string | null;
  };
}

export const CONTACT: ContactDetails = {
  email: "info@example.com",
  phone: { display: "+00 000 000 0000", tel: "+000000000000" },
  whatsapp: { display: "+00 000 000 0000", number: "000000000000" },
  address: {
    lines: ["Street address", "City, Region, Postcode", "Country"],
    map: "https://www.google.com/maps",
  },
  social: {
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    youtube: "https://www.youtube.com/",
    linkedin: "https://www.linkedin.com/",
    x: "https://x.com/",
  },
};
