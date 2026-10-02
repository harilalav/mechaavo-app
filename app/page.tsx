import { MechaavoHero } from "@/components/hero/MechaavoHero";
import { TideObserver } from "@/components/ui/TideObserver";
import { readLureAsset } from "@/lib/hero/lureAsset.server";

export default function Home() {
  // Present only once a transparent lure PNG is dropped into public/images.
  const lureAsset = readLureAsset();

  return (
    <main className="flex-1">
      <MechaavoHero lureAsset={lureAsset} />
      <TideObserver />
    </main>
  );
}
