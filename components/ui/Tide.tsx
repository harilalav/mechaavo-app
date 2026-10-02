import { Fragment, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * Tide type: the site's heading system (styles in src/styles/tide.css).
 *
 * A heading is a few words, one of which carries the idea. That word wears a
 * gradient plate in the two brand blues (the text on it stays ink, so it is
 * 8 to 10:1), the full stop becomes a drop that falls in and sends out ripples
 * (the same motif as the lure's splash in the hero), and the words rise out of
 * their masks one after another when the heading scrolls into view.
 *
 * Copy is one string with a tiny markup, parsed here (no hooks, no client code,
 * so it works in server and client components alike):
 *   |        a line break
 *   [words]  the plate
 *   .        a final full stop becomes the drop (`drop`), otherwise stays a period
 *
 *   <Tide as="h2" text="They are engineered with [purpose]." drop />
 *
 * Words are real inline text with real spaces between them, so selection,
 * find-in-page and screen readers read the heading as plain text. The plate and
 * the drop are decorative (aria-hidden). `inview` starts the motion on mount
 * (for things that appear on demand, like the inspector); otherwise
 * components/ui/TideObserver.tsx starts it when the heading scrolls into view.
 */

interface Word {
  text: string;
  /** index of the word in the whole heading, for the stagger */
  i: number;
}
type Segment = { mark: boolean; words: Word[] };
interface Line {
  segments: Segment[];
}

/** "a b [c d].|e" -> lines of segments of words; returns the word count and whether a final stop was taken. */
function parse(text: string, drop: boolean): { lines: Line[]; count: number; dropped: boolean } {
  let count = 0;
  let dropped = false;
  const rawLines = text.split("|");
  const lines = rawLines.map((raw, li) => {
    let line = raw.trim();
    // the last line's final full stop becomes the drop
    if (drop && li === rawLines.length - 1 && line.endsWith(".")) {
      line = line.slice(0, -1);
      dropped = true;
    }
    const segments: Segment[] = [];
    let mark = false;
    let buffer = "";
    const flush = () => {
      const words = buffer
        .split(/\s+/)
        .filter(Boolean)
        .map((text) => ({ text, i: count++ }));
      if (words.length) segments.push({ mark, words });
      buffer = "";
    };
    for (const ch of line) {
      if (ch === "[") {
        flush();
        mark = true;
      } else if (ch === "]") {
        flush();
        mark = false;
      } else {
        buffer += ch;
      }
    }
    flush();
    return { segments };
  });
  return { lines, count, dropped };
}

/** The plate behind a payoff word. Text children stay ink. */
export function Mark({ children, delay, lead = false }: { children: ReactNode; delay?: number; lead?: boolean }) {
  return (
    <mark
      className={`tide__mark${lead ? " tide__mark--lead" : ""}`}
      style={delay === undefined ? undefined : ({ "--pd": `${delay}ms` } as CSSProperties)}
    >
      <span className="tide__plate" aria-hidden="true">
        <i className="tide__glint" />
      </span>
      {children}
    </mark>
  );
}

/** The full stop as a drop: falls onto the baseline, then ripples. */
export function Drop({ delay }: { delay?: number }) {
  return (
    <span className="tide__drop" aria-hidden="true" style={delay === undefined ? undefined : ({ "--dd": `${delay}ms` } as CSSProperties)}>
      <i className="tide__ring" />
      <i className="tide__ring tide__ring--2" />
    </span>
  );
}

interface TideProps {
  as?: ElementType;
  className?: string;
  id?: string;
  text: string;
  /** Turn the final full stop into the drop. */
  drop?: boolean;
  /** Indexes of lines set in the muted ink (a quieter second line). */
  muted?: number[];
  /** Start the motion on mount instead of on scroll. */
  inview?: boolean;
  /** Leave starting it to the caller (the observer skips it): for a heading shown by something other than scrolling. */
  manual?: boolean;
}

export function Tide({ as: Tag = "h2", className = "", id, text, drop = false, muted = [], inview = false, manual = false }: TideProps) {
  const { lines, count, dropped } = parse(text, drop);
  return (
    <Tag
      id={id}
      className={`tide ${className}`.trim()}
      data-tide=""
      {...(manual ? { "data-tide-manual": "" } : {})}
      {...(inview ? { "data-inview": "" } : {})}
    >
      {lines.map((line, li) => (
        <Fragment key={li}>
          {/* a real space between lines too (they are blocks, which collapse it), so the text reads as one sentence to anything that does not lay it out */}
          {li > 0 ? " " : null}
          <span className={`tide__line${muted.includes(li) ? " tide__line--muted" : ""}`}>
            {line.segments.map((seg, si) => {
              const words = seg.words.map((w, wi) => (
                <span key={w.i}>
                  <span className="tide__w">
                    <span className="tide__i" style={{ "--i": w.i } as CSSProperties}>
                      {w.text}
                    </span>
                  </span>
                  {/* a real space between words, outside the masks */}
                  {wi < seg.words.length - 1 ? " " : null}
                </span>
              ));
              return (
                <span key={si}>
                  {seg.mark ? (
                    // a plate that opens a line hangs into the margin, so the text keeps the column's edge
                    <Mark delay={seg.words[0].i * 55 + 380} lead={si === 0 && line.segments.length > 1}>
                      {words}
                    </Mark>
                  ) : (
                    words
                  )}
                  {/* and one between a plate and the words around it */}
                  {si < line.segments.length - 1 ? " " : null}
                </span>
              );
            })}
            {dropped && li === lines.length - 1 ? <Drop delay={count * 55 + 520} /> : null}
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}
