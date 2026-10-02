import type { FishRenderer, FishView } from "./renderFish";
import type { Fish } from "./types";

/**
 * Drop-in slot for real fish artwork.
 *
 * Add transparent PNG / WebP side-view fish (facing RIGHT, dorsal fin up) to
 * `public/images/fish/` and list them here. When the list is non-empty the
 * engine uses sprites for mid and near fish (far fish and baitfish stay
 * silhouettes, the primary fish stays procedural so its body can bend into the
 * strike) and falls back to the procedural renderer for anything not covered.
 *
 *   { src: "/images/fish/bass-01.png", headX: 0.97, headY: 0.46 }
 *
 * `headX` / `headY` locate the nose as a fraction of the image (0-1), so the
 * sprite is pinned by its head exactly like the procedural fish.
 */
export interface FishSpriteSource {
  src: string;
  headX: number;
  headY: number;
}

export const FISH_SPRITE_SOURCES: readonly FishSpriteSource[] = [];

interface LoadedSprite extends FishSpriteSource {
  image: HTMLImageElement;
}

export async function loadFishSprites(
  sources: readonly FishSpriteSource[],
): Promise<LoadedSprite[]> {
  const loaded = await Promise.all(
    sources.map(
      (source) =>
        new Promise<LoadedSprite | null>((resolve) => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => resolve({ ...source, image });
          image.onerror = () => resolve(null);
          image.src = source.src;
        }),
    ),
  );
  return loaded.filter((s): s is LoadedSprite => s !== null);
}

export function createSpriteFishRenderer(
  sprites: readonly LoadedSprite[],
  fallback: FishRenderer,
): FishRenderer {
  return {
    draw(ctx, fish: Fish, view: FishView) {
      if (
        sprites.length === 0 ||
        fish.tier === "primary" ||
        fish.tier === "far" ||
        fish.species === "bait"
      ) {
        fallback.draw(ctx, fish, view);
        return;
      }
      const alpha = fish.opacity * view.alpha;
      if (alpha <= 0.004) return;

      const sprite = sprites[fish.id % sprites.length];
      const aspect = sprite.image.naturalHeight / sprite.image.naturalWidth;
      // sprite coordinates are in fish lengths, head at the origin
      const bodyLength = 1 / Math.max(0.2, sprite.headX);

      ctx.save();
      ctx.translate(view.x, view.y);
      ctx.rotate(fish.facing > 0 ? -fish.pitch : Math.PI + fish.pitch);
      ctx.scale(view.length * fish.turn, view.length * fish.facing);
      ctx.globalAlpha = alpha;
      // gentle body sway stands in for the spine wave
      ctx.rotate(Math.sin(fish.tailPhase) * 0.035 * fish.tailAmp);
      ctx.drawImage(
        sprite.image,
        -sprite.headX * bodyLength,
        -sprite.headY * aspect * bodyLength,
        bodyLength,
        aspect * bodyLength,
      );
      ctx.restore();
    },
  };
}
