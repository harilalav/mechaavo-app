import { MechaavoHero } from "@/components/hero/MechaavoHero";
import { ProductCategories } from "@/components/showcase/ProductCategories";
import { BrandStory } from "@/components/showcase/BrandStory";
import { ContactSection } from "@/components/showcase/ContactSection";
import { SectionJumps } from "@/components/ui/SectionJumps";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteNavigation } from "@/components/ui/SiteNavigation";
import { SurfaceReveal } from "@/components/ui/SurfaceReveal";
import { TideObserver } from "@/components/ui/TideObserver";
import { readLureAsset } from "@/lib/hero/lureAsset.server";
import { jsonLd, siteStructuredData } from "@/lib/seo/structuredData";

export default function Home() {
  // Present only once a transparent lure PNG is dropped into public/images.
  const lureAsset = readLureAsset();

  return (
    <>
      {/* schema.org data: the brand and its site (lib/seo/structuredData.ts) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteStructuredData()) }} />
      <main className="flex-1">
        {/* the categories scroll up over the pinned hero: its water is their backdrop (MechaavoHero renders them inside its track) */}
        <MechaavoHero lureAsset={lureAsset}>
          <ProductCategories />
        </MechaavoHero>
        <BrandStory />
        <ContactSection />
        <SiteNavigation />
        <TideObserver />
        <SurfaceReveal />
        <SectionJumps />
      </main>
      <SiteFooter />
    </>
  );
}
