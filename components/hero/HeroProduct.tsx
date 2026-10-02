"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { LURE_ANCHORS, LURE_ART_SIZE } from "@/lib/hero/lureConfig";
import { probeTransparentLure, type LureAsset } from "@/lib/hero/lureAsset";
import { LureArt } from "./LureArt";

type ArtMode = "pending" | "raster" | "vector";

const ANCHOR_NAMES = ["tie", "hook", "tail"] as const;

/**
 * The lure, standing directly in the water: no card, frame or backdrop.
 *
 * Three nested layers so independent motion never fights over one transform:
 *   wrapper  camera push                (scroll timeline)
 *   pull     float, tilt and size       (lure rig: drifting in the current, the pendulum
 *                                        about the nose, the swim in from the logo)
 *   shake    tremor under tension       (lure rig)
 * The lure rig (lib/underwater/lureRig.ts) is driven by the Canvas engine, which
 * writes pull and shake every frame; nothing else animates them.
 *
 * Anchors (line eyelet, belly hook, tail) are what the Canvas engine measures,
 * so the fishing line and the hooked fish stay glued to the lure wherever it
 * moves. The procedural lure renders its own, inside the jointed parts that
 * move them; a transparent photo cut-out gets plain anchors on the artwork.
 */
export function HeroProduct({ asset }: { asset: LureAsset | null }) {
  const [mode, setMode] = useState<ArtMode>(asset ? "pending" : "vector");

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    void probeTransparentLure(asset).then((transparent) => {
      if (!cancelled) setMode(transparent ? "raster" : "vector");
    });
    return () => {
      cancelled = true;
    };
  }, [asset]);

  const aspect =
    mode === "raster" && asset
      ? asset.width / asset.height
      : LURE_ART_SIZE.width / LURE_ART_SIZE.height;

  return (
    <div className="hero-lure-slot" data-hero="lure-slot" data-hero-anchor="slot">
      <div className="hero-lure" data-hero="lure-wrapper">
        <div className="hero-lure__pull" data-hero="lure-pull">
          <div className="hero-lure__shake" data-hero="lure-shake">
            <div
              className="hero-lure__art"
              data-hero-anchor="art"
              style={{ aspectRatio: aspect }}
            >
              {mode === "vector" ? (
                <LureArt />
              ) : (
                <>
                  {mode === "raster" && asset && (
                    <Image
                      src={asset.src}
                      alt="Mechaavo fishing lure"
                      fill
                      priority
                      sizes="(min-width: 768px) 30vw, 60vw"
                      className="hero-lure__photo object-contain"
                    />
                  )}
                  {ANCHOR_NAMES.map((name) => (
                    <span
                      key={name}
                      className="hero-anchor"
                      data-hero-anchor={name}
                      aria-hidden="true"
                      style={{
                        left: `${LURE_ANCHORS[name].x * 100}%`,
                        top: `${LURE_ANCHORS[name].y * 100}%`,
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
