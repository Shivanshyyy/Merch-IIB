import Link from "next/link";
import { ColorwayImage } from "@/components/shop/ColorwayImage";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({ product, index, badge, priority = false }: { product: Product; index: number; badge: string | null; priority?: boolean }) {
  const first = product.colorways[0];
  return (
    <Link href={`/shop/${product.slug}`} data-cursor="view" className="group relative block border-b border-line md:border-r md:last:border-r-0">
      <div className="relative aspect-[4/5] overflow-hidden bg-bg-2">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_58%,rgba(255,59,31,0.3),transparent_70%)] transition-opacity duration-700 group-hover:opacity-100" />
        <ColorwayImage
          slug={product.slug}
          colorway={first.name}
          body={first.body}
          stitch={first.stitch}
          view="front"
          alt={`${product.name} in ${first.name}, front`}
          priority={priority}
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-contain p-4 transition-all duration-700 ease-[var(--ease)] group-hover:scale-[1.04] group-hover:opacity-0"
        />
        <ColorwayImage
          slug={product.slug}
          colorway={first.name}
          body={first.body}
          stitch={first.stitch}
          view="back"
          alt=""
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-contain p-4 opacity-0 transition-all duration-700 ease-[var(--ease)] group-hover:scale-[1.04] group-hover:opacity-100"
        />
        <span className="label absolute left-4 top-4 border border-line bg-bg/70 px-2 py-1.5 backdrop-blur-sm">{badge ?? "Preorder"}</span>
        <span className="mono absolute right-4 top-4 text-[0.7rem] text-muted">[{String(index + 1).padStart(2, "0")}]</span>
      </div>
      <div className="flex items-end justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="t-display text-[1.05rem] tracking-[-0.025em]">{product.name}</h2>
          <div className="mt-3 flex items-center gap-2">
            {product.colorways.map((c) => (
              <span key={c.name} title={c.name} className="size-3.5 rounded-full border border-line" style={{ background: c.body }} />
            ))}
            <span className="label ml-1">{product.colorways.length} colourways</span>
          </div>
        </div>
        <p className="mono text-lg">{inr(product.price_inr)}</p>
      </div>
    </Link>
  );
}
