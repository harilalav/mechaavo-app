#!/usr/bin/env node
/**
 * Browser viewport sweep (npm run design:sweep).
 *
 * Loads the built site at about 27 screen sizes (phones, landscape phones, tablets,
 * laptops, desktops, ultrawide) and measures what source code cannot tell: overflow,
 * nav height, whether the hero fits, tap targets, text sizes, clipped text, layout
 * shift, keyboard order, fallbacks. The rules it enforces are in
 * docs/DESIGN-GUIDELINES.md; every gate id (G1..G15) is explained in
 * docs/design/verification.md.
 *
 *   npm run design:sweep -- --build            build a production copy on :3150, sweep it, stop it
 *   npm run design:sweep -- --build --port 3250   the same on another port (when another session holds 3150)
 *   npm run design:sweep -- --url http://localhost:3150
 *   flags: --only 320x480,phone-390   screens to run (id or WxH)        --states top,catalog
 *          --quick                    only the deep screens (8)         --shots <dir>  screenshots
 *          --json <file>              write every result                --keep  leave the server up
 *
 * Needs Google Chrome (CHROME_PATH overrides the lookup) and playwright-core
 * (a devDependency; it downloads no browser). Run it against a PRODUCTION build: the
 * dev server's overlays and StrictMode would show up as errors. Headless Chrome is not
 * Safari: iOS toolbar behaviour stays a manual check on a device.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------------------------------------ */
/* screens: id, size in CSS px (the height is what the browser really shows, bars included),   */
/* device pixel ratio, touch. `deep` screens also get reduced motion, forced colours, the      */
/* scrolled layout-shift run and the text-scale run. `info` screens only gate G1 and G10.      */
/* ------------------------------------------------------------------------------------------ */
const SCREENS = [
  { id: "phone-fold", w: 280, h: 653, dpr: 3, touch: true, info: true },
  { id: "phone-se", w: 320, h: 480, dpr: 2, touch: true },
  { id: "phone-360", w: 360, h: 640, dpr: 3, touch: true },
  { id: "phone-375", w: 375, h: 600, dpr: 3, touch: true },
  { id: "phone-390", w: 390, h: 664, dpr: 3, touch: true, deep: true },
  { id: "phone-412", w: 412, h: 760, dpr: 2.625, touch: true },
  { id: "phone-430", w: 430, h: 740, dpr: 3, touch: true },
  { id: "land-568", w: 568, h: 320, dpr: 2, touch: true, deep: true },
  { id: "land-667", w: 667, h: 340, dpr: 2, touch: true },
  { id: "land-740", w: 740, h: 360, dpr: 3, touch: true },
  { id: "land-844", w: 844, h: 340, dpr: 3, touch: true, deep: true },
  { id: "land-932", w: 932, h: 390, dpr: 3, touch: true },
  { id: "tab-600", w: 600, h: 960, dpr: 2, touch: true },
  { id: "tab-768", w: 768, h: 1024, dpr: 2, touch: true, deep: true },
  { id: "tab-820", w: 820, h: 1180, dpr: 2, touch: true },
  { id: "tab-1024p", w: 1024, h: 1366, dpr: 2, touch: true },
  { id: "tabl-1024", w: 1024, h: 690, dpr: 2, touch: true, deep: true },
  { id: "tabl-1180", w: 1180, h: 740, dpr: 2, touch: true },
  { id: "tabl-1366", w: 1366, h: 1024, dpr: 2, touch: true },
  { id: "lap-1280", w: 1280, h: 650, dpr: 2, touch: false, deep: true },
  { id: "lap-1366", w: 1366, h: 650, dpr: 1, touch: false },
  { id: "lap-1440", w: 1440, h: 780, dpr: 2, touch: false },
  { id: "lap-1536", w: 1536, h: 730, dpr: 1.25, touch: false },
  { id: "desk-1920", w: 1920, h: 950, dpr: 1, touch: false, deep: true },
  { id: "desk-2560", w: 2560, h: 1300, dpr: 1, touch: false },
  { id: "ultra-3440", w: 3440, h: 1300, dpr: 1, touch: false, deep: true },
  { id: "uhd-3840", w: 3840, h: 2000, dpr: 1, touch: false },
];

const GATES = {
  G1: "no horizontal overflow",
  G2: "nav: one line, at most 80 px, logo inside",
  G3: "fit: hero, statement, catalog and dialog fit the screen",
  G4: "targets: 44 px touch / 24 px pointer, 8 px apart on touch",
  G5: "text floors: 12 labels, 14 secondary, 16 running",
  G6: "no clipped text",
  G7: "layout shift at most 0.01",
  G8: "no-script and reduced motion still work",
  G9: "no em or en dash anywhere",
  G10: "no console errors or failed requests",
  G11: "keyboard: every stop in view, visible, not covered; tiles reachable",
  G12: "one h1, no skipped heading level",
  G13: "eyebrow budget ceil(sections / 3)",
  G14: "left edges on the column edge",
  G15: "media: sized, alt, poster and pause, canvases inert",
};

/** Thresholds. Mirrors docs/DESIGN-GUIDELINES.md (sections 6 and 7); change both together. */
const T = {
  navMaxPx: 80,
  touchTargetPx: 44,
  pointerTargetPx: 24,
  targetGapPx: 8,
  floorLabel: 12,
  floorSecondary: 14,
  floorRunning: 16,
  labelWords: 3,
  runningWords: 12,
  clsFail: 0.01,
  alignTolPx: 1.5,
  shortPx: 544, // 34rem
};

const STATES_JS = ["top", "caught", "catalog", "modal", "story", "principles", "commitment"];
const STATES_STATIC = ["top", "catalog", "story", "principles", "commitment"];

/* ------------------------------------------------------------------------------------------ */
/* in-page measurement. Self-contained: Playwright serialises these, so no outer variables.    */
/* ------------------------------------------------------------------------------------------ */

