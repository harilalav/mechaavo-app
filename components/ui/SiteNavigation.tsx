"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { handoverLine } from "@/lib/utils/handoverLine";
import { ListIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SECTION_IDS, SITE_NAV_LINKS } from "@/lib/config/sections";
import { useMenuDismiss } from "@/lib/hooks/useMenuDismiss";

/**
 * The hero nav's second state: a slim bar fixed to the top once the reader is past the
 * hero, so the way to every section is never a scroll back up. It slides in when the
 * categories section (rising over the pinned hero) reaches the handover line (handoverLine.ts: about
 * two thirds of the way up the screen), and out again when it leaves: over the hero the hero's own nav is
 * there. Hidden, it is `inert`: out of the tab order and the accessibility tree, and the
 * hero turns `inert` on the same line (heroTimeline.ts), so only one nav is ever exposed.
 *
 * The bar's line is its own height plus 2% of the screen: a jump to a section lands just
 * below the bar (`scroll-padding-top: var(--bar-h)` in globals.css), and that has to count
 * as past it.
 *
 * Fixed above the jump veil (--z-bar), so a jump dips the content while the bar stays put.
 * The same fold as the hero nav: inline links from 768 px, a Menu button below.
 * Without script it stays hidden (the hero nav is a plain row of links there).
 * Look and motion: src/styles/site-nav.css.
 */
export function SiteNavigation() {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const barRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useMenuDismiss(open, close, barRef, buttonRef);

  // Past the bar's line? A strip along the top edge, as tall as the line, is the observer's root.
  // The sections from #categories on tile the page to its end (the footer is shorter than the
  // screen, so the strip never lies in it), so one of them is always in the strip once the
  // categories' top has reached it. Any change of who is in the strip re-reads where the
  // categories are: a jump straight from the hero to #principles never has #categories itself
  // cross the strip, which is why it is not the only one observed.
  useEffect(() => {
    const first = document.getElementById(SECTION_IDS.categories) ?? document.getElementById(SECTION_IDS.story);
    const sections = [
      SECTION_IDS.categories,
      SECTION_IDS.story,
      SECTION_IDS.principles,
      SECTION_IDS.commitment,
      SECTION_IDS.contact,
    ]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!first || !("IntersectionObserver" in window)) return;

    const line = () => handoverLine(barRef.current);
    const update = () => {
      const past = first.getBoundingClientRect().top <= line();
      setShown(past);
      if (!past) setOpen(false);
    };

    let observer: IntersectionObserver | undefined;
    const watch = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(update, {
        rootMargin: `0px 0px -${Math.max(0, Math.round(window.innerHeight - line()))}px 0px`,
      });
      sections.forEach((el) => observer?.observe(el));
    };
    watch();
    // the strip is in pixels, so it follows the window's height
    window.addEventListener("resize", watch);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", watch);
    };
  }, []);

  return (
    <div ref={barRef} className="site-nav" data-show={shown} inert={!shown}>
      <div className="page-container site-nav__inner">
        <div className="site-nav__logo">
          <BrandLogo variant="lockup" href="/" sizes="96px" />
        </div>
        <button
          ref={buttonRef}
          type="button"
          className="site-nav__toggle tide-btn"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <XIcon weight="bold" aria-hidden="true" /> : <ListIcon weight="bold" aria-hidden="true" />}
          Menu
        </button>
        <nav id={menuId} aria-label="Sections" className="site-nav__menu" data-open={open}>
          <ul className="site-nav__list">
            {SITE_NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="site-nav__link tide-btn" onClick={close}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
