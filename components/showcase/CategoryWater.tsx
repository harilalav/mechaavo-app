"use client";

import Image from "next/image";
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr";
import type { RefObject } from "react";
import { CATEGORIES_VIDEO } from "@/lib/config/media";

/**
 * The water behind the categories card: the loop, its poster and the colour layers
 * that grade it (src/styles/categories.css). Presentational: the controller is
 * `useLoopingVideo`, called once by the section so the pause button can live
 * elsewhere in the card (above the frosted catalog).
 */
export function CategoryWater({
  panelRef,
  videoRef,
  posterWanted,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  posterWanted: boolean;
}) {
  return (
    <div ref={panelRef} className="cat-media" data-cat="media">
      {posterWanted && (
        <Image
          src={CATEGORIES_VIDEO.poster.src}
          alt=""
          fill
          sizes="100vw"
          className="cat-media__poster"
        />
      )}
      <video
        ref={videoRef}
        className="cat-media__video"
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
        disableRemotePlayback
      />
      <div className="cat-media__lift" aria-hidden="true" />
      <div className="cat-media__deep" aria-hidden="true" />
    </div>
  );
}

/** The labelled pause / play button for the loop (44px target). */
export function CategoryWaterToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="cat-toggle tide-btn"
      data-cat="toggle"
      aria-label={enabled ? "Pause background video" : "Play background video"}
      onClick={onToggle}
    >
      {enabled ? (
        <PauseIcon size={18} weight="fill" aria-hidden="true" />
      ) : (
        <PlayIcon size={18} weight="fill" aria-hidden="true" />
      )}
    </button>
  );
}
