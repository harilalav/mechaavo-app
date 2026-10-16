"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CrosshairIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { Tide } from "@/components/ui/Tide";
import type { CategoryData } from "@/lib/config/categories";
import { DEPTH_TICKS, depthPosition, parseDepth } from "@/lib/config/depth";
import { CATEGORY_MEDIA } from "@/lib/config/media";
import { startInspectorMotion, type InspectorMotion } from "@/lib/animations/categoryInspector";

const MODAL_TITLE_ID = "category-modal-title";

/** "Frog Lure" -> "Frog [Lure]": the last word of a name wears the plate (see Tide). */
function plateLastWord(name: string): string {
  const words = name.split(" ");
  words[words.length - 1] = `[${words[words.length - 1]}]`;
  return words.join(" ");
}

/** The stagger index of a block that rises when the photo has landed (categories-inspector.css). */
const rise = (i: number) => ({ "--i": i }) as CSSProperties;

interface CategoryInspectorProps {
  category: CategoryData;
  /** The plate that opened it: the photo flies out of it, and focus goes back to it. */
  opener: HTMLElement | null;
  /** The way out has finished: remove the dialog. */
  onClosed: () => void;
}

/**
 * The dialog a plate opens (src/styles/categories-inspector.css has the look, lib/animations/categoryInspector.ts
 * the flight). A ledger: the photo, the name, the product line, the specifications between hairlines,
 * the performance features, and the sounding column that shows where in the water the category works.
 * Escape closes it, Tab stays inside it, a press on the scrim closes it, focus goes back to the plate,
 * the panel never taller than 90dvh and the close button sticks to its top while it scrolls.
 */
export function CategoryInspector({ category, opener, onClosed }: CategoryInspectorProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const motionRef = useRef<InspectorMotion | null>(null);
  const closingRef = useRef(false);

  const depth = parseDepth(category.specs.depth);
  const photo = CATEGORY_MEDIA[category.id];

  /** Close: play the way out first (a flight back to the plate), unless the visitor asked for less motion. */
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const motion = motionRef.current;
    if (!motion) {
      onClosed();
      return;
    }
    motion.close().then(onClosed, onClosed);
  }, [onClosed]);

  // the flight starts before the first paint, with the panel's and the photo's places measured before anything moves
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const motion = startInspectorMotion({ dialog, panel: panelRef.current, photo: photoRef.current, opener });
    motionRef.current = motion;
    return () => {
      motion?.cancel();
      motionRef.current = null;
    };
  }, [opener]);

  // while it is open nothing of the hero's water can be seen through the scrim: the engine pauses (engine.ts)
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-inspector", "");
    return () => html.removeAttribute("data-inspector");
  }, []);

  // Escape closes it, Tab stays inside it, and focus goes back to the plate
  useEffect(() => {
    const dialog = dialogRef.current;
    closeRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus({ preventScroll: true });
    };
  }, [opener, requestClose]);

  const soundStyle = { "--g0": depth.from.toFixed(3), "--g1": depth.to.toFixed(3) } as CSSProperties;

  // In the body, not in the section: the section is a stacking context under the sticky bar, and a dialog under
  // the nav is a dialog the nav is on top of. Rendered only after a press, so there is no server markup to match.
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={MODAL_TITLE_ID}
      className="cat-modal fixed inset-0 flex items-center justify-center p-4 md:p-8"
    >
      <div className="cat-modal__scrim" onClick={requestClose} />

      {/* dvh: so it fits the visible screen as browser bars come and go, and the page behind does not scroll at its end */}
      <div ref={panelRef} className="cat-modal__panel">
        {/* Close button: a zero-height sticky row (categories-inspector.css), so it stays in reach however far the dialog is scrolled and takes no room */}
        <div className="cat-modal__close-row">
          <button
            ref={closeRef}
            type="button"
            onClick={requestClose}
            aria-label="Close modal"
            className="cat-modal__close tide-btn relative flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-page text-ink"
          >
            <XIcon size={16} weight="bold" />
          </button>
        </div>

        {/* the category's photo, to the panel's edges (the close button sits on it) */}
        {photo && (
          <div ref={photoRef} className="cat-modal__photo">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 736px) 736px, 100vw"
              quality={75}
              loading="eager"
              className="cat-modal__img"
            />
          </div>
        )}

        <div className="cat-modal__head" data-rise style={rise(0)}>
          <div className="cat-modal__tag text-ink">
            <CrosshairIcon size={14} weight="bold" className="text-accent" aria-hidden="true" />
            <span>{category.tag}</span>
          </div>
          <Tide
            as="h3"
            id={MODAL_TITLE_ID}
            className="display-type mt-2 text-3xl text-ink md:text-4xl"
            text={plateLastWord(category.name)}
            inview
          />
          <p className="mt-2 text-sm font-medium text-ink-soft">{category.subtitle}</p>
        </div>

        <div className="cat-modal__cols">
          <div className="min-w-0">
            <p className="text-base leading-relaxed text-ink-soft" data-rise style={rise(1)}>
              {category.description}
            </p>

            <div className="mt-6" data-rise style={rise(2)}>
              <h4 className="cat-modal__h4 text-ink">Product Line</h4>
              <ol className="cat-lines">
                {category.subcategories.map((sub, i) => (
                  <li key={sub} className="cat-lines__row">
                    <span className="cat-lines__n tabular-nums">0{i + 1}</span>
                    <span>{sub}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* where in the water it works: the column decorates the depth reading in the ledger below */}
          <div className="cat-sound" style={soundStyle} aria-hidden="true" data-rise>
            <div className="cat-sound__reading tabular-nums">
              <small>Works at</small>
              {depth.label}
            </div>
            <div className="cat-sound__track">
              <span className="cat-sound__range" />
              {DEPTH_TICKS.map((tick) => (
                <span key={tick.ft} className="cat-sound__tick" style={{ "--t": depthPosition(tick.ft).toFixed(3) } as CSSProperties}>
                  <span className="cat-sound__tick-label tabular-nums">{tick.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8" data-rise style={rise(3)}>
          <h4 className="cat-modal__h4 text-ink">Engineering Specifications</h4>
          <dl className="cat-ledger">
            <div className="cat-ledger__row">
              <dt className="cat-ledger__dt">Action Dynamics</dt>
              <dd className="cat-ledger__dd">{category.specs.action}</dd>
            </div>
            <div className="cat-ledger__row">
              <dt className="cat-ledger__dt">Operating Depth</dt>
              <dd className="cat-ledger__dd">{category.specs.depth}</dd>
            </div>
            <div className="cat-ledger__row">
              <dt className="cat-ledger__dt">Core Composition</dt>
              <dd className="cat-ledger__dd">{category.specs.coreMaterial}</dd>
            </div>
            <div className="cat-ledger__row">
              <dt className="cat-ledger__dt">Terminal Hardware</dt>
              <dd className="cat-ledger__dd">{category.specs.hardware}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-8" data-rise style={rise(4)}>
          <h4 className="cat-modal__h4 text-ink">Engineered Performance Features</h4>
          <ol className="cat-feats mt-2 border-t border-line">
            {category.features.map((feat, i) => (
              <li key={feat} className="cat-feats__row">
                <span className="cat-lines__n tabular-nums">0{i + 1}</span>
                <span>{feat}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex justify-end" data-rise style={rise(5)}>
          <button
            type="button"
            onClick={requestClose}
            className="tide-btn relative flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-xs font-bold tracking-wider text-page uppercase"
          >
            <span>Done Viewing</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
