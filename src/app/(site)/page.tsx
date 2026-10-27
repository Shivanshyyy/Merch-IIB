import { Suspense } from "react";
import { HomeExperience } from "@/components/home/HomeExperience";
import type { HomeColorway } from "@/components/home/store";
import { getOpenBatch, getProducts } from "@/lib/catalog";

// The 3D scroll experience. This page only gathers the real catalogue and batch; the scene lives in the client.
export default function Home() {
  return (
    <Suspense fallback={<HomeExperience colorways={[]} batch={null} />}>
      <HomeWithData />
    </Suspense>
  );
}

async function HomeWithData() {
  const [products, batch] = await Promise.all([getProducts(), getOpenBatch()]);
  const colorways: HomeColorway[] = products.flatMap((p) => p.colorways.map((c) => ({ ...c, slug: p.slug })));
  return <HomeExperience colorways={colorways} batch={batch ? { name: batch.name, closesAt: batch.closes_at } : null} />;
}
