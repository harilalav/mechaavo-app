"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ListIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { NAV_LINKS } from "@/lib/config/sections";
import { useMenuDismiss } from "@/lib/hooks/useMenuDismiss";

/**
 * Hero navigation: the full logo, waves and MECHAAVO wordmark, exactly as
 * supplied (the wordmark is fine, so the logo is sized for it: see
 * .hero-nav__logo), plus links to the sections that exist on the page (see
 * lib/config/sections.ts; the hero call to action already leads into the
 * first section, so the nav does not repeat it). It is on screen while the hero is;
 * from #story on the sticky bar (SiteNavigation) takes over. From 768 px up the links sit
 * inline; on phones there is no room for them beside the logo, so they fold into
 * a menu (the button and breakpoint are in src/styles/underwater.css). Without
 * script the button could not open, so there the CSS lays the links out as a row
 * under the logo instead.
 */
export function HeroNavigation() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useMenuDismiss(open, close, headerRef, buttonRef);

  return (
    <header ref={headerRef} className="hero-nav" data-hero="nav">
      <div className="hero-nav__logo">
        <BrandLogo variant="lockup" href="/" sizes="(min-width: 1024px) 128px, 104px" priority />
      </div>
      <button
        ref={buttonRef}
        type="button"
        className="hero-nav__toggle tide-btn"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <XIcon weight="bold" aria-hidden="true" /> : <ListIcon weight="bold" aria-hidden="true" />}
        Menu
      </button>
      <nav id={menuId} aria-label="Primary" className="hero-nav__menu" data-open={open}>
        <ul className="hero-nav__list">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="hero-nav__link tide-btn" onClick={() => setOpen(false)}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
