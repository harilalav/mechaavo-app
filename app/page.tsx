import { MechaavoHero } from "@/components/hero/MechaavoHero";
import { ProductCategories } from "@/components/showcase/ProductCategories";
import { BrandStory } from "@/components/showcase/BrandStory";
import { TideObserver } from "@/components/ui/TideObserver";
import { readLureAsset } from "@/lib/hero/lureAsset.server";

export default function Home() {
  // Present only once a transparent lure PNG is dropped into public/images.
  const lureAsset = readLureAsset();

  return (
    <main className="flex-1">
      <MechaavoHero lureAsset={lureAsset} />
      <ProductCategories />
      <BrandStory />
      <TideObserver />
    </main>
  );
}
