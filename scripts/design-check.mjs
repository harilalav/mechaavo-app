#!/usr/bin/env node
/**
 * Static design lint for the Mechaavo site (npm run design:lint).
 *
 * It enforces, mechanically, the parts of docs/DESIGN-GUIDELINES.md that can be
 * read from source: the taste skill's hard bans and the ui-ux-pro-max layout,
 * touch and type rules, already reconciled with the client brief. What cannot be
 * read from source (overflow, tap sizes, hero fit, layout shift, ...) is measured
 * in a browser by scripts/design-sweep.mjs.
 *
 * Zero dependencies. Findings print as `path:line: [rule] message`.
 *
 *   node scripts/design-check.mjs                whole repo (app, components, lib, src)
 *   node scripts/design-check.mjs --file a.css   only these files (repo-wide rules skipped)
 *   node scripts/design-check.mjs --hook         Claude Code PostToolUse hook: reads the hook
 *                                                JSON on stdin, checks the edited file, prints
 *                                                errors to stderr and exits 2 so they are fed back
 *   node scripts/design-check.mjs --self-test    run the rules against built-in fixtures
 *   flags: --json  --strict (warnings fail too)  --verbose (also info)  --rules a,b  --list
 *
 * A finding that is deliberate goes in scripts/design-allow.json with a reason; an
 * entry without a reason is itself an error, and entries that no longer match
 * anything are reported so the list cannot rot.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SCAN_DIRS = ["app", "components", "lib", "src"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".agents", ".claude"]);
const EXTS = new Set([".css", ".ts", ".tsx"]);

/**
 * The registry. Mirrors docs/DESIGN-GUIDELINES.md section 3 (breakpoints) and 6
 * (type floor); change both together.
 */
const REGISTRY = {
  /** Mobile-first widths: sm, md, lg, xl, 2xl. */
  minWidthPx: [640, 768, 1024, 1280, 1536],
  /** The only max-width queries that may exist: the 320 px narrow-phone rule, and the stacked pair. */
  maxWidthPx: [340, 767, 1279],
  /** Height conditions: 34rem (short), 46rem, 56rem. */
  heightPx: [544, 736, 896],
  /** No text anywhere is smaller than this. */
  fontFloorPx: 12,
};

/** Properties that change layout: never animate or transition them. */
const LAYOUT_PROPS = new Set([
  "all", "width", "height", "top", "left", "right", "bottom", "inset", "margin", "margin-top", "margin-right",
  "margin-bottom", "margin-left", "margin-block", "margin-inline", "padding", "padding-top", "padding-right",
  "padding-bottom", "padding-left", "padding-block", "padding-inline", "min-width", "min-height", "max-width",
  "max-height", "font-size", "line-height", "flex-basis", "gap", "grid-template-columns", "grid-template-rows",
]);

/** Colour keywords that must not appear as a declared colour (the palette is eight tokens). */
const NAMED_COLORS = new Set([
  "white", "black", "red", "green", "blue", "yellow", "orange", "purple", "pink", "gray", "grey", "silver",
  "gold", "cyan", "magenta", "navy", "teal", "maroon", "lime", "olive", "aqua", "fuchsia", "brown", "coral",
  "crimson", "indigo", "violet", "salmon", "tan", "khaki", "ivory", "beige",
]);

/* ------------------------------------------------------------------------------------------ */
/* source helpers                                                                              */
/* ------------------------------------------------------------------------------------------ */

const blank = (match) => match.replace(/[^\n]/g, " ");

/** Comments out of CSS, same length, newlines kept (so line numbers still match). */
function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, blank);
}

/**
 * Comments out of TS/TSX, same length, newlines kept. A small tokenizer so that
 * `//` inside strings and templates survives. Quotes end at the end of the line,
 * which is what keeps an apostrophe in JSX text from swallowing the file.
 */
function stripTsComments(text) {
  let out = "";
  let mode = "code"; // code | sq | dq | tpl | line | block
  let braceDepth = 0;
  const tplStack = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const d = text[i + 1];
    if (mode === "code") {
      if (c === "/" && d === "/") { mode = "line"; out += "  "; i++; continue; }
      if (c === "/" && d === "*") { mode = "block"; out += "  "; i++; continue; }
      if (c === "'") mode = "sq";
      else if (c === '"') mode = "dq";
      else if (c === "`") mode = "tpl";
      else if (c === "{") braceDepth++;
      else if (c === "}") {
        braceDepth--;
        if (tplStack.length && braceDepth === tplStack[tplStack.length - 1]) {
          tplStack.pop();
          mode = "tpl";
        }
      }
      out += c;
    } else if (mode === "sq" || mode === "dq") {
      out += c;
      if (c === "\\") { out += d ?? ""; i++; }
      else if ((mode === "sq" && c === "'") || (mode === "dq" && c === '"') || c === "\n") mode = "code";
    } else if (mode === "tpl") {
      out += c;
      if (c === "\\") { out += d ?? ""; i++; }
      else if (c === "`") mode = "code";
      else if (c === "$" && d === "{") {
        out += "{";
        i++;
        tplStack.push(braceDepth);
        braceDepth++;
        mode = "code";
      }
    } else if (mode === "line") {
      if (c === "\n") { mode = "code"; out += c; } else out += " ";
    } else if (mode === "block") {
      if (c === "*" && d === "/") { mode = "code"; out += "  "; i++; } else out += c === "\n" ? "\n" : " ";
    }
  }
  return out;
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