/** Everything measured on the current screen state. Facts only; judgement is in judge(). */
const probe = (cfg) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const round = (n) => Math.round(n * 10) / 10;
  const trim = (s, n = 60) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { l: round(r.left), t: round(r.top), r: round(r.right), b: round(r.bottom), w: round(r.width), h: round(r.height) };
  };
  const sel = (el) => {
    if (!el || !el.tagName) return "?";
    let s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    const cls = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return cls.length ? s + "." + cls.join(".") : s;
  };
  const ancestorOk = (() => {
    const memo = new WeakMap();
    const f = (el) => {
      if (!el || el.nodeType !== 1) return true;
      if (memo.has(el)) return memo.get(el);
      const cs = getComputedStyle(el);
      const ok = cs.display !== "none" && parseFloat(cs.opacity) !== 0 && f(el.parentElement);
      memo.set(el, ok);
      return ok;
    };
    return f;
  })();
  const isVisible = (el) => {
    if (!ancestorOk(el)) return false;
    if (getComputedStyle(el).visibility !== "visible") return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  const q = (s) => document.querySelector(s);
  const out = { vw, vh, coarse: window.matchMedia("(pointer: coarse)").matches, hover: window.matchMedia("(hover: hover)").matches };

  /* G1: with the body's overflow guard switched off, does anything stick out? */
  {
    const guard = document.createElement("style");
    guard.textContent = "html,body{overflow-x:visible !important}";
    document.head.append(guard);
    const scrollW = doc.scrollWidth;
    guard.remove();
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body && p !== doc; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== "visible") return true;
      }
      return false;
    };
    const offenders = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
      if (clipped(el)) continue;
      offenders.push(`${sel(el)} spans ${round(r.left)}..${round(r.right)}`);
      if (offenders.length >= 6) break;
    }
    out.overflow = { docPx: round(scrollW - doc.clientWidth), scrollbarPx: vw - doc.clientWidth, offenders };
  }

  /* G2: the nav bar */
  {
    const nav = q('[data-hero="nav"]');
    if (nav) {
      const links = [...nav.querySelectorAll(".hero-nav__link")].filter(isVisible);
      const toggle = nav.querySelector(".hero-nav__toggle");
      const logo = nav.querySelector(".brand-link");
      const tops = new Set(links.map((l) => Math.round(l.getBoundingClientRect().top / 6)));
      out.nav = {
        r: rectOf(nav),
        links: links.length,
        allLinks: nav.querySelectorAll(".hero-nav__link").length,
        lines: tops.size,
        toggleVisible: !!toggle && isVisible(toggle),
        logo: logo ? rectOf(logo) : null,
      };
    }
  }

  /* G2 again: the sticky bar (the hero nav's second state), when it is showing */
  {
    const bar = q('.site-nav[data-show="true"]');
    if (bar && isVisible(bar)) {
      const links = [...bar.querySelectorAll(".site-nav__link")].filter(isVisible);
      const tops = new Set(links.map((l) => Math.round(l.getBoundingClientRect().top / 6)));
      const toggle = bar.querySelector(".site-nav__toggle");
      out.siteNav = { r: rectOf(bar), links: links.length, lines: tops.size, toggleVisible: !!toggle && isVisible(toggle) };
    }
  }

  /* G3: the hero and its neighbours */
  {
    const take = (s) => {
      const el = q(s);
      return el && isVisible(el) ? rectOf(el) : null;
    };
    const h1 = q(".hero-title");
    const cta = q(".hero-cta");
    let ctaLines = null;
    const ctaText = cta && [...cta.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (ctaText) {
      const range = document.createRange();
      range.selectNodeContents(ctaText);
      ctaLines = range.getClientRects().length;
    }
    const track = q(".hero-track");
    out.hero = {
      root: take(".hero-root"),
      kicker: take(".hero-kicker"),
      h1: take(".hero-title"),
      tagline: take(".hero-tagline"),
      lede: take(".hero-lede"),
      cta: take(".hero-cta"),
      caption: take(".hero-caption:first-child"),
      sound: take(".sound-toggle"),
      statement: take(".hero-statement"),
      h1Lines: h1 ? Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)) : null,
      ctaLines,
      trackH: track ? round(track.getBoundingClientRect().height) : null,
      caught: !!q(".hero-root[data-caught]"),
    };
    const cat = q(".cat-catalog");
    out.catalog = cat && isVisible(cat) ? { scrolls: cat.scrollHeight > cat.clientHeight + 2, clientH: cat.clientHeight, scrollH: cat.scrollHeight } : null;
    const panel = q(".cat-modal__panel");
    if (panel) {
      const pr = panel.getBoundingClientRect();
      const close = q('.cat-modal [aria-label="Close modal"]');
      const scrolls = panel.scrollHeight > panel.clientHeight + 2;
      panel.scrollTop = panel.scrollHeight;
      const cr = close ? close.getBoundingClientRect() : null;
      const pr2 = panel.getBoundingClientRect();
      out.modal = {
        panel: rectOf(panel),
        fits: pr.top >= -0.5 && pr.bottom <= vh + 0.5 && pr.left >= -0.5 && pr.right <= vw + 0.5,
        scrolls,
        closeVisibleAtEnd: !!cr && cr.top >= pr2.top - 1 && cr.bottom <= pr2.bottom + 1,
        overscroll: getComputedStyle(panel).overscrollBehaviorY,
      };
      panel.scrollTop = 0;
    }
  }

  /* G4: interactive targets (with a dialog open, only the dialog's: the page behind it cannot be pressed) */
  {
    const seen = new Set();
    const list = [];
    const scope = q(".cat-modal") ?? document;
    // the scrolling container a target lives in: a floating control over scrolling content is not gap-checked against it
    const scrollIds = new Map();
    const scrollParentOf = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if (oy === "auto" || oy === "scroll") {
          if (!scrollIds.has(p)) scrollIds.set(p, scrollIds.size + 1);
          return scrollIds.get(p);
        }
      }
      return 0;
    };
    for (const el of scope.querySelectorAll('a[href], button, [role="button"], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')) {
      if (seen.has(el) || el.matches(":disabled") || el.closest("[inert]")) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.pointerEvents === "none" || !isVisible(el)) continue;
      if (el.tagName === "A" && el.closest("p, li") && cs.display === "inline") continue; // WCAG 2.5.8 inline exception
      const r = el.getBoundingClientRect();
      // covered by something else (the hero under the story sheet, a tile under the dialog): not a target right now
      const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2));
      const cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
      const top = document.elementFromPoint(cx, cy);
      if (top && !el.contains(top) && !top.contains(el)) continue;
      list.push({
        sel: sel(el),
        text: trim(el.textContent || el.getAttribute("aria-label"), 22),
        l: round(r.left), t: round(r.top), r: round(r.right), b: round(r.bottom), w: round(r.width), h: round(r.height),
        sp: scrollParentOf(el),
      });
    }
    out.targets = list;
  }

  /* G5 and G6: text sizes and clipped text */
  {
    const els = new Set();
    // with a dialog open, the dialog's text (the page behind it was measured in its own state)
    const walker = document.createTreeWalker(q(".cat-modal") ?? document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.nodeValue.trim()) continue;
      const el = n.parentElement;
      if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION)$/.test(el.tagName) || el.closest("svg,canvas")) continue;
      els.add(el);
    }
    const sizes = [];
    const clipped = [];
    // the box of the words themselves: decorative aria-hidden pieces inside (the heading plate) are not text
    const textBox = (el) => {
      let left = Infinity;
      let right = -Infinity;
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) {
        const n = tw.currentNode;
        if (!n.nodeValue.trim()) continue;
        const hidden = n.parentElement.closest('[aria-hidden="true"]');
        if (hidden && hidden !== el && el.contains(hidden)) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const rr = range.getBoundingClientRect();
        left = Math.min(left, rr.left);
        right = Math.max(right, rr.right);
      }
      return { left, right };
    };
    for (const el of els) {
      if (!isVisible(el)) continue;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(" ").trim();
      const ownWords = own.split(/\s+/).filter(Boolean).length;
      const para = /^(P|LI|DD|BLOCKQUOTE|FIGCAPTION)$/.test(el.tagName);
      const words = para ? el.textContent.trim().split(/\s+/).filter(Boolean).length : ownWords;
      const tracking = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) / size;
      // a label is short, or set as a label (uppercase, tracked), or lives in a control
      const labelish = words <= cfg.labelWords || (cs.textTransform === "uppercase" && tracking >= 0.06) || !!el.closest("a,button,[role=button],summary,label");
      let kind = "secondary";
      let floor = cfg.floorSecondary;
      if (labelish) {
        kind = "label";
        floor = cfg.floorLabel;
      } else if (para && words >= cfg.runningWords) {
        const secondary = !!el.closest('[data-text="secondary"]');
        kind = secondary ? "secondary" : "running";
        floor = secondary ? cfg.floorSecondary : cfg.floorRunning;
      }
      if (size < floor - 0.05) sizes.push(`${sel(el)} ${round(size)}px (${kind} floor ${floor}) "${trim(own || el.textContent, 28)}"`);

      // clipped: the text's own box leaves the nearest clipping ancestor sideways
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const pcs = getComputedStyle(p);
        if (pcs.overflowX === "visible" && pcs.overflowY === "visible") continue;
        if (pcs.overflowX === "auto" || pcs.overflowX === "scroll") break;
        if (pcs.webkitLineClamp && pcs.webkitLineClamp !== "none") break;
        const tr = textBox(el);
        const pr = p.getBoundingClientRect();
        if (pcs.overflowX !== "visible" && (tr.right > pr.right + 1 || tr.left < pr.left - 1)) {
          clipped.push(`${sel(el)} "${trim(own || el.textContent, 24)}" is cut by ${sel(p)} (${round(tr.left)}..${round(tr.right)} in ${round(pr.left)}..${round(pr.right)})`);
        }
        break;
      }
    }
    out.text = { sizes: sizes.slice(0, 12), sizeCount: sizes.length, clipped: clipped.slice(0, 8) };
  }

  /* G9: dashes in everything a person or a screen reader meets */
  {
    const found = [];
    const test = (where, s) => {
      const m = s && /([\s\S]{0,24})([–—])([\s\S]{0,24})/.exec(s);
      if (m) found.push(`${where}: "${trim(m[1] + m[2] + m[3], 52)}"`);
    };
    test("title", document.title);
    test("meta description", q('meta[name="description"]')?.content);
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
    test("page text", clone.textContent);
    for (const el of document.querySelectorAll("[aria-label],[alt],[title],[placeholder],[aria-description]")) {
      for (const a of ["aria-label", "alt", "title", "placeholder", "aria-description"]) test(`${a} on ${sel(el)}`, el.getAttribute(a));
    }
    out.dashes = found;
  }

  /* G12: headings */
  {
    const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    const levels = hs.map((h) => Number(h.tagName[1]));
    const skips = [];
    levels.forEach((lv, i) => {
      if (i > 0 && lv - levels[i - 1] > 1) skips.push(`${hs[i - 1].tagName} then ${hs[i].tagName} "${trim(hs[i].textContent, 24)}"`);
    });
    out.headings = { h1: levels.filter((l) => l === 1).length, skips };
  }

  /* G13: eyebrows (small uppercase tracked labels that sit directly above a heading) */
  {
    const headingish = (el) => !!el && (/^H[1-6]$/.test(el.tagName) || el.hasAttribute("data-tide") || !!el.querySelector?.("h1,h2,h3,[data-tide]"));
    const list = [];
    for (const el of document.querySelectorAll("main p, main span, main div")) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(" ").trim();
      const words = own.split(/\s+/).filter(Boolean).length;
      if (!words || words > 6 || el.querySelector("h1,h2,h3,h4,[data-tide]")) continue;
      if (el.closest("a,button,nav,summary,label,[role=dialog],[aria-hidden=true] .hero-caption")) continue;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const tracking = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) / size;
      if (cs.textTransform !== "uppercase" || tracking < 0.1 || size > 14.5) continue;
      let next = el.nextElementSibling;
      if (!next && el.parentElement) next = el.parentElement.nextElementSibling;
      if (headingish(next)) list.push(`${sel(el)} "${trim(own, 24)}"`);
    }
    out.eyebrows = { count: list.length, sections: document.querySelectorAll("main section").length, list };
  }

  /* G14: left edges */
  {
    const bad = [];
    const pc = q("main .page-container");
    if (pc) {
      const pcs = getComputedStyle(pc);
      const left = pc.getBoundingClientRect().left + parseFloat(pcs.paddingLeft);
      const check = (el, name, expected) => {
        if (!el || !isVisible(el)) return;
        const l = el.getBoundingClientRect().left;
        if (Math.abs(l - expected) > cfg.alignTolPx) bad.push(`${name} starts at ${round(l)}, the column edge is ${round(expected)}`);
      };
      check(q(".hero-copy"), ".hero-copy", left);
      check(q(".hero-nav__logo"), ".hero-nav__logo", left);
      check(q(".hero-captions"), ".hero-captions", left);
      check(q(".hero-statement"), ".hero-statement", left);
      for (const container of document.querySelectorAll("main .page-container")) {
        const cs = getComputedStyle(container);
        const cl = container.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
        for (const child of container.children) {
          if (parseFloat(getComputedStyle(child).marginLeft) > 0.5 || !isVisible(child)) continue;
          check(child, sel(child), cl);
        }
      }
    }
    out.align = bad;
  }

  /* G15: media */
  {
    const imgs = [];
    for (const img of document.querySelectorAll("img")) {
      const r = img.getBoundingClientRect();
      const problems = [];
      if (img.getAttribute("alt") === null) problems.push("no alt attribute");
      const near = r.bottom > -vh && r.top < vh * 2 && r.width > 0;
      if (near && img.complete && img.naturalWidth === 0) problems.push("failed to load");
      const cs = getComputedStyle(img);
      if (!((img.getAttribute("width") && img.getAttribute("height")) || cs.aspectRatio !== "auto" || cs.position === "absolute")) {
        problems.push("no width/height or aspect-ratio (layout shift)");
      }
      if (problems.length) imgs.push(`${sel(img)}: ${problems.join(", ")}`);
    }
    const videos = [];
    for (const v of document.querySelectorAll("video")) {
      const problems = [];
      if (!v.muted && !v.hasAttribute("muted")) problems.push("not muted");
      if (!v.playsInline && !v.hasAttribute("playsinline")) problems.push("no playsinline");
      const panel = v.parentElement;
      // the poster image mounts when the panel is within ~400px of the viewport, so only expect it then
      const pr = panel?.getBoundingClientRect();
      const near = !!pr && pr.bottom > -300 && pr.top < vh + 300;
      if (near && !v.getAttribute("poster") && !panel?.querySelector("img")) problems.push("no poster");
      if (!panel?.querySelector('button[aria-label*="ause" i], button[aria-label*="lay" i]') && !document.querySelector(".cat-toggle")) problems.push("no pause control");
      if (problems.length) videos.push(`${sel(v)}: ${problems.join(", ")}`);
    }
    const canvases = [...document.querySelectorAll("canvas")].filter((c) => getComputedStyle(c).pointerEvents !== "none").map(sel);
    out.media = { imgs, videos, canvases };
  }

  return out;
};

