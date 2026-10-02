"use client";

import Image from "next/image";
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr";
import { STORY_VIDEO } from "@/lib/config/media";
import { useLoopingVideo } from "@/lib/hooks/useLoopingVideo";

/** The panel keeps its own size, so the footage has to be sharp at the panel's width. */
const panelWidth = (panel: HTMLElement) => panel.clientWidth;

/**
 * Real water footage for the story section (a decorative loop, no audio).
 *
 * It behaves like a good citizen (lib/hooks/useLoopingVideo.ts):
 *   - nothing downloads until the panel is within ~400px of the viewport, and
 *     then only the rendition the screen can use (lib/config/media.ts);
 *   - it plays only while on screen and while the tab is visible;
 *   - under prefers-reduced-motion it stays on its poster until the visitor
 *     presses play;
 *   - a labelled pause / play button is always there (44px target).
 *
 * The colors come from brand tokens in src/styles/story.css; this component
 * only moves pixels.
 */
export function StoryVideo() {
  const { panelRef, videoRef, posterWanted, enabled, toggle } = useLoopingVideo(
    STORY_VIDEO.renditions,
    panelWidth,
  );

  return (
    <div ref={panelRef} className="story-media">
      {posterWanted && (
        <Image
          src={STORY_VIDEO.poster.src}
          alt=""
          fill
          sizes="100vw"
          className="story-media__poster"
        />
      )}
      <video
        ref={videoRef}
        className="story-media__video"
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
        disableRemotePlayback
      />
      <div className="story-media__lift" aria-hidden="true" />
      <div className="story-media__deep" aria-hidden="true" />
      <button
        type="button"
        className="story-media__toggle tide-btn"
        aria-label={enabled ? "Pause background video" : "Play background video"}
        onClick={toggle}
      >
        {enabled ? (
          <PauseIcon size={18} weight="fill" aria-hidden="true" />
        ) : (
          <PlayIcon size={18} weight="fill" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