function lineOf(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function makeFile(path, text) {
  const ext = extname(path);
  return {
    path,
    ext,
    text,
    clean: ext === ".css" ? stripCssComments(text) : stripTsComments(text),
    starts: lineStarts(text),
    lines: text.split("\n"),
  };
}

function loadFile(abs) {
  return makeFile(relative(ROOT, abs).split(sep).join("/"), readFileSync(abs, "utf8"));
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    const stat = statSync(abs);
    if (stat.isDirectory()) walk(abs, out);
    else if (EXTS.has(extname(name))) out.push(abs);
  }
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* CSS parsing (just enough: rules, at-rules and declarations with their context)              */
/* ------------------------------------------------------------------------------------------ */

function parseCss(clean) {
  const nodes = [];
  const stack = [];
  let buf = "";
  let bufStart = 0;
  let paren = 0;
  let quote = null;

  const context = () => stack.map((entry) => entry.prelude);
  const nearestRule = () => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].kind === "rule") return stack[i].prelude;
    return "";
  };
  const flushDeclaration = () => {
    const m = /^(\s*)([-\w]+)\s*:\s*([\s\S]*?)\s*$/.exec(buf);
    if (m && stack.length) {
      nodes.push({
        kind: "decl",
        prop: m[2].toLowerCase(),
        value: m[3],
        index: bufStart + m[1].length,
        ancestors: context(),
        selector: nearestRule(),
      });
    }
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quote) {
      buf += ch;
      if (ch === "\\") buf += clean[++i] ?? "";
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (buf === "") bufStart = i;
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "(") paren++;
    else if (ch === ")") paren = Math.max(0, paren - 1);

    if (paren === 0 && ch === "{") {
      const prelude = buf.trim();
      const kind = prelude.startsWith("@") ? "at" : "rule";
      nodes.push({ kind, prelude, index: bufStart + (buf.length - buf.trimStart().length), ancestors: context() });
      stack.push({ prelude, kind });
      buf = "";
      continue;
    }
    if (paren === 0 && ch === "}") {
      if (buf.trim()) flushDeclaration();
      stack.pop();
      buf = "";
      continue;
    }
    if (paren === 0 && ch === ";") {
      flushDeclaration();
      buf = "";
      continue;
    }
    if (buf === "") bufStart = i;
    buf += ch;
  }
  return nodes;
}