/** The static-fallback facts (no script, reduced motion, forced colours). */
const probeStatic = () => {
  const q = (s) => document.querySelector(s);
  const vh = window.innerHeight;
  const ancestorVisible = (el) => {
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === "none" || parseFloat(cs.opacity) < 0.9) return false;
    }
    return getComputedStyle(el).visibility === "visible";
  };
  const hidden = [];
  for (const h of document.querySelectorAll("h1,h2,h3")) {
    if (h.closest(".hero-statement-slot") || h.closest(".cat-modal")) continue; // unseen by design (words stay in the page)
    const r = h.getBoundingClientRect();
    if (!ancestorVisible(h) || r.width < 2 || r.height < 2) hidden.push(`${h.tagName.toLowerCase()} "${h.textContent.trim().slice(0, 28)}"`);
  }
  const links = [...document.querySelectorAll(".hero-nav__link")].map((a) => {
    const r = a.getBoundingClientRect();
    const cs = getComputedStyle(a);
    return { text: a.textContent.trim(), ok: ancestorVisible(a) && r.width >= 2 && r.height >= 2 && cs.visibility === "visible" };
  });
  const ids = ["categories", "story", "principles", "commitment"].filter((id) => !document.getElementById(id));
  const infinite = document
    .getAnimations()
    .filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && a.playState === "running")
    .map((a) => a.animationName || a.constructor.name)
    .slice(0, 6);
  const track = q(".hero-track");
  const gradientText = [...document.querySelectorAll(".hero-title .hero-line__inner, .tide")]
    .slice(0, 6)
    .filter((el) => getComputedStyle(el).webkitTextFillColor === "rgba(0, 0, 0, 0)" && getComputedStyle(el).backgroundImage === "none")
    .map((el) => el.className);
  return { hidden, links, missingIds: ids, infinite, trackH: track ? track.getBoundingClientRect().height : null, vh, gradientText };
};

