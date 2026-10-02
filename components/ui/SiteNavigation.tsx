"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ListIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SECTION_IDS, SITE_NAV_LINKS } from "@/lib/config/sections";
import { useMenuDismiss } from "@/lib/hooks/useMenuDismiss";

/**
 * The hero nav's second state: a slim bar fixed to the top once the reader is past the
 * hero and the categories card, so the way to every section is never a scroll back up.
 * It slides in when #story reaches the top of the screen and out again when it leaves,
 * and steps aside while the hero (its own nav) or the full-screen categories stage (it
 * would cover the catalog's header) is on screen. Hidden, it is `inert`: out of the tab
 * order and the accessibility tree, so only one nav is ever exposed.
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

  // Past the start of #story? A thin strip along the top edge (2% of the screen) is the
  // observer's root, and the three story sections tile the page from #story to its end, so
  // one of them is always in the strip once #story's top has reached it. Any change of who
  // is in the strip re-reads where #story is: a jump straight from the hero to #principles
  // never has #story itself cross the strip, which is why it is not the one observed.
  useEffect(() => {
    const story = document.getElementById(SECTION_IDS.story);
    const sections = [SECTION_IDS.story, SECTION_IDS.principles, SECTION_IDS.commitment]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!story || !("IntersectionObserver" in window)) return;

    const update = () => {
      const past = story.getBoundingClientRect().top <= window.innerHeight * 0.02;
      setShown(past);
      if (!past) setOpen(false);
    };
    const observer = new IntersectionObserver(update, { rootMargin: "0px 0px -98% 0px" });
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
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
