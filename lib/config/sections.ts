/**
 * Page sections and the links that point at them, in one place, so a label and
 * its target can never drift apart (and no two links share a destination).
 *
 * Page order: hero, then #story, #principles, #commitment.
 */
export const SECTION_IDS = {
  categories: "categories",
  story: "story",
  principles: "principles",
  commitment: "commitment",
} as const;

/**
 * Header navigation. The hero call to action is the one door into categories: the
 * nav is only on screen while the hero is (the sticky bar, SITE_NAV_LINKS, takes over from
 * #story on), where that button already sits, so it does not repeat it (one intent, one link).
 */
export const NAV_LINKS = [
  { label: "Philosophy", href: `#${SECTION_IDS.story}` },
  { label: "Principles", href: `#${SECTION_IDS.principles}` },
  { label: "Commitment", href: `#${SECTION_IDS.commitment}` },
] as const;

/**
 * The sticky bar's links (SiteNavigation): every section in page order. The bar is
 * the hero nav's second state, shown from #story on, so its Categories link and the
 * hero CTA are never on screen together (the hero nav and the bar are not either).
 */
export const SITE_NAV_LINKS = [
  { label: "Categories", href: `#${SECTION_IDS.categories}` },
  ...NAV_LINKS,
] as const;

export const HERO_CTA = {
  label: "Explore Tackle Systems",
  href: `#${SECTION_IDS.categories}`,
} as const;
