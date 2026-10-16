import Image from "next/image";
import type { CSSProperties, MouseEvent } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { Mark } from "@/components/ui/Tide";
import type { CategoryData } from "@/lib/config/categories";
import { parseDepth } from "@/lib/config/depth";
import { CATEGORY_MEDIA } from "@/lib/config/media";

/** A name with its last word on the plate: the plate stays closed until the card is touched (categories-plate.css). */
function CardName({ name }: { name: string }) {
  const words = name.split(" ");
  const last = words.pop();
  return (
    <>
      {words.length ? `${words.join(" ")} ` : null}
      <Mark>{last}</Mark>
    </>
  );
}

interface CategoryCardProps {
  category: CategoryData;
  /** 0-based position, shown as 01 to 08. */
  index: number;
  /** The section is close: fetch the photo (not at first paint, where it competes with the font and the hero). */
  near: boolean;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * One category plate: a specimen on the page (src/styles/categories-plate.css has the look and the
 * reasons). The photo (shown in its own colour), the index chip and the cast layers are decoration (`aria-hidden`):
 * the button is named by the category's name and says at what depth it works. What the plate
 * leaves out (the tag, the sub-lines, the specifications) is in the inspector it opens.
 */
export function CategoryCard({ category, index, near, onOpen }: CategoryCardProps) {
  const depth = parseDepth(category.specs.depth);
  const photo = CATEGORY_MEDIA[category.id];
  const style = { "--g0": depth.from.toFixed(3), "--g1": depth.to.toFixed(3) } as CSSProperties;

  return (
    <button type="button" onClick={onOpen} className="cat-card" style={style}>
      <span className="cat-card__stage" aria-hidden="true">
        {/* fetched once the section is close (useNearViewport): on a slow connection they would otherwise compete with the font and the first paint (they added 0.4 s to the mobile LCP) */}
        {near && photo && (
          <Image
            src={photo.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 24vw, (min-width: 768px) 22vw, 46vw"
            quality={70}
            className="cat-card__img"
          />
        )}
        <span className="cat-card__surface" />
        <span className="cat-card__index tabular-nums">0{index + 1}</span>
      </span>

      <span className="cat-card__body">
        <h3 className="cat-card__name display-type text-ink">
          <CardName name={category.name} />
        </h3>
        <p className="cat-card__more line-clamp-2 text-sm leading-relaxed text-ink-soft">{category.subtitle}</p>

        <span className="cat-card__depth">
          <span className="sr-only">Works at </span>
          <span className="cat-gauge" aria-hidden="true">
            <span className="cat-gauge__bar" />
          </span>
          <span className="cat-card__depth-label tabular-nums">{depth.label}</span>
        </span>

        <span className="cat-card__foot">
          <span>Inspect Specs</span>
          <span className="cat-card__go" aria-hidden="true">
            <ArrowRightIcon size={14} weight="bold" />
          </span>
        </span>
      </span>
    </button>
  );
}