/** Top-level comma split that respects parentheses. */
function splitArgs(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Smallest px a font-size value can resolve to, or null when it cannot be known. */
function minFontPx(value, vars, depth = 0) {
  if (depth > 6) return null;
  const v = value.replace(/!important/i, "").trim();
  let m = /^(-?[\d.]+)(px|rem)$/i.exec(v);
  if (m) return parseFloat(m[1]) * (m[2].toLowerCase() === "rem" ? 16 : 1);
  m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/i.exec(v);
  if (m) {
    const declared = vars.get(m[1]);
    const candidates = declared?.length ? declared : m[2] ? [m[2]] : [];
    const mins = candidates.map((c) => minFontPx(c, vars, depth + 1)).filter((n) => n !== null);
    return mins.length ? Math.min(...mins) : null;
  }
  m = /^(clamp|max|min)\(([\s\S]*)\)$/i.exec(v);
  if (m) {
    const args = splitArgs(m[2]);
    if (!args.length) return null;
    const fn = m[1].toLowerCase();
    if (fn === "clamp") return minFontPx(args[0], vars, depth + 1);
    const mins = args.map((a) => minFontPx(a, vars, depth + 1)).filter((n) => n !== null);
    if (!mins.length) return null;
    return fn === "max" ? Math.max(...mins) : Math.min(...mins);
  }
  return null;
}

/* ------------------------------------------------------------------------------------------ */
/* rules                                                                                       */
/* ------------------------------------------------------------------------------------------ */

/**
 * Every rule: { id, level, exts, repo?, describe, run(file, ctx) -> [{ index | line, message }] }.
 * `index` is a character offset into file.text (turned into a line number), `line` is explicit.
 */
const RULES = [];
const rule = (definition) => RULES.push(definition);

function* matches(regex, text) {
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  let m;
  while ((m = re.exec(text))) {
    yield m;
    if (m[0] === "") re.lastIndex++;
  }
}

rule({
  id: "dash",
  level: "error",
  exts: [".css", ".ts", ".tsx"],
  describe: "No em dash or en dash in anything visible (text, aria, alt, title, metadata). Use a hyphen.",
  run(file) {
    const out = [];
    for (const m of matches(/[–—]|&[mn]dash;|\\u201[34]/, file.clean)) {
      out.push({ index: m.index, message: "em/en dash: use a hyphen, a comma or two sentences" });
    }
    return out;
  },
});

rule({
  id: "emoji",
  level: "error",
  exts: [".css", ".ts", ".tsx"],
  describe: "No emoji in anything visible. Use a Phosphor icon.",
  run(file) {
    const out = [];
    for (const m of matches(/(?![©®™])\p{Extended_Pictographic}/u, file.clean)) {
      out.push({ index: m.index, message: `emoji ${m[0]}: use a Phosphor icon` });
    }
    return out;
  },
});

rule({
  id: "raw-color",
  level: "error",
  exts: [".css", ".ts", ".tsx"],
  describe: "Colours come from the eight tokens (theme.css) through roles. No hex, rgb(), hsl(), colour names or stock Tailwind colours elsewhere.",
  run(file) {
    if (file.path === "src/styles/theme.css") return [];
    const out = [];
    // not a method call (palette.rgb("white")): a colour function is never preceded by a dot
    const functional = /(?<![.\w$])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
    for (const m of matches(functional, file.clean)) {
      out.push({ index: m.index, message: `raw colour function ${m[0]}...): use a token, a role or color-mix() on one` });
    }
    if (file.ext === ".css") {
      for (const m of matches(/(?<![\w&#-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![\w-])/i, file.clean)) {
        const before = file.clean.slice(Math.max(0, m.index - 60), m.index);
        if (/url\([^)]*$/i.test(before)) continue; // url(#fragment)
        const sinceBoundary = before.slice(Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("}")) + 1);
        if (!sinceBoundary.includes(":")) continue; // an id selector, not a value
        out.push({ index: m.index, message: `raw hex ${m[0]}: use a token or a role` });
      }
      for (const node of parseCss(file.clean)) {
        if (node.kind !== "decl") continue;
        if (!/^(?:color|background(?:-color)?|border(?:-[a-z-]+)?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color)$/.test(node.prop)) continue;
        const value = node.value.replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "(...)");
        for (const word of value.toLowerCase().split(/[\s,/]+/)) {
          if (NAMED_COLORS.has(word)) out.push({ index: node.index, message: `colour name "${word}": use a token or a role` });
        }
      }
    } else {
      for (const m of matches(/(["'`])#(?:[0-9a-f]{3,8})\1|\[#[0-9a-f]{3,8}\]/i, file.clean)) {
        out.push({ index: m.index, message: `raw hex ${m[0]}: use a token or a role` });
      }
      const stock = /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|shadow)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)\b/g;
      for (const m of matches(stock, file.clean)) {
        out.push({ index: m.index, message: `${m[0]}: Tailwind's stock palette is wiped here and the class does nothing; use a role (bg-page, text-ink, ...)` });
      }
    }
    return out;
  },
});

rule({
  id: "hover-gate",
  level: "error",
  exts: [".css"],
  describe: "A hand-written :hover lives inside @media (hover: hover), so a tap never leaves a stuck hover. (Tailwind v4 hover: and group-hover: are already gated.)",
  run(file) {
    const out = [];
    for (const node of parseCss(file.clean)) {
      if (node.kind !== "rule" || !/:hover\b/.test(node.prelude)) continue;
      const gated = node.ancestors.some((a) => /^@media/i.test(a) && /\((?:any-)?hover:\s*hover\)/i.test(a));
      if (!gated) out.push({ index: node.index, message: `${node.prelude.replace(/\s+/g, " ")} uses :hover outside @media (hover: hover)` });
    }
    return out;
  },
});

rule({
  id: "vh-unit",
  level: "error",
  exts: [".css", ".ts", ".tsx"],
  describe: "No vh, no 100vw, no h-screen. Pinned stages use svh, dialogs and sheets use dvh, widths use % or container units.",
  run(file) {
    const out = [];
    for (const m of matches(/(?<![\w.-])(?:\d*\.)?\d+vh\b/, file.clean)) {
      out.push({ index: m.index, message: `${m[0]}: vh jumps with mobile browser bars; use svh (pinned) or dvh (dialogs)` });
    }
    for (const m of matches(/(?<![\w.-])100vw\b/, file.clean)) {
      const line = file.lines[lineOf(file.starts, m.index) - 1] ?? "";
      if (/\bsizes\b/.test(line)) continue; // an <img sizes> hint, not layout
      out.push({ index: m.index, message: "100vw includes the scrollbar and overflows where scrollbars take space; use 100% or container units (cqw)" });
    }
    for (const m of matches(/\b(?:min-|max-)?[hw]-screen\b/, file.clean)) {
      out.push({ index: m.index, message: `${m[0]}: use svh/dvh or %` });
    }
    return out;
  },
});

rule({
  id: "font-floor",
  level: "error",
  exts: [".css", ".ts", ".tsx"],
  describe: `No text smaller than ${REGISTRY.fontFloorPx} px at any width (the smallest value a clamp() can resolve to counts).`,
  run(file, ctx) {
    const out = [];
    const floor = REGISTRY.fontFloorPx;
    if (file.ext === ".css") {
      for (const node of parseCss(file.clean)) {
        if (node.kind !== "decl" || node.prop !== "font-size") continue;
        const min = minFontPx(node.value, ctx.cssVars);
        if (min !== null && min < floor - 0.001) {
          out.push({ index: node.index, message: `font-size ${node.value} can resolve to ${+min.toFixed(2)} px (floor ${floor} px)` });
        }
      }
    } else {
      for (const m of matches(/\btext-\[([\d.]+)(px|rem)\]/, file.clean)) {
        const px = parseFloat(m[1]) * (m[2] === "rem" ? 16 : 1);
        if (px < floor) out.push({ index: m.index, message: `${m[0]} is ${+px.toFixed(2)} px (floor ${floor} px)` });
      }
      for (const m of matches(/\bfontSize:\s*["']?([\d.]+)(px|rem)?/, file.clean)) {
        const px = parseFloat(m[1]) * (m[2] === "rem" ? 16 : 1);
        if (px < floor) out.push({ index: m.index, message: `fontSize ${m[1]}${m[2] ?? ""} is ${+px.toFixed(2)} px (floor ${floor} px)` });
      }
    }
    return out;
  },
});

rule({
  id: "z-literal",
  level: "error",
  exts: [".css", ".ts", ".tsx"],
  describe: "z-index comes from a named token (--z-*, --cat-z-*). A positive number written inline is a stacking bug waiting to happen.",
  run(file) {
    const out = [];
    if (file.ext === ".css") {
      for (const node of parseCss(file.clean)) {
        if (node.kind !== "decl" || node.prop !== "z-index") continue;
        if (/^\d+$/.test(node.value) && Number(node.value) > 0) {
          out.push({ index: node.index, message: `z-index: ${node.value}: use a --z-* token` });
        }
      }
    } else {
      for (const m of matches(/(?<![\w-])z-(\d+)\b|\bz-\[(\d+)\]|\bzIndex:\s*(\d+)/, file.clean)) {
        const n = Number(m[1] ?? m[2] ?? m[3]);
        if (n > 0) out.push({ index: m.index, message: `${m[0]}: use a --z-* token (a class in CSS that reads var(--z-...))` });
      }
    }
    return out;
  },
});

/** The mobile-first and breakpoint-registry checks for one @media prelude. */
function mediaProblems(prelude) {
  const problems = [];
  const query = prelude.replace(/^@media\s*/i, "").replace(/\s+/g, " ").trim();
  // the stacked pair, possibly with extra conditions on each side of the comma (scripting, motion)
  const branches = query.toLowerCase().split(",");
  const isStacked =
    branches.some((b) => /\(max-width:\s*767px\)/.test(b)) && branches.some((b) => /\(max-aspect-ratio:\s*1\/1\)/.test(b));
  for (const m of matches(/\((min|max)-(width|height)\s*:\s*([\d.]+)(px|rem|em)\)/i, query)) {
    const kind = m[1].toLowerCase();
    const axis = m[2].toLowerCase();
    const px = parseFloat(m[3]) * (m[4].toLowerCase() === "px" ? 1 : 16);
    const text = m[0];
    if (axis === "width" && kind === "min" && !REGISTRY.minWidthPx.includes(px)) {
      problems.push({ rule: "breakpoint", message: `${text} is not a registry breakpoint (${REGISTRY.minWidthPx.join(", ")} px)` });
    } else if (axis === "width" && kind === "max") {
      if (!REGISTRY.maxWidthPx.includes(px)) {
        problems.push({ rule: "breakpoint", message: `${text} is not a registry width (max-width is limited to ${REGISTRY.maxWidthPx.join(", ")} px)` });
      } else if (!isStacked && px !== 340) {
        problems.push({ rule: "mobile-first", message: `${text}: write mobile-first (base styles, then min-width); max-width is only for the stacked query and the 340 px rule` });
      }
    } else if (axis === "height" && !REGISTRY.heightPx.includes(px)) {
      problems.push({ rule: "breakpoint", message: `${text} is not a registry height (${REGISTRY.heightPx.map((h) => h / 16 + "rem").join(", ")})` });
    }
  }
  for (const m of matches(/\((?:min-|max-)?aspect-ratio\s*:\s*([^)]+)\)/i, query)) {
    if (m[1].replace(/\s+/g, "") !== "1/1") {
      problems.push({ rule: "breakpoint", message: `${m[0]}: the only aspect-ratio condition is 1/1 (stacked vs split)` });
    }
  }
  return problems;
}

for (const id of ["breakpoint", "mobile-first"]) {
  rule({
    id,
    level: id === "breakpoint" ? "error" : "warn",
    exts: [".css", ".ts", ".tsx"],
    describe:
      id === "breakpoint"
        ? "Media queries use the registry: sm 640, md 768, lg 1024, xl 1280, 2xl 1536; heights 34rem, 46rem, 56rem; aspect-ratio only 1/1."
        : "Write mobile-first: base styles, then min-width. max-width exists only for the stacked query and the 340 px rule.",
    run(file) {
      const out = [];
      if (file.ext === ".css") {
        for (const node of parseCss(file.clean)) {
          if (node.kind !== "at" || !/^@media/i.test(node.prelude)) continue;
          for (const p of mediaProblems(node.prelude)) if (p.rule === id) out.push({ index: node.index, message: p.message });
        }
      } else {
        const tw = id === "breakpoint" ? /(?<![\w-])(?:min|max)-\[[^\]]+\]:/ : /(?<![\w-])max-(?:sm|md|lg|xl|2xl):/;
        for (const m of matches(tw, file.clean)) {
          out.push({
            index: m.index,
            message: id === "breakpoint" ? `${m[0]} arbitrary breakpoint: use sm: md: lg: xl: 2xl:` : `${m[0]} is desktop-first: write the base for mobile and add md: lg:`,
          });
        }
      }
      return out;
    },
  });
}

rule({
  id: "scroll-listener",
  level: "error",
  exts: [".ts", ".tsx"],
  describe: "No scroll listeners. Use ScrollTrigger, IntersectionObserver or CSS scroll-driven animation.",
  run(file) {
    const out = [];
    for (const m of matches(/addEventListener\(\s*["'`]scroll["'`]|\bonscroll\s*=|\.onscroll\b/, file.clean)) {
      out.push({ index: m.index, message: "scroll listener runs every frame: use ScrollTrigger, IntersectionObserver or animation-timeline" });
    }
    return out;
  },
});

rule({
  id: "hand-svg",
  level: "error",
  exts: [".tsx"],
  describe: "Icons come from Phosphor. A hand-drawn <svg> is allowed only where scripts/design-allow.json says why.",
  run(file) {
    const out = [];
    for (const m of matches(/<svg\b/, file.clean)) {
      out.push({ index: m.index, message: "<svg> in markup: use a Phosphor icon, or add a reasoned allowlist entry" });
    }
    return out;
  },
});

rule({
  id: "anim-layout",
  level: "error",
  exts: [".css", ".ts", ".tsx"],
  describe: "Transition and animate transform and opacity. Never `transition: all`, never width, height, top, left, margin, padding.",
  run(file) {
    const out = [];
    if (file.ext === ".css") {
      for (const node of parseCss(file.clean)) {
        if (node.kind !== "decl") continue;
        const inKeyframes = node.ancestors.some((a) => /^@(?:-webkit-)?keyframes/i.test(a));
        if (inKeyframes && LAYOUT_PROPS.has(node.prop) && node.prop !== "all") {
          out.push({ index: node.index, message: `@keyframes animates ${node.prop} (layout): use transform or opacity` });
        }
        if (node.prop === "transition" || node.prop === "transition-property") {
          for (const part of splitArgs(node.value)) {
            const property = (node.prop === "transition" ? part.split(/\s+/)[0] : part).toLowerCase();
            if (LAYOUT_PROPS.has(property)) out.push({ index: node.index, message: `transition on ${property}: use transform or opacity` });
          }
        }
      }
    } else {
      for (const m of matches(/(?<![\w-])transition-all\b|\btransition-\[(?:width|height|top|left|margin|padding)[^\]]*\]/, file.clean)) {
        out.push({ index: m.index, message: `${m[0]}: transition transform and opacity only` });
      }
    }
    return out;
  },
});

rule({
  id: "important",
  level: "error",
  exts: [".css"],
  describe: "No !important. Fix the specificity or the layer order instead.",
  run(file) {
    const out = [];
    for (const m of matches(/!\s*important/i, file.clean)) out.push({ index: m.index, message: "!important" });
    return out;
  },
});

rule({
  id: "link-unique",
  level: "error",
  exts: [],
  repo: true,
  describe: "No two links on the page share a target, and every target id exists (lib/config/sections.ts).",
  async run(_file, ctx) {
    const out = [];
    const path = join(ROOT, "lib/config/sections.ts");
    if (!existsSync(path)) return out;
    let mod;
    const emit = process.emitWarning;
    process.emitWarning = () => {}; // Node's "type stripping is experimental" notice
    try {
      mod = await import(pathToFileURL(path).href);
    } catch (error) {
      return [{ line: 1, path: "lib/config/sections.ts", message: `could not import sections.ts: ${error.message}` }];
    } finally {
      process.emitWarning = emit;
    }
    const links = [...(mod.NAV_LINKS ?? []), ...(mod.HERO_CTA ? [mod.HERO_CTA] : [])];
    const seen = new Map();
    for (const link of links) {
      if (seen.has(link.href)) {
        out.push({ line: 1, path: "lib/config/sections.ts", message: `"${seen.get(link.href)}" and "${link.label}" both go to ${link.href}` });
      } else seen.set(link.href, link.label);
    }
    // the sticky bar is the hero nav's second state (never on screen with it): its own list is checked on its own
    const barSeen = new Map();
    const sectionHrefs = new Set(Object.values(mod.SECTION_IDS ?? {}).map((id) => `#${id}`));
    for (const link of mod.SITE_NAV_LINKS ?? []) {
      if (barSeen.has(link.href)) {
        out.push({ line: 1, path: "lib/config/sections.ts", message: `sticky bar: "${barSeen.get(link.href)}" and "${link.label}" both go to ${link.href}` });
      } else barSeen.set(link.href, link.label);
      if (!sectionHrefs.has(link.href)) {
        out.push({ line: 1, path: "lib/config/sections.ts", message: `sticky bar: "${link.label}" goes to ${link.href}, which is not a SECTION_IDS target` });
      }
    }
    const sources = ctx.files.filter((f) => f.ext === ".tsx").map((f) => f.text).join("\n");
    for (const [key, id] of Object.entries(mod.SECTION_IDS ?? {})) {
      if (!new RegExp(`id=\\{SECTION_IDS\\.${key}\\}|id="${id}"`).test(sources)) {
        out.push({ line: 1, path: "lib/config/sections.ts", message: `SECTION_IDS.${key} ("${id}") has no element with that id` });
      }
    }
    return out;
  },
});

rule({
  id: "contact-placeholder",
  level: "warn",
  exts: [],
  repo: true,
  describe: "Warns while lib/config/contact.ts says CONTACT_IS_PLACEHOLDER = true: the contact details are stand-ins and the site must not ship with them (`--strict` makes it fail).",
  run(_file, ctx) {
    const file = ctx.files.find((f) => f.path.replace(/\\/g, "/").endsWith("lib/config/contact.ts"));
    if (!file) return [];
    const m = /CONTACT_IS_PLACEHOLDER\s*(?::\s*boolean\s*)?=\s*true/.exec(file.clean);
    if (!m) return [];
    return [{ line: file.clean.slice(0, m.index).split("\n").length, path: "lib/config/contact.ts", message: "the contact details are placeholders: put the brand's real ones in lib/config/contact.ts and set CONTACT_IS_PLACEHOLDER to false before launch" }];
  },
});

rule({
  id: "eyebrow-count",
  level: "info",
  exts: [],
  repo: true,
  describe: "Info only: uppercase wide-tracked label styles (the eyebrow budget is ceil(sections / 3); the sweep measures the real count).",
  run(_file, ctx) {
    const out = [];
    for (const file of ctx.files.filter((f) => f.ext === ".css")) {
      const nodes = parseCss(file.clean);
      const upper = new Set(nodes.filter((n) => n.kind === "decl" && n.prop === "text-transform" && /uppercase/.test(n.value)).map((n) => n.selector));
      for (const n of nodes) {
        if (n.kind !== "decl" || n.prop !== "letter-spacing" || !upper.has(n.selector)) continue;
        const em = parseFloat(n.value);
        if (/em$/.test(n.value.trim()) && em >= 0.08) out.push({ path: file.path, index: n.index, message: `${n.selector}: uppercase, tracking ${n.value}` });
      }
    }
    return out;
  },
});

/* ------------------------------------------------------------------------------------------ */
/* allowlist                                                                                   */
/* ------------------------------------------------------------------------------------------ */

function loadAllowlist() {
  const path = join(ROOT, "scripts/design-allow.json");
  if (!existsSync(path)) return { entries: [], problems: [] };
  const entries = JSON.parse(readFileSync(path, "utf8")).entries ?? [];
  const problems = [];
  entries.forEach((entry, i) => {
    if (!entry.rule || !entry.file) problems.push(`design-allow.json entry ${i + 1}: needs "rule" and "file"`);
    if (!entry.reason || entry.reason.trim().length < 12) problems.push(`design-allow.json entry ${i + 1} (${entry.rule} ${entry.file}): needs a real "reason"`);
  });
  return { entries, problems };
}

function allowed(finding, entries) {
  return entries.find((e) => e.rule === finding.rule && e.file === finding.path && (!e.match || finding.snippet.includes(e.match)));
}

/* ------------------------------------------------------------------------------------------ */
/* run                                                                                         */
/* ------------------------------------------------------------------------------------------ */

async function check(files, { ruleIds, repoWide, varFiles = files }) {
  // custom properties (--tile-name, ...) are resolved across every stylesheet
  const cssVars = new Map();
  for (const file of varFiles.filter((f) => f.ext === ".css")) {
    for (const node of parseCss(file.clean)) {
      if (node.kind === "decl" && node.prop.startsWith("--")) {
        const list = cssVars.get(node.prop) ?? [];
        list.push(node.value);
        cssVars.set(node.prop, list);
      }
    }
  }
  const ctx = { files, cssVars };
  const findings = [];
  for (const r of RULES) {
    if (ruleIds && !ruleIds.includes(r.id)) continue;
    if (r.repo) {
      if (!repoWide) continue;
      for (const f of await r.run(null, ctx)) {
        const file = f.path ? files.find((x) => x.path === f.path) : null;
        const line = f.line ?? (file && f.index !== undefined ? lineOf(file.starts, f.index) : 1);
        findings.push({ rule: r.id, level: r.level, path: f.path ?? "", line, message: f.message, snippet: file?.lines[line - 1]?.trim() ?? "" });
      }
      continue;
    }
    for (const file of files) {
      if (!r.exts.includes(file.ext)) continue;
      for (const f of await r.run(file, ctx)) {
        const line = lineOf(file.starts, f.index);
        findings.push({ rule: r.id, level: r.level, path: file.path, line, message: f.message, snippet: file.lines[line - 1]?.trim() ?? "" });
      }
    }
  }
  return findings;
}

function settle(findings, { entries }) {
  const used = new Set();
  const kept = [];
  for (const f of findings) {
    const entry = allowed(f, entries);
    if (entry) used.add(entry);
    else kept.push(f);
  }
  return { kept, unused: entries.filter((e) => !used.has(e)) };
}

/* ------------------------------------------------------------------------------------------ */
/* self-test                                                                                   */
/* ------------------------------------------------------------------------------------------ */

const FIXTURES = [
  ["a.css", ".a { color: #fff; }", ["raw-color"]],
  ["a.css", ".a { background: rgba(0, 0, 0, 0.5); }", ["raw-color"]],
  ["a.css", ".a { border: 1px solid white; }", ["raw-color"]],
  ["a.css", ".a { color: var(--ink); background: color-mix(in srgb, var(--accent) 20%, transparent); }", []],
  ["a.css", "#cafe { margin: 0; } a[href=\"#add\"] { margin: 0; } .b { fill: url(#abc); }", []],
  ["a.css", ".a:hover { transform: scale(1.1); }", ["hover-gate"]],
  ["a.css", "@media (hover: hover) { .a:hover { transform: none; } }", []],
  ["a.css", "@media (prefers-reduced-motion: reduce) and (hover: hover) { .a:hover::before { opacity: 1; } }", []],
  ["a.css", ".a { height: 100vh; }", ["vh-unit"]],
  ["a.css", ".a { height: 100svh; min-height: 90dvh; }", []],
  ["a.css", ".a { width: calc(100vw - 2rem); }", ["vh-unit"]],
  ["a.css", ".a { width: 68vw; }", []],
  ["a.css", ".a { font-size: 0.65rem; }", ["font-floor"]],
  ["a.css", ".a { font-size: clamp(0.65rem, 3cqw, 0.75rem); }", ["font-floor"]],
  ["a.css", ".a { font-size: clamp(0.75rem, 3cqw, 1rem); }", []],
  ["a.css", ".a { --s: 0.7rem; font-size: var(--s); }", ["font-floor"]],
  ["a.css", ".a { z-index: 5; } .b { z-index: var(--z-nav); } .c { z-index: -1; }", ["z-literal"]],
  ["a.css", "@media (min-width: 700px) { .a { margin: 0; } }", ["breakpoint"]],
  ["a.css", "@media (min-width: 768px) and (min-height: 56rem) { .a { margin: 0; } }", []],
  ["a.css", "@media (max-width: 767px) { .a { margin: 0; } }", ["mobile-first"]],
  ["a.css", "@media (max-width: 767px), (max-aspect-ratio: 1/1) { .a { margin: 0; } }", []],
  ["a.css", "@media (max-width: 340px) { .a { margin: 0; } }", []],
  ["a.css", "@media (min-aspect-ratio: 4/3) { .a { margin: 0; } }", ["breakpoint"]],
  ["a.css", ".a { transition: all 1s; }", ["anim-layout"]],
  ["a.css", ".a { transition: transform 300ms, width 1s; }", ["anim-layout"]],
  ["a.css", "@keyframes k { to { height: 0; } }", ["anim-layout"]],
  ["a.css", ".a { transition: transform 300ms var(--ease-out), opacity 200ms; }", []],
  ["a.css", ".a { color: red !important; }", ["important", "raw-color"]],
  ["a.css", "/* a dash — in a comment is fine */ .a { content: \"—\"; }", ["dash"]],
  ["a.tsx", "export const A = () => <p>Fast — strong</p>;", ["dash"]],
  ["a.tsx", "// comment — fine\nexport const A = () => <p>{/* — */}ok</p>;", []],
  ["a.tsx", "const A = () => <p>Don't</p>;\n// comment — fine\nconst url = \"https://example.com\"; /* — */", []],
  ["a.tsx", "const A = () => <p>Mechaavo // System 01</p>;\nconst b = `x ${1} — y`;", ["dash"]],
  ["a.tsx", "const c = palette.rgb(\"white\");", []],
  ["a.tsx", "export const A = () => <p>Cast \u{1F3A3} now</p>;", ["emoji"]],
  ["a.tsx", "export const A = () => <p>© 2026 Mechaavo → go</p>;", []],
  ["a.tsx", "window.addEventListener(\"scroll\", f);", ["scroll-listener"]],
  ["a.tsx", "export const A = () => <svg viewBox=\"0 0 1 1\" />;", ["hand-svg"]],
  ["a.tsx", "export const A = () => <div className=\"min-h-screen z-50 text-[10px] bg-[#fff]\" />;", ["vh-unit", "z-literal", "font-floor", "raw-color"]],
  ["a.tsx", "export const A = () => <div className=\"bg-white text-gray-600 bg-page text-ink\" />;", ["raw-color"]],
  ["a.tsx", "export const A = () => <img sizes=\"(min-width: 768px) 30vw, 100vw\" />;", []],
  ["a.tsx", "export const A = () => <div className=\"max-[600px]:p-2 md:p-4 hover:bg-page\" />;", ["breakpoint"]],
  ["a.tsx", "export const A = () => <div className=\"max-md:p-2\" />;", ["mobile-first"]],
  ["a.tsx", "export const A = () => <div className=\"transition-all\" />;", ["anim-layout"]],
  ["a.tsx", "export const A = () => <a href=\"#categories\">Go</a>;", []],
];

async function selfTest() {
  let failed = 0;
  for (const [path, text, expected] of FIXTURES) {
    const file = makeFile(path, text);
    const findings = await check([file], { ruleIds: null, repoWide: false });
    const got = [...new Set(findings.map((f) => f.rule))].sort();
    const want = [...expected].sort();
    if (got.join() !== want.join()) {
      failed++;
      console.error(`FAIL  ${path}: ${text.slice(0, 80)}\n      expected [${want}] got [${got}]`);
    }
  }
  console.log(failed ? `design:lint self-test FAILED (${failed} of ${FIXTURES.length})` : `design:lint self-test ok (${FIXTURES.length} fixtures)`);
  process.exit(failed ? 1 : 0);
}

/* ------------------------------------------------------------------------------------------ */
/* cli                                                                                         */
/* ------------------------------------------------------------------------------------------ */

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function inScope(rel) {
  return !rel.startsWith("..") && SCAN_DIRS.some((d) => rel === d || rel.startsWith(d + "/")) && EXTS.has(extname(rel));
}

function format(f) {
  return `${f.path}:${f.line}: [${f.rule}] ${f.message}`;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const value = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };

  if (flag("--self-test")) return selfTest();
  if (flag("--list")) {
    for (const r of RULES) console.log(`${r.id.padEnd(16)} ${r.level.padEnd(6)} ${r.describe}`);
    return;
  }

  const allow = loadAllowlist();
  const ruleIds = value("--rules")?.split(",") ?? null;

  /* hook: one file, errors only, exit 2 so Claude Code feeds stderr back */
  if (flag("--hook")) {
    let target = null;
    try {
      target = JSON.parse(await readStdin())?.tool_input?.file_path ?? null;
    } catch {
      /* not hook JSON: nothing to check */
    }
    if (!target) return;
    const abs = resolve(target);
    const rel = relative(ROOT, abs).split(sep).join("/");
    const isSections = rel === "lib/config/sections.ts";
    if (!isSections && (!inScope(rel) || !existsSync(abs))) return;
    // the whole scan set is tiny, so load it all: rules resolve custom properties and ids across files
    const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))).map(loadFile);
    const findings = await check(files, { ruleIds, repoWide: isSections });
    const { kept } = settle(findings.filter((f) => f.path === rel), allow);
    const errors = kept.filter((f) => f.level === "error");
    if (!errors.length) return;
    console.error(`design:lint found ${errors.length} problem${errors.length > 1 ? "s" : ""} in what you just edited (docs/DESIGN-GUIDELINES.md):`);
    for (const f of errors) console.error(`  ${format(f)}`);
    console.error("Fix them, or (only if deliberate) add a reasoned entry to scripts/design-allow.json.");
    process.exit(2);
  }

  const explicit = [];
  for (let i = 0; i < args.length; i++) if (args[i] === "--file" && args[i + 1]) explicit.push(resolve(args[++i]));
  const paths = explicit.length ? explicit : SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
  const files = paths.filter((p) => existsSync(p) && EXTS.has(extname(p))).map(loadFile);
  const varFiles = explicit.length ? SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))).map(loadFile) : files;
  const findings = await check(files, { ruleIds, repoWide: !explicit.length, varFiles });
  const { kept, unused } = settle(findings, allow);

  const errors = kept.filter((f) => f.level === "error");
  const warns = kept.filter((f) => f.level === "warn");
  const infos = kept.filter((f) => f.level === "info");
  const configProblems = [...allow.problems, ...(explicit.length ? [] : unused.map((e) => `design-allow.json: "${e.rule}" for ${e.file} no longer matches anything, remove it`))];

  if (flag("--json")) {
    console.log(JSON.stringify({ errors, warns, infos, configProblems, files: files.length }, null, 2));
  } else {
    const show = (list, label) => {
      for (const f of list) console.log(`${label} ${format(f)}`);
    };
    show(errors, "error");
    show(warns, "warn ");
    if (flag("--verbose")) show(infos, "info ");
    for (const p of configProblems) console.log(`error ${p}`);
    const total = errors.length + configProblems.length;
    console.log(`\ndesign:lint ${total ? "FAILED" : "passed"}: ${errors.length} error${errors.length === 1 ? "" : "s"}, ${warns.length} warning${warns.length === 1 ? "" : "s"}${configProblems.length ? `, ${configProblems.length} allowlist problem${configProblems.length === 1 ? "" : "s"}` : ""} (${files.length} files, ${allow.entries.length} allowlisted)`);
  }
  const failed = errors.length + allow.problems.length + (explicit.length ? 0 : unused.length) > 0 || (flag("--strict") && warns.length > 0);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