/* ------------------------------------------------------------------------------------------ */
/* judgement                                                                                   */
/* ------------------------------------------------------------------------------------------ */

const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

function judge(d, c) {
  const out = []; // { gate, problems: [], warns: [] }
  const gate = (id, problems = [], warns = []) => out.push({ gate: id, problems, warns });
  const { state } = c;

  gate("G1", [
    ...(d.overflow.docPx > 1 ? [`page is ${d.overflow.docPx}px wider than the screen`] : []),
    ...d.overflow.offenders,
  ]);

  const fit = [];
  const fitWarn = [];
  if (state === "top") {
    const h = d.hero;
    if (!h.root) fit.push("no hero");
    else if (h.root.h > d.vh + 1) fit.push(`hero is ${h.root.h}px tall on a ${d.vh}px screen`);
    const items = { kicker: h.kicker, headline: h.h1, tagline: h.tagline, lede: h.lede, cta: h.cta, caption: h.caption, sound: h.sound };
    if (!h.h1) fit.push("headline not visible");
    if (!h.cta) fit.push("call to action not visible");
    for (const [name, r] of Object.entries(items)) {
      if (r && (r.b > d.vh + 1 || r.t < -1 || r.r > d.vw + 1 || r.l < -1)) fit.push(`${name} outside the screen (${r.l},${r.t} to ${r.r},${r.b} on ${d.vw}x${d.vh})`);
    }
    if (h.h1Lines > 2) fit.push(`headline wraps to ${h.h1Lines} lines`);
    if (h.ctaLines > 1) fit.push(`call to action label wraps to ${h.ctaLines} lines`);
    const boxes = Object.entries({ nav: d.nav?.r, ...items }).filter(([, r]) => r);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const area = overlap(boxes[i][1], boxes[j][1]);
        if (area > 12) fit.push(`${boxes[i][0]} overlaps ${boxes[j][0]} (${Math.round(area)}px2)`);
      }
    }
    if (h.caption && h.sound && h.caption.t < h.sound.b && h.caption.b > h.sound.t && h.sound.l - h.caption.r < 8) {
      fit.push(`caption and sound button are ${Math.round(h.sound.l - h.caption.r)}px apart`);
    }
  }
  if (state === "caught" && d.hero.statement) {
    const r = d.hero.statement;
    if (r.b > d.vh + 1 || r.r > d.vw + 1 || r.l < -1) fit.push(`statement outside the screen (${r.l},${r.t} to ${r.r},${r.b})`);
    if (d.nav && overlap(r, d.nav.r) > 12) fit.push("statement overlaps the nav");
  }
  if (state === "catalog" && d.catalog?.scrolls) {
    const msg = `catalog scrolls inside itself (${d.catalog.scrollH}px of content in ${d.catalog.clientH}px)`;
    if (d.vh >= T.shortPx) fit.push(msg);
    else fitWarn.push(msg + ", the short-screen fallback");
  }
  if (state === "modal") {
    if (!d.modal) fit.push("dialog did not open");
    else {
      if (!d.modal.fits) fit.push(`dialog panel leaves the screen (${d.modal.panel.t}..${d.modal.panel.b} on ${d.vh})`);
      if (d.modal.scrolls && !d.modal.closeVisibleAtEnd) fit.push("close button scrolls out of reach when the dialog is read to the end");
      if (d.modal.scrolls && d.modal.overscroll !== "contain") fitWarn.push(`dialog overscroll-behavior is ${d.modal.overscroll} (the page behind scrolls at the end)`);
    }
  }
  if (state === "top" || state === "caught" || state === "catalog" || state === "modal") gate("G3", fit, fitWarn);

  if (state === "top") {
    const n = d.nav;
    const problems = [];
    if (!n) problems.push("nav not found");
    else {
      if (n.r.h > T.navMaxPx + 0.5) problems.push(`nav bar is ${n.r.h}px tall (cap ${T.navMaxPx})`);
      if (n.links >= 2 && n.lines !== 1) problems.push(`nav links sit on ${n.lines} lines`);
      if (!n.links && !n.toggleVisible) problems.push("no nav links and no Menu button");
      if (n.logo && (n.logo.l < -1 || n.logo.r > d.vw + 1)) problems.push("logo outside the screen");
    }
    gate("G2", problems);
  }

  if (d.siteNav) {
    const n = d.siteNav;
    const problems = [];
    if (n.r.h > T.navMaxPx + 0.5) problems.push(`sticky bar is ${n.r.h}px tall (cap ${T.navMaxPx})`);
    if (n.links >= 2 && n.lines !== 1) problems.push(`sticky bar links sit on ${n.lines} lines`);
    if (!n.links && !n.toggleVisible) problems.push("sticky bar has no links and no Menu button");
    gate("G2", problems);
  }

  {
    const min = d.coarse ? T.touchTargetPx : T.pointerTargetPx;
    const problems = [];
    for (const t of d.targets) {
      if (Math.min(t.w, t.h) < min - 0.5) problems.push(`${t.sel} "${t.text}" is ${t.w}x${t.h} (min ${min})`);
    }
    if (d.coarse) {
      const contains = (a, b) => a.l <= b.l && a.r >= b.r && a.t <= b.t && a.b >= b.b;
      for (let i = 0; i < d.targets.length; i++) {
        for (let j = i + 1; j < d.targets.length; j++) {
          const a = d.targets[i];
          const b = d.targets[j];
          if (contains(a, b) || contains(b, a)) continue;
          if (a.sp !== b.sp) continue; // a floating control over scrolling content (the pause button over the catalog)
          const dx = Math.max(a.l - b.r, b.l - a.r, 0);
          const dy = Math.max(a.t - b.b, b.t - a.b, 0);
          const gap = Math.hypot(dx, dy);
          if (gap < T.targetGapPx - 0.5) problems.push(`"${a.text}" and "${b.text}" are ${Math.round(gap)}px apart (min ${T.targetGapPx})`);
        }
      }
    }
    gate("G4", problems.slice(0, 10));
  }

  gate("G5", d.text.sizes);
  gate("G6", d.text.clipped);

  if (state === "top") {
    gate("G9", d.dashes);
    gate("G12", [...(d.headings.h1 !== 1 ? [`${d.headings.h1} h1 elements`] : []), ...d.headings.skips]);
    const budget = Math.ceil(d.eyebrows.sections / 3);
    gate("G13", d.eyebrows.count > budget ? [`${d.eyebrows.count} eyebrows in ${d.eyebrows.sections} sections (budget ${budget}): ${d.eyebrows.list.join("; ")}`] : []);
  }
  // media is checked wherever a panel is near, because the poster only mounts then
  if (state === "top" || state === "catalog" || state === "story") {
    gate("G15", [...d.media.imgs, ...d.media.videos, ...d.media.canvases.map((c2) => `${c2} accepts pointer events`)]);
  }
  if (["top", "caught", "catalog", "story", "principles", "commitment"].includes(state)) gate("G14", d.align);
  return out;
}

