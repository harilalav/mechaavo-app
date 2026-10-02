---
name: mechaavo-design-gate
description: Use before writing or changing ANY visible UI in the Mechaavo site (components, CSS, layout, copy, motion, responsive behaviour, a new section) and before calling such work done. Applies the project's reconciled taste + ui-ux-pro-max guidelines through a plan card and the lint, sweep and Lighthouse gates, so the two design skills are never re-run by hand.
---

# Mechaavo design gate

The taste skill and ui-ux-pro-max are already reconciled with the client brief in `docs/DESIGN-GUIDELINES.md` (CLAUDE.md imports it, so it is already in context). Do **not** re-read or re-run the two skills to cross-check a change. Plan with the guidelines, then run the gates.

## Before code

1. Write the **plan card** (guidelines section 12) into the plan: design read and dials; what is touched; behaviour at base, sm, md, lg, xl, 2xl plus `short` (34rem tall), `stacked` and coarse pointer; the under-768 collapse; targets and hover; motion plus its three fallbacks (reduced motion, no script, forced colours); tokens, z layer, units; deviation ids; gates to run.
2. If a rule would be broken, it is either a registered deviation (D1 to D11, guidelines section 14, `docs/design/rule-map.md`) or a design change. Never skip one silently.

## While coding

- Mobile-first, `min-width` only; the registry breakpoints; `svh` for pinned stages, `dvh` for dialogs, never `vh` or `100vw`.
- Type floors 12 / 14 / 16 px; targets 44 px on touch, 8 px apart; `:hover` only inside `@media (hover: hover)`.
- Roles and tokens for colour, tokens for z-index, transform and opacity for motion, no em or en dash, Phosphor icons only.
- The edit hook runs `design:lint` on every CSS, TSX or TS edit under app, components, lib and src and feeds failures back: fix them in the same turn.

## Gates, in this order

1. `npm run design:lint` (always). A deliberate exception needs a reasoned entry in `scripts/design-allow.json`.
2. `npm run design:sweep -- --build` for any layout, CSS or markup change (27 screens, gates G1 to G15, about 35 minutes, `--quick` about 15; `--only <ids>` or `--quick` while iterating against a running copy with `--url`). Never run `next build` in the repo: a dev server owns `.next`.
3. Lighthouse mobile and desktop for any visible change (commands in `docs/design/verification.md`): accessibility 100, best practices 100, mobile LCP under 2.5 s, CLS about 0.
4. Update `docs/design/verification.md` (log) when the gates were run for a release-sized change.

## Report

One line `Reading this as: ...`, one line per gate result, then every deviation touched by id. Say what was not measured (real Safari, real devices).
