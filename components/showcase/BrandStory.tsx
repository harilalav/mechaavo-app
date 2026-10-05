import {
  CrosshairIcon,
  LightbulbFilamentIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Tide } from "@/components/ui/Tide";
import { SECTION_IDS } from "@/lib/config/sections";
import { StoryVideo } from "./StoryVideo";
import { WaterLight } from "./WaterLight";

/** Each principle with the mark of what it stands for ([the word] wears the plate, see Tide). */
const PRINCIPLES = [
  { text: "[Precision] in design.", Icon: CrosshairIcon },
  { text: "[Strength] in performance.", Icon: ShieldCheckIcon },
  { text: "[Innovation] in every detail.", Icon: LightbulbFilamentIcon },
] as const;

/** Running text: capped at 65 characters a line. */
const body = "max-w-prose text-lg leading-relaxed text-pretty text-ink-soft";
/** Short standalone statements, set larger than running text. */
const statement =
  "max-w-xl text-xl font-medium leading-snug text-pretty text-ink md:text-2xl";

/**
 * Where the hero lands: the Mechaavo story. The first section is a sheet that
 * slides up over the hero (see .story-sheet), and it opens with the water the
 * hero ends in (WaterLight), clearing into the white page, so the scene hands
 * over to the page instead of being cut off by a blank screen. Every section
 * has water light of its own behind it. They share the hero's column
 * (.page-container) and headline voice (.display-type).
 *
 * Three sections, three layouts, each block at most 25 words:
 *   #story       headline and lead, the water footage, then what the name means
 *   #principles  the three principles as large divided rows
 *   #commitment  who it is for, the promise, and the sign-off beside the logo
 */
export function BrandStory() {
  return (
    <>
      <section
        id={SECTION_IDS.story}
        className="relative isolate overflow-hidden bg-page pt-24 md:pt-36 border-t border-line/40"
      >
        <WaterLight variant="top" />
        <div className="page-container">
          <Tide
            as="h2"
            className="display-type max-w-6xl text-4xl md:text-6xl lg:text-7xl"
            text="Great products don’t happen by chance.|They are engineered with [purpose]."
            drop
            muted={[1]}
          />

          <p className="mt-12 max-w-3xl text-2xl leading-snug font-medium text-balance text-ink md:mt-16 md:text-4xl md:leading-tight">
            Mechaavo was born from a belief that exceptional design can transform
            ordinary experiences into extraordinary ones.
          </p>
        </div>

        <div className="mt-16 md:mt-24">
          <StoryVideo />
        </div>

        <div className="page-container">
          <div className="grid gap-10 py-16 md:py-24 lg:grid-cols-2 lg:gap-24">
            <p className={`${statement} border-t border-line pt-6`}>
              &ldquo;Mecha&rdquo; for mechanics, precision, and engineering. An
              ending for progress, movement, and evolution.
            </p>
            <p className={`${statement} border-t border-line pt-6`}>
              Mechaavo is defined by a way of thinking, not a single product
              category.
            </p>
          </div>
        </div>
      </section>

      <section
        id={SECTION_IDS.principles}
        className="relative isolate overflow-hidden bg-page-alt py-24 md:py-36"
      >
        <WaterLight variant="soft" />
        <div className="page-container">
          <p className={body}>
            Every Mechaavo product is created with three principles:
          </p>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {PRINCIPLES.map(({ text, Icon }) => (
              <li key={text} className="principle group py-8 md:py-12">
                <Tide
                  as="span"
                  className="block text-3xl font-bold tracking-tight text-ink transition-transform duration-500 ease-[var(--ease-out)] group-hover:translate-x-3 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 md:text-6xl"
                  text={text}
                  drop
                />
                <span className="principle__mark" aria-hidden="true">
                  <Icon size={26} weight="regular" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id={SECTION_IDS.commitment}
        className="relative isolate overflow-hidden bg-page py-24 md:py-36"
      >
        <div className="page-container">
          {/* a vertical stack, not the two columns the story section uses: each section keeps its own layout */}
          <div className="max-w-4xl">
            <p className="text-2xl leading-snug font-medium text-balance text-ink md:text-4xl md:leading-tight">
              On the water, in the workshop, or outdoors, Mechaavo builds
              equipment people can trust when performance matters most.
            </p>
            <p className={`mt-10 border-t border-line pt-8 ${statement}`}>
              The name represents engineers, makers, creators, and adventurers
              who believe every challenge deserves a better solution.
            </p>
          </div>

          <div className="mt-24 grid gap-16 border-t border-line pt-16 md:mt-32 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <Tide
                as="h3"
                className="display-type text-3xl md:text-5xl"
                text="Mechaavo is more than a [brand]."
                drop
              />
              <p className={`mt-6 ${body}`}>
                A commitment to products that last longer, perform better, and
                inspire confidence, today and for generations to come.
              </p>
              <p className="mt-12 text-xl font-semibold text-ink">
                Every detail engineered. Every product trusted.
              </p>
            </div>
            <div className="lg:col-span-5">
              <div className="w-full max-w-sm lg:ml-auto">
                <BrandLogo variant="lockup" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
