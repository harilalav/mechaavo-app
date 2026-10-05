import { MechaavoHero } from "@/components/hero/MechaavoHero";
import { ProductCategories } from "@/components/showcase/ProductCategories";
import { BrandStory } from "@/components/showcase/BrandStory";
import { ContactSection } from "@/components/showcase/ContactSection";
import { SectionJumps } from "@/components/ui/SectionJumps";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteNavigation } from "@/components/ui/SiteNavigation";
import { TideObserver } from "@/components/ui/TideObserver";
import { readLureAsset } from "@/lib/hero/lureAsset.server";

export default function Home() {
  // Present only once a transparent lure PNG is dropped into public/images.
  const lureAsset = readLureAsset();

  return (
    <>
      <main className="flex-1">
        <MechaavoHero lureAsset={lureAsset} />
        <ProductCategories />
        <BrandStory />
        <ContactSection />
        <SiteNavigation />
        <TideObserver />
        <SectionJumps />
      </main>
      <SiteFooter />
    </>
  );
}
