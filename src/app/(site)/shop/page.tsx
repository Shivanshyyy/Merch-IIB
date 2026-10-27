import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShopTurntable } from "@/components/shop/ShopTurntable";
import { getOpenBatch, getProducts } from "@/lib/catalog";
import { fmtDate } from "@/lib/format";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Shop" };

export default function ShopPage() {
  return (
    <div className="page ember">
      <div className="shell">
        <p className="label">[ 01 ] — The drop</p>
        <Reveal as="h1" trigger="load" className="t-display t-h1 mt-4">
          {"Pick your\nhoodie"}
        </Reveal>
        <Suspense fallback={<GridSkeleton />}>
          <Catalog />
        </Suspense>
        <ShopTurntable />
      </div>
    </div>
  );
}

async function Catalog() {
  const [products, batch] = await Promise.all([getProducts(), getOpenBatch()]);
  const badge = batch ? `${batch.name} · preorder` : null;

  return (
    <>
      <p className="mt-6 max-w-xl text-muted">
        {batch ? (
          <>
            Preorders for {batch.name} close <span className="mono text-fg">{fmtDate(batch.closes_at)}</span>. Every hoodie is made to order with your name on the back.
          </>
        ) : (
          "Preorders are closed right now. Browse the range and check back when the next batch opens."
        )}
      </p>
      {products.length === 0 ? (
        <p className="mt-16 border border-line p-10 text-center text-muted">No products are live yet. Check back soon.</p>
      ) : (
        <div className="mt-12 grid border-t border-line md:grid-cols-3">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} badge={badge} priority={i === 0} />
          ))}
        </div>
      )}
    </>
  );
}

function GridSkeleton() {
  return (
    <div className="mt-[4.6rem] grid border-t border-line md:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-b border-line md:border-r md:last:border-r-0">
          <div className="skeleton aspect-[4/5]" />
          <div className="h-[84px]" />
        </div>
      ))}
    </div>
  );
}