function judgeStatic(s, c) {
  const problems = [];
  if (s.missingIds.length) problems.push(`sections missing: ${s.missingIds.join(", ")}`);
  // without script or without motion the page is the plain layout: everything is there from the start
  if (c.mode === "nojs" || c.mode === "reduced") {
    if (s.hidden.length) problems.push(`headings not visible: ${s.hidden.join(", ")}`);
    if (s.trackH && s.trackH > s.vh * 1.25) problems.push(`hero is still ${Math.round(s.trackH)}px tall (a scroll track) without motion`);
  }
  if (c.mode === "nojs") {
    const dead = s.links.filter((l) => !l.ok).map((l) => l.text);
    if (dead.length) problems.push(`nav links not reachable without script: ${dead.join(", ")}`);
  }
  if (c.mode === "reduced" && s.infinite.length) problems.push(`animations still looping under reduced motion: ${s.infinite.join(", ")}`);
  if (c.mode === "forced" && s.gradientText.length) problems.push(`gradient text turns invisible in forced colours: ${s.gradientText.join(", ")}`);
  return problems;
}

/* ------------------------------------------------------------------------------------------ */
/* running                                                                                     */
/* ------------------------------------------------------------------------------------------ */

const CLS_SCRIPT = () => {
  window.__cls = { value: 0, shifts: [] };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__cls.value += e.value;
        window.__cls.shifts.push({
          value: Math.round(e.value * 10000) / 10000,
          sources: (e.sources || []).slice(0, 3).map((s) => (s.node ? s.node.nodeName.toLowerCase() + (typeof s.node.className === "string" && s.node.className ? "." + s.node.className.split(" ")[0] : "") : "?")),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    /* no layout-shift entries in this browser */
  }
};

const wait = (page, ms) => page.waitForTimeout(ms);
const scrollTo = async (page, y, ms = 1900) => {
  await page.evaluate((top) => window.scrollTo(0, top), Math.max(0, Math.round(y)));
  await wait(page, ms);
};

async function geometry(page) {
  return page.evaluate(() => {
    const abs = (el) => (el ? el.getBoundingClientRect().top + window.scrollY : null);
    const h = (el) => (el ? el.getBoundingClientRect().height : null);
    const cat = document.getElementById("categories");
    const track = document.querySelector(".hero-track");
    return {
      vh: window.innerHeight,
      heroTrackH: h(track),
      catTop: abs(cat),
      catH: h(cat),
      story: abs(document.getElementById("story")),
      principles: abs(document.getElementById("principles")),
      commitment: abs(document.getElementById("commitment")),
    };
  });
}

async function enter(page, state, mode) {
  const g = await geometry(page);
  const scripted = mode === "js";
  switch (state) {
    case "top":
      await scrollTo(page, 0, 700);
      break;
    case "caught": {
      const story = Math.max(0, g.heroTrackH - 2 * g.vh);
      await scrollTo(page, story * 0.3, 4200);
      const caught = await page.evaluate(() => !!document.querySelector(".hero-root[data-caught]"));
      if (!caught) {
        await page.evaluate(() => document.querySelector(".hero-root")?.setAttribute("data-caught", ""));
        await wait(page, 1900);
        return { forced: true };
      }
      break;
    }
    case "catalog":
      await scrollTo(page, scripted ? g.catTop + Math.max(0, g.catH - g.vh) * 0.8 : g.catTop, 2600);
      break;
    case "modal":
      await page.evaluate(() => document.querySelector(".cat-card")?.click());
      await wait(page, 1000);
      break;
    case "story":
      await page.keyboard.press("Escape").catch(() => {});
      await wait(page, 500);
      await scrollTo(page, g.story, 1500);
      break;
    case "principles":
      await scrollTo(page, g.principles, 1300);
      break;
    case "commitment":
      await scrollTo(page, g.commitment, 1300);
      break;
    default:
      break;
  }
  return {};
}

async function readyHero(page, scripted) {
  if (scripted) await page.waitForSelector(".hero-root[data-ready]", { timeout: 15000 }).catch(() => {});
  await wait(page, scripted ? 1700 : 700);
}

function collect(page) {
  const ev = { errors: [], failed: [] };
  page.on("console", (m) => {
    if (m.type() === "error") ev.errors.push(m.text().slice(0, 180));
  });
  page.on("pageerror", (e) => ev.errors.push(`pageerror: ${String(e).slice(0, 180)}`));
  page.on("requestfailed", (r) => {
    const why = r.failure()?.errorText ?? "";
    if (!/ERR_ABORTED/.test(why)) ev.failed.push(`${r.url().slice(-70)} ${why}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) ev.failed.push(`${r.status()} ${r.url().slice(-70)}`);
  });
  return ev;
}

async function tabWalk(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur?.();
  });
  await wait(page, 800);
  const stops = [];
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press("Tab");
    await wait(page, 70);
    // focusing a category tile while the card is closed opens it (the page scrolls into the hold): let the catalog finish fading in before measuring
    if (await page.evaluate(() => document.activeElement?.classList.contains("cat-card"))) {
      await page
        .waitForFunction(() => parseFloat(getComputedStyle(document.querySelector(".cat-catalog")).opacity) >= 0.99, undefined, { timeout: 5000 })
        .catch(() => {});
      await wait(page, 150);
    }
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const area = Math.max(1, r.width * r.height);
      const inter = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2));
      const cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
      const top = document.elementFromPoint(cx, cy);
      const cs = getComputedStyle(el);
      const outlined = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24);
      return {
        key: `${el.tagName}|${label}|${Math.round(r.left)}|${Math.round(r.top + window.scrollY)}`,
        text: `${el.tagName.toLowerCase()} "${label}"`,
        inView: inter / area,
        covered: !!top && top !== el && !el.contains(top) && !top.contains(el),
        indicator: outlined || cs.boxShadow !== "none" || el.classList.contains("tide-btn"),
        tile: el.classList.contains("cat-card"),
        skip: el.classList.contains("skip-link"),
      };
    });
    if (!info) break;
    if (stops.length && info.key === stops[0].key) break;
    stops.push(info);
  }
  // leave nothing focused: the skip link would stay on screen over the logo for every later measurement
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
  });
  return stops;
}

function judgeTabs(stops, mode) {
  const problems = [];
  const warns = [];
  if (!stops.length) problems.push("Tab reaches nothing");
  else if (!stops[0].skip) problems.push(`the first Tab stop is ${stops[0].text}, not a skip link`);
  for (const s of stops) {
    if (s.inView < 0.9) problems.push(`${s.text} is focused but ${Math.round((1 - s.inView) * 100)}% outside the screen`);
    else if (s.covered) problems.push(`${s.text} is focused but something covers it`);
    if (!s.indicator) warns.push(`${s.text} shows no focus indicator`);
  }
  const tiles = stops.filter((s) => s.tile).length;
  if (tiles !== 8) problems.push(`${tiles} of 8 category tiles are reachable with Tab${mode === "js" ? " (the catalog is hidden until the card has opened)" : ""}`);
  return { problems: problems.slice(0, 8), warns: warns.slice(0, 4) };
}

async function clsRun(page, vh) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const step = Math.max(200, Math.round(vh * 0.5));
  for (let y = 0; y <= total; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await wait(page, 260);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(page, 700);
  return page.evaluate(() => window.__cls ?? { value: 0, shifts: [] });
}

function ctxOptions(screen, extra = {}) {
  return {
    viewport: { width: screen.w, height: screen.h },
    deviceScaleFactor: screen.dpr,
    isMobile: screen.touch,
    hasTouch: screen.touch,
    locale: "en-US",
    ...extra,
  };
}

async function runScreen(browser, screen, o, results) {
  const record = (mode, state, gateId, problems, warns = []) => {
    results.push({ screen: screen.id, mode, state, gate: gateId, status: problems.length ? "fail" : warns.length ? "warn" : "pass", problems, warns });
  };
  const shot = async (page, name) => {
    if (!o.shots || !["top", "caught", "catalog", "modal"].includes(name)) return;
    mkdirSync(o.shots, { recursive: true });
    await page.screenshot({ path: join(o.shots, `${screen.id}-${name}.png`), scale: "css", timeout: 120000 }).catch(() => {});
  };

  /* ---- script on, motion allowed */
  {
    const ctx = await browser.newContext(ctxOptions(screen));
    await ctx.addInitScript(CLS_SCRIPT);
    const page = await ctx.newPage();
    const ev = collect(page);
    await page.goto(o.url, { waitUntil: "load", timeout: 60000 });
    await readyHero(page, true);

    // the Tab walk goes first: a page that has had focus in a dialog starts its next Tab from there
    if (o.states.includes("top")) {
      const stops = await tabWalk(page);
      const t = judgeTabs(stops, "js");
      record("js", "tab", "G11", t.problems, t.warns);
    }

    const initial = await page.evaluate(() => window.__cls ?? { value: 0, shifts: [] });
    const cfg = { ...T };
    for (const state of o.states.filter((s) => STATES_JS.includes(s))) {
      const note = await enter(page, state, "js");
      const data = await page.evaluate(probe, cfg);
      if (state === "top" && !data.coarse === screen.touch) {
        results.push({ screen: screen.id, mode: "js", state, gate: "G4", status: "warn", problems: [], warns: [`pointer emulation: coarse=${data.coarse} but touch=${screen.touch}`] });
      }
      for (const r of judge(data, { screen, state })) record("js", state, r.gate, r.problems.map((p) => (note.forced ? `[forced data-caught] ${p}` : p)), r.warns);
      await shot(page, state);
      if (state === "modal") {
        await page.keyboard.press("Escape").catch(() => {});
        await wait(page, 400);
      }
    }

    const total = Math.round((initial.value + Number.EPSILON) * 10000) / 10000;
    record("js", "load", "G7", total > T.clsFail ? [`layout shift ${total} while loading: ${initial.shifts.map((s) => `${s.value} ${s.sources.join("/")}`).join("; ")}`] : [], total > 0 && total <= T.clsFail ? [`layout shift ${total} while loading`] : []);
    if (screen.deep && !o.noDeep) {
      const cls = await clsRun(page, screen.h);
      const v = Math.round(cls.value * 10000) / 10000;
      record("js", "scroll", "G7", v > T.clsFail ? [`layout shift ${v} while scrolling the page: ${cls.shifts.slice(0, 5).map((s) => `${s.value} ${s.sources.join("/")}`).join("; ")}`] : [], v > 0 && v <= T.clsFail ? [`layout shift ${v} while scrolling`] : []);
    }
    record("js", "all", "G10", [...new Set(ev.errors)].slice(0, 5).concat([...new Set(ev.failed)].slice(0, 5)));
    await ctx.close();
  }

  /* ---- no script */
  {
    const ctx = await browser.newContext(ctxOptions(screen, { javaScriptEnabled: false }));
    const page = await ctx.newPage();
    await page.goto(o.url, { waitUntil: "load", timeout: 60000 });
    await readyHero(page, false);
    const cfg = { ...T };
    for (const state of STATES_STATIC.filter((s) => o.states.includes(s))) {
      await enter(page, state, "nojs");
      const data = await page.evaluate(probe, cfg);
      for (const r of judge(data, { screen, state })) {
        if (r.gate === "G1" || r.gate === "G3" || r.gate === "G6") record("nojs", state, r.gate, r.problems, r.warns);
      }
    }
    await enter(page, "top", "nojs");
    record("nojs", "all", "G8", judgeStatic(await page.evaluate(probeStatic), { mode: "nojs" }));
    await ctx.close();
  }

  /* ---- reduced motion, forced colours, bigger text, a classic scrollbar (deep screens) */
  if (screen.deep && !o.noDeep) {
    for (const [mode, extra] of [
      ["reduced", { reducedMotion: "reduce" }],
      ["forced", { forcedColors: "active" }],
    ]) {
      const ctx = await browser.newContext(ctxOptions(screen, extra));
      const page = await ctx.newPage();
      await page.goto(o.url, { waitUntil: "load", timeout: 60000 });
      await readyHero(page, true);
      const cfg = { ...T };
      for (const state of STATES_STATIC.filter((s) => o.states.includes(s))) {
        await enter(page, state, mode);
        const data = await page.evaluate(probe, cfg);
        for (const r of judge(data, { screen, state })) {
          if (r.gate === "G1" || r.gate === "G3" || r.gate === "G6") record(mode, state, r.gate, r.problems, r.warns);
        }
      }
      await enter(page, "top", mode);
      record(mode, "all", "G8", judgeStatic(await page.evaluate(probeStatic), { mode }));
      await ctx.close();
    }

    {
      const ctx = await browser.newContext(ctxOptions(screen));
      const page = await ctx.newPage();
      await page.goto(o.url, { waitUntil: "load", timeout: 60000 });
      await readyHero(page, true);
      await page.addStyleTag({ content: "html{font-size:200% !important}" });
      await wait(page, 1200);
      const data = await page.evaluate(probe, { ...T });
      const problems = [...(data.overflow.docPx > 1 ? [`page is ${data.overflow.docPx}px wider than the screen at 200% text`] : []), ...data.overflow.offenders, ...data.text.clipped];
      results.push({ screen: screen.id, mode: "text200", state: "top", gate: "G6", status: problems.length ? "warn" : "pass", problems: [], warns: problems.slice(0, 6) });
      await ctx.close();
    }

    if (!screen.touch) {
      const browser2 = await chromium.launch({ executablePath: o.chrome, headless: true, ignoreDefaultArgs: ["--hide-scrollbars"], args: ["--disable-dev-shm-usage"] });
      const ctx = await browser2.newContext(ctxOptions(screen));
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        const s = document.createElement("style");
        s.textContent = "html{overflow-y:scroll}html::-webkit-scrollbar{width:15px;height:15px}";
        document.addEventListener("DOMContentLoaded", () => document.head.append(s));
      });
      await page.goto(o.url, { waitUntil: "load", timeout: 60000 });
      await readyHero(page, true);
      for (const state of ["top", "catalog"]) {
        await enter(page, state, "js");
        const data = await page.evaluate(probe, { ...T });
        if (data.overflow.scrollbarPx < 8) {
          record("scrollbar", state, "G1", [], [`could not emulate a classic scrollbar (${data.overflow.scrollbarPx}px)`]);
          break;
        }
        for (const r of judge(data, { screen, state })) if (r.gate === "G1" || r.gate === "G14") record("scrollbar", state, r.gate, r.problems, r.warns);
      }
      await browser2.close();
    }
  }
}

/* ------------------------------------------------------------------------------------------ */
/* cli, reporting                                                                              */
/* ------------------------------------------------------------------------------------------ */

function chromePath() {
  return [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ]
    .filter(Boolean)
    .find((p) => existsSync(p));
}

function loadSweepAllowlist() {
  const path = join(ROOT, "scripts/design-allow.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")).sweep ?? [];
}

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(n);
  const val = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);

  if (flag("--help") || flag("-h")) {
    console.log(`design:sweep  browser sweep of the built site (gates G1 to G15, see docs/design/verification.md)

  --build            build a production copy (scripts/preview-clone.sh), sweep it, stop it
  --port <n>         port for --build (default 3150); use another when a different session holds it
  --url <url>        sweep a copy that is already running (default http://localhost:<port>)
  --only a,b         screens to run, by id or WxH (ids: ${SCREENS.map((x) => x.id).join(" ")})
  --quick            only the deep screens
  --states a,b       ${STATES_JS.join(" ")}
  --shots <dir>      save screenshots (top, caught, catalog, modal)
  --json <file>      write every result
  --keep             leave the --build server running`);
    return;
  }

  const chrome = chromePath();
  if (!chrome) {
    console.error("Google Chrome not found. Install it or set CHROME_PATH.");
    process.exit(2);
  }

  // another session may hold :3150 (it is one shared machine): --port picks the production copy's port
  const port = val("--port") ?? process.env.PORT ?? "3150";
  let url = val("--url");
  const built = flag("--build");
  if (built) {
    const r = spawnSync("bash", [join(ROOT, "scripts/preview-clone.sh")], { stdio: "inherit", env: { ...process.env, PORT: port } });
    if (r.status !== 0) process.exit(2);
  }
  url = (url ?? `http://localhost:${port}`).replace(/\/$/, "");
  if (!(await reachable(url))) {
    console.error(`Nothing answers at ${url}. Run with --build, or start a production copy (bash scripts/preview-clone.sh) and pass --url.`);
    process.exit(2);
  }

  let screens = SCREENS;
  if (flag("--quick")) screens = screens.filter((s) => s.deep);
  const only = val("--only")?.split(",");
  if (only) screens = SCREENS.filter((s) => only.includes(s.id) || only.includes(`${s.w}x${s.h}`));
  const states = val("--states")?.split(",") ?? STATES_JS;
  const allow = loadSweepAllowlist();

  const launch = () => chromium.launch({ executablePath: chrome, headless: true, args: ["--disable-dev-shm-usage"] });
  let browser = await launch();
  const results = [];
  const started = Date.now();
  console.log(`design:sweep ${url}  ${screens.length} screens, chrome ${browser.version()}`);
  for (const screen of screens) {
    const t0 = Date.now();
    // Chrome can be killed from outside (this machine is shared with other sessions): relaunch it and run the screen once more
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await runScreen(browser, screen, { url, states, shots: val("--shots"), chrome, noDeep: false }, results);
        break;
      } catch (error) {
        const message = String(error).split("\n")[0];
        if (attempt === 1 && /has been closed|Target closed|browser has disconnected/i.test(message)) {
          for (let i = results.length - 1; i >= 0; i--) if (results[i].screen === screen.id) results.splice(i, 1);
          await browser.close().catch(() => {});
          browser = await launch();
          continue;
        }
        results.push({ screen: screen.id, mode: "js", state: "run", gate: "G10", status: "fail", problems: [`sweep crashed on this screen: ${message}`], warns: [] });
        break;
      }
    }
    process.stdout.write(`  ${screen.id.padEnd(11)} ${String(screen.w).padStart(4)}x${String(screen.h).padEnd(4)} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  await browser.close().catch(() => {});
  if (built && !flag("--keep")) spawnSync("bash", [join(ROOT, "scripts/preview-clone.sh"), "--stop"], { stdio: "ignore", env: { ...process.env, PORT: port } });

  /* allowances */
  const usedAllow = new Set();
  for (const r of results) {
    if (r.status !== "fail") continue;
    r.problems = r.problems.filter((p) => {
      const a = allow.find((e) => e.gate === r.gate && p.includes(e.match) && (!e.screens || e.screens.includes(r.screen)));
      if (a) usedAllow.add(a);
      return !a;
    });
    if (!r.problems.length) r.status = r.warns.length ? "warn" : "pass";
  }

  /* report */
  const gateIds = Object.keys(GATES);
  const rank = { fail: 3, warn: 2, pass: 1 };
  const infoCounts = (screen, g) => !screen.info || g === "G1" || g === "G10";
  console.log("\nscreen         " + gateIds.map((g) => g.replace("G", "").padStart(2)).join(" "));
  let failedScreens = 0;
  for (const screen of screens) {
    const cells = gateIds.map((g) => {
      const rs = results.filter((r) => r.screen === screen.id && r.gate === g);
      if (!rs.length) return " -";
      const worst = rs.reduce((a, b) => (rank[b.status] > rank[a.status] ? b : a));
      return worst.status === "fail" ? (infoCounts(screen, g) ? " X" : " x") : worst.status === "warn" ? " w" : " .";
    });
    if (cells.some((c) => c === " X")) failedScreens++;
    console.log(`${screen.id.padEnd(14)}${cells.join(" ")}${screen.info ? "   (best effort: only G1 and G10 gate)" : ""}`);
  }
  console.log("\n. pass   w warning   X fail   x fail on a best-effort screen   - not measured");

  const failing = results.filter((r) => r.status === "fail" && infoCounts(SCREENS.find((s) => s.id === r.screen), r.gate));
  const byGate = new Map();
  for (const r of failing) {
    const list = byGate.get(r.gate) ?? new Map();
    for (const p of r.problems) {
      const key = p;
      const entry = list.get(key) ?? new Set();
      entry.add(`${r.screen}${r.state && r.state !== "all" ? `[${r.mode}:${r.state}]` : `[${r.mode}]`}`);
      list.set(key, entry);
    }
    byGate.set(r.gate, list);
  }
  for (const g of gateIds) {
    const list = byGate.get(g);
    if (!list) continue;
    console.log(`\n${g} ${GATES[g]}`);
    for (const [problem, where] of [...list.entries()].slice(0, 14)) {
      const w = [...where];
      console.log(`  - ${problem}\n      at ${w.slice(0, 5).join(", ")}${w.length > 5 ? ` and ${w.length - 5} more` : ""}`);
    }
    if (list.size > 14) console.log(`  ... ${list.size - 14} more distinct problems (use --json)`);
  }
  const warnings = results.filter((r) => r.status !== "fail" && r.warns.length);
  if (warnings.length) {
    console.log("\nwarnings");
    const seen = new Set();
    for (const r of warnings) for (const w of r.warns) {
      const k = `${r.gate} ${w}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (seen.size <= 12) console.log(`  - ${r.gate} ${r.screen}[${r.mode}:${r.state}] ${w}`);
    }
  }
  for (const a of allow) if (!usedAllow.has(a)) console.log(`\nnote: sweep allowlist entry "${a.gate} ${a.match}" matched nothing, remove it`);

  const json = val("--json");
  if (json) {
    writeFileSync(json, JSON.stringify({ url, when: new Date().toISOString(), results }, null, 2));
    console.log(`\nwrote ${json}`);
  }
  const total = failing.reduce((n, r) => n + r.problems.length, 0);
  console.log(`\ndesign:sweep ${total ? "FAILED" : "passed"}: ${total} problem${total === 1 ? "" : "s"} on ${failedScreens} screen${failedScreens === 1 ? "" : "s"} (${((Date.now() - started) / 60000).toFixed(1)} min)`);
  process.exit(total ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
