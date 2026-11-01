import { Suspense } from "react";
import { HomeExperience } from "@/components/home/HomeExperience";
import type { HomePhoto } from "@/components/home/Sections";
import type { HomeColorway } from "@/components/home/store";
import { getFreebiesTaken, getOpenBatch, getProducts } from "@/lib/catalog";
import { promoView } from "@/lib/promo";
import { getSettings } from "@/lib/settings";
import { nameSpot } from "@/lib/name-spots";
import { photoUrl } from "@/lib/photos";

export default function Home() {
  return (
    <Suspense fallback={<HomeExperience colorways={[]} batch={null} hero={null} promo={null} />}>
      <HomeWithData />
    </Suspense>
  );
}

async function HomeWithData() {
  const [products, batch, settings, taken] = await Promise.all([getProducts(), getOpenBatch(), getSettings(), getFreebiesTaken()]);
  // "Make it yours" uses the first product with a live name preview on its plain back still.
  const featured = products.find((p) => p.personalizable && nameSpot(p.slug)) ?? products[0];
  const colorways: HomeColorway[] = featured ? featured.colorways.map((c) => ({ ...c, slug: featured.slug })) : [];
  // Hero shows the first uploaded photo; falls back to the studio still.
  const withPhoto = products.find((p) => p.photos.length);
  const hero: HomePhoto = withPhoto ? { src: photoUrl(withPhoto.photos[0]), alt: withPhoto.name, slug: withPhoto.slug } : null;
  return <HomeExperience colorways={colorways} batch={batch ? { name: batch.name, closesAt: batch.closes_at } : null} hero={hero} promo={promoView(settings.promo, taken)} />;
}
