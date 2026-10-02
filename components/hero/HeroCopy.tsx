import type { CSSProperties } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { Drop, Mark } from "@/components/ui/Tide";
import { HERO_CTA } from "@/lib/config/sections";

const STATEMENT = ["Precision", "Meets", "Possibility"] as const;

/**
 * Hero typography. Two statements share the hero:
 *   1. "Engineered for every cast."  present on arrival, steps aside for the fish
 *   2. "Precision meets possibility."  arrives the moment the fish is hooked
 *
 * Every line sits in an overflow-hidden mask so the text can slide up into view;
 * the words themselves stay real, selectable text. The first statement is moved
 * by the scroll timeline; the second by CSS, off the `data-caught` attribute the
 * Canvas engine sets on the hero at the bite (see underwater.css).
 * Colour is kept to the headings (components/ui/Tide.tsx, src/styles/tide.css):
 * the payoff word of each wears the brand-blue plate and the full stop is the
 * drop. Paragraphs are never tinted.
 */
export function HeroCopy() {
  return (
    <>
      <div className="hero-copy-slot">
        {/* the skip link's target (app/layout.tsx): the nav sits inside <main>, so the next Tab after it lands on the call to action */}
        <div id="hero-copy" tabIndex={-1} className="hero-copy">
          <div data-hero="title-group">
            <p className="hero-kicker" data-hero="kicker">
              Mechaavo // System 01
            </p>
            {/* data-inview: the arrival is CSS from first paint, the plate and the drop follow the lines in (tide.css) */}
            <h1
              className="hero-title display-type tide"
              data-inview=""
              style={{ "--pd": "1050ms", "--dd": "1650ms" } as CSSProperties}
            >
              <span className="hero-line">
                <span className="hero-line__inner" data-hero="title-inner">
                  Engineered
                </span>
              </span>
              <span className="hero-line">
                <span className="hero-line__inner" data-hero="title-inner">
                  for every <Mark>cast</Mark>
                  <Drop />
                </span>
              </span>
            </h1>
          </div>

          <div className="hero-support" data-hero="support-group">
            <p className="hero-tagline" data-hero="support-item">
              Trusted for every catch.
            </p>
            <p className="hero-lede" data-hero="support-item">
              Premium fishing tackle engineered with precision, innovation, and
              reliability. Designed for anglers who demand performance when it
              matters most.
            </p>
            <div data-hero="support-item">
              <a href={HERO_CTA.href} className="hero-cta tide-btn">
                {HERO_CTA.label}
                <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-statement-slot">
        <h2 className="hero-statement display-type tide">
          {STATEMENT.map((word, i) => (
            <span key={word} className="hero-line">
              <span className="hero-line__inner" style={{ "--i": i } as CSSProperties}>
                {i === STATEMENT.length - 1 ? (
                  <>
                    <Mark>{word}</Mark>
                    <Drop />
                  </>
                ) : (
                  word
                )}
              </span>
            </span>
          ))}
        </h2>
        <p className="hero-statement__sub">Every detail engineered. Every product trusted.</p>
      </div>
    </>
  );
}
