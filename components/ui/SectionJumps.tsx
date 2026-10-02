"use client";

import { useEffect, useRef } from "react";
import { startSectionJumps } from "@/lib/animations/sectionJump";

/**
 * Gives the links that point at a section of this page (the nav, the hero call to
 * action) a soft jump instead of a cut: see lib/animations/sectionJump.ts for the
 * reasoning, src/styles/section-jump.css for the veil. Mounted once per page; the
 * markup is the veil, which is invisible and takes no input until a jump uses it.
 * Without script the links are plain anchors and jump as the browser does.
 */
export function SectionJumps() {
  const veilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const veil = veilRef.current;
    return veil ? startSectionJumps(veil) : undefined;
  }, []);

  return <div ref={veilRef} className="section-veil" aria-hidden="true" />;
}
